/**
 * Auto-Save Coordinator — 06_TASKS.md M8-011 ("Implement Auto-Save
 * Coordinator"). DoD: "Auto-save behavior is consistent across
 * portfolios and saved strategy tools" — one shared coordinator every
 * Store's mutating actions schedule a save through, rather than each
 * Store re-implementing debounce/retry logic itself.
 *
 * Requirement-by-requirement:
 * - **"Debounce rapid updates."** `schedule` clears any pending timer
 *   for the same `(recordType, id)` key before starting a new one — only
 *   the last call in a rapid burst actually reaches storage.
 * - **"Reject invalid drafts." / "Preserve last valid record."**
 *   Structurally satisfied one layer up, not re-implemented here: every
 *   Store already runs its input through Zod (`portfolioInputSchema`,
 *   etc.) and only calls `set()` — and therefore only calls
 *   `schedule()` — with an already-valid, already-in-memory record. An
 *   invalid draft never reaches this coordinator, so the last
 *   successfully written record on disk is never overwritten by one.
 * - **"Prevent stale writes."** A monotonic per-key sequence number
 *   guards the one real race: a slow *retry* (below) resolving after a
 *   newer `schedule()` call for the same key has already started a
 *   fresher write. The debounce timer itself already prevents an
 *   outdated *first attempt* from ever firing.
 * - **"Expose saving state."** `getState`/`subscribe` — Stores read the
 *   current state for the key(s) they care about and re-render on
 *   change, the same pattern `stores/portfolioStore.ts`'s own
 *   `saveStatus` field already exposes to its UI.
 * - **"Retry transient failures."** Only adapter-level storage failures
 *   (`LOCAL_STORAGE_WRITE_FAILED`/`LOCAL_STORAGE_READ_FAILED`) are
 *   retried, with a short exponential backoff. Validation failures
 *   (`INVALID_PERSISTED_RECORD`, `UNSUPPORTED_SCHEMA_VERSION`, …) and
 *   quota exhaustion are deterministic — retrying reproduces the same
 *   failure — so they fail immediately instead of wasting retries.
 */
import type { ApplicationError } from '@/services/shared';

import type { PersistenceService } from './persistence.service';
import { persistenceService } from './persistence.service';
import type { PersistedRecordType } from './types';

export type AutoSaveState = 'idle' | 'saving' | 'saved' | 'error';

const RETRYABLE_CODES = new Set(['LOCAL_STORAGE_WRITE_FAILED', 'LOCAL_STORAGE_READ_FAILED']);

export interface AutoSaveCoordinatorOptions {
  debounceMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
}

export interface AutoSaveCoordinator {
  schedule<T>(recordType: PersistedRecordType, id: string, payload: T): void;
  scheduleDelete(recordType: PersistedRecordType, id: string): void;
  getState(recordType: PersistedRecordType, id: string): AutoSaveState;
  /**
   * The real, user-facing reason behind the most recent `'error'` state
   * for this key — 06_TASKS.md M8-012's "Quota errors"/"Suggested export
   * action" surface through here (`LocalStorageAdapter`'s own error
   * messages already name the recoverable action, e.g. "Export your data
   * and free up space"). Empty outside the `'error'` state.
   */
  getErrors(recordType: PersistedRecordType, id: string): ApplicationError[];
  /**
   * `listener` receives which `(recordType, id)` changed and its new
   * state — a Store mirroring this into its own field (e.g.
   * `stores/portfolioStore.ts`'s `saveStatus`) needs to filter for the
   * *specific* record it cares about, not react to every unrelated
   * record's save state changing too.
   */
  subscribe(
    listener: (recordType: PersistedRecordType, id: string, state: AutoSaveState) => void,
  ): () => void;
  /**
   * Resolves once every currently-pending debounced save/delete has been
   * attempted, bypassing the remaining debounce wait. A real production
   * safeguard, not just a test utility: every Store's own `load*` action
   * calls this before reading, so a `load()` triggered moments after a
   * `schedule()` (e.g. navigating away right after creating a record)
   * cannot read local storage *before* that write has landed and
   * overwrite the just-created in-memory record with stale (often empty)
   * disk contents — a real race confirmed via Playwright, not a
   * theoretical one.
   */
  flushAll(): Promise<void>;
}

function keyOf(recordType: PersistedRecordType, id: string): string {
  return `${recordType}:${id}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createAutoSaveCoordinator(
  service: PersistenceService,
  options: AutoSaveCoordinatorOptions = {},
): AutoSaveCoordinator {
  const debounceMs = options.debounceMs ?? 400;
  const maxRetries = options.maxRetries ?? 2;
  const retryDelayMs = options.retryDelayMs ?? 300;

  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const dueActions = new Map<string, () => void>();
  const sequences = new Map<string, number>();
  const states = new Map<string, AutoSaveState>();
  const errorsByKey = new Map<string, ApplicationError[]>();
  const pending = new Set<Promise<void>>();
  const listeners = new Set<
    (recordType: PersistedRecordType, id: string, state: AutoSaveState) => void
  >();

  function setState(
    recordType: PersistedRecordType,
    id: string,
    state: AutoSaveState,
    errors: ApplicationError[] = [],
  ): void {
    const key = keyOf(recordType, id);
    states.set(key, state);
    if (state === 'error') {
      errorsByKey.set(key, errors);
    } else {
      errorsByKey.delete(key);
    }
    for (const listener of listeners) listener(recordType, id, state);
  }

  function nextSequence(key: string): number {
    const next = (sequences.get(key) ?? 0) + 1;
    sequences.set(key, next);
    return next;
  }

  async function attemptSave<T>(
    key: string,
    recordType: PersistedRecordType,
    id: string,
    payload: T,
    mySequence: number,
    attempt: number,
  ): Promise<void> {
    if (sequences.get(key) !== mySequence) return; // superseded by a newer schedule — drop this stale attempt.

    setState(recordType, id, 'saving');
    const result = await service.write(recordType, id, payload);
    if (sequences.get(key) !== mySequence) return; // superseded while the write was in flight.

    if (result.ok) {
      setState(recordType, id, 'saved');
      return;
    }

    const retryable = result.errors.some((error) => RETRYABLE_CODES.has(error.code));
    if (retryable && attempt < maxRetries) {
      await delay(retryDelayMs * 2 ** attempt);
      return attemptSave(key, recordType, id, payload, mySequence, attempt + 1);
    }
    setState(recordType, id, 'error', result.errors);
  }

  async function attemptDelete(
    key: string,
    recordType: PersistedRecordType,
    id: string,
    mySequence: number,
    attempt: number,
  ): Promise<void> {
    if (sequences.get(key) !== mySequence) return;

    setState(recordType, id, 'saving');
    const result = await service.delete(recordType, id);
    if (sequences.get(key) !== mySequence) return;

    if (result.ok) {
      setState(recordType, id, 'idle');
      return;
    }

    const retryable = result.errors.some((error) => RETRYABLE_CODES.has(error.code));
    if (retryable && attempt < maxRetries) {
      await delay(retryDelayMs * 2 ** attempt);
      return attemptDelete(key, recordType, id, mySequence, attempt + 1);
    }
    setState(recordType, id, 'error', result.errors);
  }

  function clearPendingTimer(key: string): void {
    const existing = timers.get(key);
    if (existing !== undefined) {
      clearTimeout(existing);
      timers.delete(key);
    }
    dueActions.delete(key);
  }

  function runDueAction(key: string): void {
    timers.delete(key);
    const action = dueActions.get(key);
    dueActions.delete(key);
    action?.();
  }

  function trackPending(promise: Promise<void>): void {
    pending.add(promise);
    void promise.finally(() => pending.delete(promise));
  }

  return {
    schedule<T>(recordType: PersistedRecordType, id: string, payload: T): void {
      const key = keyOf(recordType, id);
      clearPendingTimer(key);
      const mySequence = nextSequence(key);

      dueActions.set(key, () => {
        trackPending(attemptSave(key, recordType, id, payload, mySequence, 0));
      });
      timers.set(
        key,
        setTimeout(() => runDueAction(key), debounceMs),
      );
    },

    scheduleDelete(recordType: PersistedRecordType, id: string): void {
      const key = keyOf(recordType, id);
      clearPendingTimer(key);
      const mySequence = nextSequence(key);

      dueActions.set(key, () => {
        trackPending(attemptDelete(key, recordType, id, mySequence, 0));
      });
      timers.set(
        key,
        setTimeout(() => runDueAction(key), debounceMs),
      );
    },

    getState(recordType: PersistedRecordType, id: string): AutoSaveState {
      return states.get(keyOf(recordType, id)) ?? 'idle';
    },

    getErrors(recordType: PersistedRecordType, id: string): ApplicationError[] {
      return errorsByKey.get(keyOf(recordType, id)) ?? [];
    },

    subscribe(
      listener: (recordType: PersistedRecordType, id: string, state: AutoSaveState) => void,
    ): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    async flushAll(): Promise<void> {
      for (const key of Array.from(timers.keys())) {
        clearTimeout(timers.get(key));
        runDueAction(key);
      }
      // Draining `pending` needs to loop: an in-flight retry's own
      // `delay()` can schedule *another* pending promise after this
      // function has already started awaiting the current set.
      let previousSize = -1;
      while (pending.size > 0 && pending.size !== previousSize) {
        previousSize = pending.size;
        await Promise.all(Array.from(pending));
      }
    },
  };
}

/**
 * The shared default instance every Store uses — bound to the shared
 * `persistenceService` (itself backed by `LocalStorageAdapter`). Tests
 * build their own isolated `createAutoSaveCoordinator(customService)`
 * instance instead, the same pattern `persistence.service.ts` already
 * established for `persistenceService`/`createPersistenceService`.
 */
export const autoSaveCoordinator = createAutoSaveCoordinator(persistenceService);

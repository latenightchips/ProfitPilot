/**
 * Centralized local storage keys — 06_TASKS.md M8-007 ("Define Local
 * Storage Keys"). Requirement: "No feature should define storage keys
 * independently." DoD: "All keys use a consistent ProfitPilot namespace
 * and version convention."
 *
 * Only `./local-storage.adapter.ts` calls these — every feature/Store
 * reaches local storage exclusively through `PersistenceService`
 * (`../persistence.service.ts`), never by constructing or reading a raw
 * key itself.
 *
 * M8-007's own "Include" list names 8 key categories: "Application
 * metadata, Portfolios, Active portfolio, Simulations, Loop strategies,
 * Exit plans, Preferences, Sync state." Each maps directly onto one of
 * `../types/envelope.ts`'s `PERSISTED_RECORD_TYPES` — "Simulations" →
 * `'simulation'`, "Loop strategies" → `'loopStrategy'`, "Exit plans" →
 * `'exitPlan'`, "Sync state" → `'syncMetadata'` — so one key-building
 * function, parameterized by record type, covers every category without
 * a separate hand-written constant per category.
 */
import type { PersistedRecordType } from '../types/envelope';

export const LOCAL_STORAGE_NAMESPACE = 'profitpilot';

/**
 * The local storage *key naming scheme's* own version — deliberately a
 * separate concept from `STORAGE_SCHEMA_VERSION` (`../envelope.ts`),
 * which versions each record's own envelope/payload shape. This versions
 * the *key string format itself* (namespace/segments/separators), which
 * could need to change independently (e.g. a future key-collision fix)
 * without every stored record's schema version also changing.
 */
export const LOCAL_STORAGE_KEY_VERSION = 'v1';

const KEY_PREFIX = `${LOCAL_STORAGE_NAMESPACE}:${LOCAL_STORAGE_KEY_VERSION}`;

export function buildLocalStorageKey(recordType: PersistedRecordType, recordId: string): string {
  return `${KEY_PREFIX}:${recordType}:${recordId}`;
}

export function buildLocalStorageRecordTypePrefix(recordType: PersistedRecordType): string {
  return `${KEY_PREFIX}:${recordType}:`;
}

/**
 * Recovers `recordId` from a key already known to start with
 * `buildLocalStorageRecordTypePrefix(recordType)` — used by `list()`
 * (`./local-storage.adapter.ts`) when scanning every `localStorage` key
 * for a given record type.
 */
export function recordIdFromLocalStorageKey(key: string, recordType: PersistedRecordType): string {
  return key.slice(buildLocalStorageRecordTypePrefix(recordType).length);
}

/** True for any key this application owns — used by `clear()` to avoid touching unrelated `localStorage` entries. */
export function isProfitPilotLocalStorageKey(key: string): boolean {
  return key.startsWith(`${KEY_PREFIX}:`);
}

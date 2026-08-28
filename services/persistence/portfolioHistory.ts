/**
 * Portfolio History persistence — V1.1 Batch 2 ("Portfolio History &
 * Risk Timeline"). Mirrors `./recoverySnapshot.ts`'s own shape: every
 * entry is a real `'portfolioHistory'` record, written through
 * `PersistenceService` like everything else, keyed by its own
 * `crypto.randomUUID()` id — not a second, parallel storage mechanism,
 * and not an array nested inside one record (see `./types/models.ts`'s
 * own header comment on `PersistedPortfolioHistoryEntry` for why).
 *
 * **No per-portfolio index.** `listPortfolioHistoryForPortfolio` lists
 * every `'portfolioHistory'` record and filters by `portfolioId`
 * client-side — the same "small local-storage scale, filter after a
 * full list read" approach `./recoverySnapshot.ts` and every Store's own
 * `load()` already take. Introducing a secondary index would be new
 * infrastructure this application's actual data scale does not need.
 *
 * **Retention is capped globally, not per portfolio, generously.**
 * `MAX_RETAINED_PORTFOLIO_HISTORY_ENTRIES` (500) exists purely as a hard
 * safety ceiling against unbounded storage growth — unlike
 * `MAX_RETAINED_RECOVERY_SNAPSHOTS` (5), a small number is actively
 * counter to this feature's purpose (a timeline needs many points to be
 * useful). 500 comfortably covers years of realistic manual/interactive
 * usage; pruning removes the OLDEST entries application-wide once
 * exceeded, not per-portfolio, since a global cap is enough to bound
 * worst-case storage and a per-portfolio cap would need the same
 * list-and-filter work this module already avoids duplicating.
 */
import type { MappingResult } from '@/services/shared';

import type { PersistenceService } from './persistence.service';
import { persistenceService } from './persistence.service';
import type { PersistedPortfolioHistoryEntry, StorageEnvelope } from './types';

export const MAX_RETAINED_PORTFOLIO_HISTORY_ENTRIES = 500;

export async function recordPortfolioHistoryEntry(
  entry: PersistedPortfolioHistoryEntry,
  service: PersistenceService = persistenceService,
): Promise<MappingResult<StorageEnvelope<PersistedPortfolioHistoryEntry>>> {
  const written = await service.write('portfolioHistory', crypto.randomUUID(), entry);
  if (!written.ok) return written;

  await prunePortfolioHistory(service);
  return written;
}

/**
 * Most-recent-first — the order a timeline/table should present entries
 * in. Sorted by the payload's own `createdAt` (this feature's canonical
 * timestamp), not the envelope's, the same reasoning
 * `listRecoverySnapshots` already documents.
 */
export async function listPortfolioHistory(
  service: PersistenceService = persistenceService,
): Promise<MappingResult<StorageEnvelope<PersistedPortfolioHistoryEntry>[]>> {
  const listed = await service.listEnvelopes<PersistedPortfolioHistoryEntry>('portfolioHistory');
  if (!listed.ok) return listed;
  return {
    ok: true,
    data: [...listed.data].sort((a, b) => b.payload.createdAt.localeCompare(a.payload.createdAt)),
  };
}

export async function listPortfolioHistoryForPortfolio(
  portfolioId: string,
  service: PersistenceService = persistenceService,
): Promise<MappingResult<StorageEnvelope<PersistedPortfolioHistoryEntry>[]>> {
  const listed = await listPortfolioHistory(service);
  if (!listed.ok) return listed;
  return {
    ok: true,
    data: listed.data.filter((entry) => entry.payload.portfolioId === portfolioId),
  };
}

/**
 * The most recent entry for one portfolio, or `null` if it has none yet
 * — the one read `isMaterialPortfolioHistoryChange`
 * (`services/portfolioHistory/`) needs to decide whether a new snapshot
 * is worth recording.
 */
export async function readLatestPortfolioHistoryEntry(
  portfolioId: string,
  service: PersistenceService = persistenceService,
): Promise<MappingResult<PersistedPortfolioHistoryEntry | null>> {
  const listed = await listPortfolioHistoryForPortfolio(portfolioId, service);
  if (!listed.ok) return listed;
  return { ok: true, data: listed.data[0]?.payload ?? null };
}

/**
 * Deletes every history entry for one portfolio — called when that
 * portfolio itself is deleted (`stores/portfolioStore.ts`'s `delete`),
 * never on Archive (which retains data, matching Archive's own
 * documented semantics) or Duplicate (a duplicate starts with no history
 * of its own — it did not exist at any of its source portfolio's past
 * timestamps, so copying entries under its new id would misrepresent
 * them as its own history).
 */
export async function deletePortfolioHistoryForPortfolio(
  portfolioId: string,
  service: PersistenceService = persistenceService,
): Promise<MappingResult<void>> {
  const listed = await listPortfolioHistoryForPortfolio(portfolioId, service);
  if (!listed.ok) return listed;
  for (const entry of listed.data) {
    const deleted = await service.delete('portfolioHistory', entry.recordId);
    if (!deleted.ok) return deleted;
  }
  return { ok: true, data: undefined };
}

async function prunePortfolioHistory(service: PersistenceService): Promise<void> {
  const listed = await listPortfolioHistory(service);
  if (!listed.ok) return;
  const excess = listed.data.slice(MAX_RETAINED_PORTFOLIO_HISTORY_ENTRIES);
  for (const entry of excess) {
    await service.delete('portfolioHistory', entry.recordId);
  }
}

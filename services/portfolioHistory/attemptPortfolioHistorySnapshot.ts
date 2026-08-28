/**
 * Orchestrates one snapshot attempt — V1.1 Batch 2 ("Portfolio History &
 * Risk Timeline"). The one function `stores/portfolioStore.ts` calls
 * from each deliberate-action call site (see that file's own comments
 * for exactly which): build a candidate entry, compare it against the
 * portfolio's own most recent entry, and persist it only if
 * `isMaterialPortfolioHistoryChange` says it is worth keeping.
 *
 * **Deliberately async and fire-and-forget from the Store's own
 * perspective** — mirrors `schedulePortfolioSave`'s existing pattern
 * (`stores/portfolioStore.ts`): a Store action stays synchronous, and
 * this call is never awaited by it. A read (the portfolio's latest
 * entry) is required before the material-change decision can be made,
 * which a synchronous Zustand action body cannot do inline.
 */
import {
  readLatestPortfolioHistoryEntry,
  recordPortfolioHistoryEntry,
} from '@/services/persistence';
import type { ApplicationPortfolio, PortfolioSummary } from '@/services/portfolio';

import { buildPortfolioHistoryEntry } from './buildPortfolioHistoryEntry';
import { isMaterialPortfolioHistoryChange } from './isMaterialPortfolioHistoryChange';

export async function attemptPortfolioHistorySnapshot(
  portfolioId: string,
  portfolio: ApplicationPortfolio,
  summary: PortfolioSummary,
): Promise<void> {
  const candidate = buildPortfolioHistoryEntry(portfolioId, portfolio, summary);

  const latest = await readLatestPortfolioHistoryEntry(portfolioId);
  const previous = latest.ok ? latest.data : null;

  if (!isMaterialPortfolioHistoryChange(previous, candidate)) return;

  await recordPortfolioHistoryEntry(candidate);
}

/**
 * Deterministic material-change rule — V1.1 Batch 2 ("Portfolio History &
 * Risk Timeline"). Decides whether a freshly-built candidate entry is
 * different enough from the most recent existing entry to be worth
 * permanently recording, closing the "avoid duplicate snapshots when
 * nothing materially changed" requirement.
 *
 * **Deliberately threshold-based, not time-based.** No cooldown/minimum
 * interval is enforced — a snapshot attempt only ever reaches this check
 * from a genuinely deliberate action already (creation, an explicit
 * save, or an accepted live-data candidate; see
 * `stores/portfolioStore.ts`'s own call sites), never a raw refresh
 * tick, so "was this event deliberate" is already answered upstream.
 * This function only answers "did anything meaningful actually change,"
 * which must stay a pure function of the two entries' own values to
 * remain deterministic and testable — no `Date.now()`, no randomness.
 *
 * **Thresholds are absolute/relative value comparisons, not exact
 * equality**, so float noise (e.g. a live re-fetch of an unchanged price
 * that differs in the 6th decimal) never manufactures a spurious entry.
 * Any structural change (asset switched, collateral/debt quantity
 * changed at all, protocol version switched) is always material,
 * regardless of threshold — those are never "noise."
 */
import type { PersistedPortfolioHistoryEntry } from '@/services/persistence';

const HEALTH_FACTOR_ABSOLUTE_THRESHOLD = 0.01;
const MARKET_PRICE_RELATIVE_THRESHOLD = 0.005; // 0.5%
const LOAN_TO_VALUE_ABSOLUTE_THRESHOLD = 0.005; // 0.5 percentage points
const LEVERAGE_ABSOLUTE_THRESHOLD = 0.01;
const APR_ABSOLUTE_THRESHOLD = 0.001; // 0.1 percentage points
const LIQUIDATION_PRICE_RELATIVE_THRESHOLD = 0.005; // 0.5%
const INTEREST_COST_RELATIVE_THRESHOLD = 0.01; // 1%

function relativeChangeExceeds(before: number, after: number, threshold: number): boolean {
  if (before === after) return false;
  if (before === 0) return after !== 0;
  return Math.abs((after - before) / before) > threshold;
}

function absoluteChangeExceeds(before: number, after: number, threshold: number): boolean {
  return Math.abs(after - before) > threshold;
}

function aprChanged(before: number | undefined, after: number | undefined): boolean {
  if (before === undefined && after === undefined) return false;
  if (before === undefined || after === undefined) return true; // availability itself changed
  return absoluteChangeExceeds(before, after, APR_ABSOLUTE_THRESHOLD);
}

export function isMaterialPortfolioHistoryChange(
  previous: PersistedPortfolioHistoryEntry | null,
  next: PersistedPortfolioHistoryEntry,
): boolean {
  if (previous === null) return true;

  if (previous.protocolVersion !== next.protocolVersion) return true;
  if (previous.debt.asset !== next.debt.asset) return true;
  if (previous.collateral.quantity !== next.collateral.quantity) return true;
  if (previous.debt.quantity !== next.debt.quantity) return true;
  if ((previous.liquidationPriceUsd === null) !== (next.liquidationPriceUsd === null)) return true;

  // `null` here means "zero-debt, Health Factor is Infinity" (see
  // `services/persistence/types/models.ts`'s own comment) — a
  // finite<->null transition is always material, the same treatment
  // `liquidationPriceUsd` above already gets.
  if ((previous.healthFactor === null) !== (next.healthFactor === null)) return true;
  if (
    previous.healthFactor !== null &&
    next.healthFactor !== null &&
    absoluteChangeExceeds(
      previous.healthFactor,
      next.healthFactor,
      HEALTH_FACTOR_ABSOLUTE_THRESHOLD,
    )
  ) {
    return true;
  }
  if (
    relativeChangeExceeds(
      previous.marketPriceUsd,
      next.marketPriceUsd,
      MARKET_PRICE_RELATIVE_THRESHOLD,
    )
  ) {
    return true;
  }
  if (
    absoluteChangeExceeds(previous.loanToValue, next.loanToValue, LOAN_TO_VALUE_ABSOLUTE_THRESHOLD)
  ) {
    return true;
  }
  if (absoluteChangeExceeds(previous.leverage, next.leverage, LEVERAGE_ABSOLUTE_THRESHOLD)) {
    return true;
  }
  if (
    previous.liquidationPriceUsd !== null &&
    next.liquidationPriceUsd !== null &&
    relativeChangeExceeds(
      previous.liquidationPriceUsd,
      next.liquidationPriceUsd,
      LIQUIDATION_PRICE_RELATIVE_THRESHOLD,
    )
  ) {
    return true;
  }
  if (aprChanged(previous.borrowApr, next.borrowApr)) return true;
  if (aprChanged(previous.supplyApr, next.supplyApr)) return true;
  if (
    relativeChangeExceeds(
      previous.annualizedInterestCost,
      next.annualizedInterestCost,
      INTEREST_COST_RELATIVE_THRESHOLD,
    )
  ) {
    return true;
  }

  return false;
}

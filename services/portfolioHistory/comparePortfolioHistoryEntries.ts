/**
 * Before/after delta calculation — V1.1 Batch 2 ("Portfolio History &
 * Risk Timeline"). One centralized, deterministic function that turns
 * two entries into a set of named before/after/delta triples the History
 * UI renders directly, rather than each display component computing its
 * own subtraction.
 *
 * **States a change, never a cause.** Every field here is a plain
 * before/after/delta triple — nothing in this module's output or naming
 * implies why a value changed (a live price move, a manual edit, a
 * repayment) or that one metric's change caused another's, since only
 * correlation/co-occurrence in time is actually known from two
 * snapshots. `changed` is a boolean fact ("these differ"), not a claim
 * about causation.
 */
import type { PersistedPortfolioHistoryEntry } from '@/services/persistence';

import { calculateLiquidationBufferPercent } from './calculateLiquidationBufferPercent';

export interface PortfolioHistoryMetricDelta {
  before: number;
  after: number;
  delta: number;
  changed: boolean;
}

export interface PortfolioHistoryNullableMetricDelta {
  before: number | null;
  after: number | null;
  delta: number | null;
  changed: boolean;
}

export interface PortfolioHistoryOptionalMetricDelta {
  before: number | undefined;
  after: number | undefined;
  delta: number | undefined;
  changed: boolean;
}

export interface PortfolioHistoryComparison {
  /** `null` on either side means "zero-debt, Health Factor is Infinity" — see `PersistedPortfolioHistoryEntry.healthFactor`'s own comment. */
  healthFactor: PortfolioHistoryNullableMetricDelta;
  collateralValueUsd: PortfolioHistoryMetricDelta;
  debtValueUsd: PortfolioHistoryMetricDelta;
  loanToValue: PortfolioHistoryMetricDelta;
  leverage: PortfolioHistoryMetricDelta;
  marketPriceUsd: PortfolioHistoryMetricDelta;
  liquidationPriceUsd: PortfolioHistoryNullableMetricDelta;
  borrowApr: PortfolioHistoryOptionalMetricDelta;
  annualizedInterestCost: PortfolioHistoryMetricDelta;
  /** `null` on either side means "no liquidation risk" — see `calculateLiquidationBufferPercent`'s own comment. Not a Formula-ID'd Engine value. */
  liquidationBufferPercent: PortfolioHistoryNullableMetricDelta;
}

function metricDelta(before: number, after: number): PortfolioHistoryMetricDelta {
  return { before, after, delta: after - before, changed: before !== after };
}

function nullableMetricDelta(
  before: number | null,
  after: number | null,
): PortfolioHistoryNullableMetricDelta {
  return {
    before,
    after,
    delta: before !== null && after !== null ? after - before : null,
    changed: before !== after,
  };
}

function optionalMetricDelta(
  before: number | undefined,
  after: number | undefined,
): PortfolioHistoryOptionalMetricDelta {
  return {
    before,
    after,
    delta: before !== undefined && after !== undefined ? after - before : undefined,
    changed: before !== after,
  };
}

/**
 * `before`/`after` are taken as given — this function does not sort or
 * otherwise decide chronological order itself, matching how every other
 * caller in this codebase (`PreviewDiff`, V4 conflict panels) already
 * receives an explicit before/after pair rather than inferring one.
 */
export function comparePortfolioHistoryEntries(
  before: PersistedPortfolioHistoryEntry,
  after: PersistedPortfolioHistoryEntry,
): PortfolioHistoryComparison {
  return {
    healthFactor: nullableMetricDelta(before.healthFactor, after.healthFactor),
    collateralValueUsd: metricDelta(before.collateral.valueUsd, after.collateral.valueUsd),
    debtValueUsd: metricDelta(before.debt.valueUsd, after.debt.valueUsd),
    loanToValue: metricDelta(before.loanToValue, after.loanToValue),
    leverage: metricDelta(before.leverage, after.leverage),
    marketPriceUsd: metricDelta(before.marketPriceUsd, after.marketPriceUsd),
    liquidationPriceUsd: nullableMetricDelta(before.liquidationPriceUsd, after.liquidationPriceUsd),
    borrowApr: optionalMetricDelta(before.borrowApr, after.borrowApr),
    annualizedInterestCost: metricDelta(
      before.annualizedInterestCost,
      after.annualizedInterestCost,
    ),
    liquidationBufferPercent: nullableMetricDelta(
      calculateLiquidationBufferPercent(before.marketPriceUsd, before.liquidationPriceUsd),
      calculateLiquidationBufferPercent(after.marketPriceUsd, after.liquidationPriceUsd),
    ),
  };
}

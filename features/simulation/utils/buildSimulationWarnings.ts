import { normalizeMarketQuote } from '@/services';
import type { Portfolio } from '@/types/portfolio';

import type { SimulationWarning, UnavailableSimulationWarning } from '../types/simulationWarnings';
import { formatCurrency, formatDateTime, formatHealthFactor, formatLeverage } from './format';

/** Same local-formatter convention as `SimulationAssumptions.tsx`'s own `formatPercent` — this file has no React component to share it with. */
function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

/** Fixed, universal thresholds — see `../types/simulationWarnings.ts`'s own header comment for the reasoning behind each number; none is derived from `01_PRD.md`/`02_Formulas.md`/`04_BUILD_GUIDE.md`, which define none of them. */
const NEAR_LIQUIDATION_HEALTH_FACTOR = 1.1;
const AT_LIQUIDATION_HEALTH_FACTOR = 1.0;
const HIGH_LEVERAGE_THRESHOLD = 3;
const HIGH_BORROWING_COST_APR = 0.15;
const LONG_HOLDING_PERIOD_DAYS = 365;

/**
 * Simulation Warning builder — 06_TASKS.md M6-014 ("Implement
 * Simulation Warnings"). See `../types/simulationWarnings.ts` for the
 * full design reasoning (which 7 of the 8 now-documented cases are
 * built, and why "Invalid assumptions" remains structurally
 * unreachable).
 */
export const UNAVAILABLE_SIMULATION_WARNINGS: UnavailableSimulationWarning[] = [
  {
    item: 'invalidAssumptions',
    reason:
      'Structurally unreachable — scenario input validation already rejects every invalid field before a simulation runs.',
  },
];

export interface SimulationWarningInputs {
  healthFactor: number | null;
  equity: number | null;
  leverage: number | null;
  /** The Borrow APR actually being simulated — the active interest scenario's own rate, or the portfolio's real configured rate otherwise. Always a real number in practice (every caller has one or the other), typed nullable only for callers with genuinely nothing simulated yet. */
  borrowApr: number | null;
  /** Only non-null for an active interest scenario, which is the only case with a Holding Period assumption at all. */
  timeHorizonDays: number | null;
}

/**
 * Builds every real, non-invented Simulation Warning case from
 * already-computed simulated values and the portfolio's own real
 * configuration — never recalculated here. Every input is
 * caller-supplied (`ScenarioSummary`/`PortfolioSummary`/
 * `SimulationScenario` fields, whichever result is active) so this
 * function stays result-type-agnostic, the same "pass the value, not the
 * whole result" pattern already used elsewhere in this feature. Purely
 * informational — nothing here feeds back into or alters any calculated
 * result.
 */
export function buildSimulationWarnings(
  portfolio: Portfolio,
  inputs: SimulationWarningInputs,
): SimulationWarning[] {
  const { healthFactor, equity, leverage, borrowApr, timeHorizonDays } = inputs;
  const warnings: SimulationWarning[] = [];

  if (healthFactor !== null && Number.isFinite(healthFactor)) {
    if (healthFactor <= AT_LIQUIDATION_HEALTH_FACTOR) {
      warnings.push({
        code: 'AT_LIQUIDATION',
        reason: `The simulated Health Factor (${formatHealthFactor(healthFactor)}) is at or below the liquidation boundary of 1.00.`,
        potentialImpact:
          'At this Health Factor, the position is eligible for liquidation — collateral could be seized to repay the debt.',
      });
    } else if (healthFactor <= NEAR_LIQUIDATION_HEALTH_FACTOR) {
      warnings.push({
        code: 'NEAR_LIQUIDATION',
        reason: `The simulated Health Factor (${formatHealthFactor(healthFactor)}) is close to the liquidation boundary of 1.00.`,
        potentialImpact:
          'A small further price drop or additional interest accrual could push this position into liquidation.',
      });
    }

    const target = portfolio.settings.safetyTargets?.targetHealthFactor ?? null;
    if (target !== null && healthFactor < target) {
      warnings.push({
        code: 'UNSAFE_HEALTH_FACTOR',
        reason: `The simulated Health Factor (${formatHealthFactor(healthFactor)}) is below your configured target (${formatHealthFactor(target)}).`,
        potentialImpact:
          'A lower Health Factor means less buffer before liquidation — this scenario increases your risk of losing collateral if the market moves against you.',
      });
    }
  }

  if (equity !== null && Number.isFinite(equity) && equity < 0) {
    warnings.push({
      code: 'NEGATIVE_EQUITY',
      reason: `The simulated portfolio value (${formatCurrency(equity)}) is negative — debt exceeds collateral value.`,
      potentialImpact:
        'A negative net equity means the debt could not be fully repaid by selling all collateral at this price.',
    });
  }

  if (leverage !== null && Number.isFinite(leverage) && leverage >= HIGH_LEVERAGE_THRESHOLD) {
    warnings.push({
      code: 'HIGH_LEVERAGE',
      reason: `The simulated leverage (${formatLeverage(leverage)}) is unusually high.`,
      potentialImpact:
        'Higher leverage amplifies both gains and losses — a given price move changes your equity by a larger percentage than at lower leverage.',
    });
  }

  if (borrowApr !== null && Number.isFinite(borrowApr) && borrowApr >= HIGH_BORROWING_COST_APR) {
    warnings.push({
      code: 'HIGH_BORROWING_COST',
      reason: `The simulated Borrow APR (${formatPercent(borrowApr)}) is unusually high.`,
      potentialImpact:
        'A higher borrow rate increases the ongoing cost of holding this debt, which reduces net returns over time.',
    });
  }

  if (timeHorizonDays !== null && timeHorizonDays > LONG_HOLDING_PERIOD_DAYS) {
    warnings.push({
      code: 'LONG_HOLDING_PERIOD',
      reason: `The selected Holding Period (${Math.round(timeHorizonDays)} days) is longer than a year.`,
      potentialImpact:
        'Interest is projected using a simple, non-compounding formula — the further out this projection runs, the less precisely it reflects real-world compounding cost, and the more likely the assumed rate and price are to have changed by then.',
    });
  }

  const quote = normalizeMarketQuote({
    asset: portfolio.collateral.asset,
    currency: 'USD',
    candidates: [
      {
        origin: 'manual',
        price: portfolio.market.btcPriceUsd,
        timestamp: portfolio.marketUpdatedAt,
      },
    ],
    now: new Date().toISOString(),
  });
  if (quote.ok && quote.data.freshness === 'stale') {
    warnings.push({
      code: 'STALE_PRICES',
      reason: `The portfolio's own BTC price was last updated ${formatDateTime(portfolio.marketUpdatedAt)}, more than 5 minutes ago.`,
      potentialImpact:
        'This simulation is based on a potentially outdated market price — the real current risk may differ from what is shown.',
    });
  }

  return warnings;
}

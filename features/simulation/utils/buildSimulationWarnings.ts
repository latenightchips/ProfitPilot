import { normalizeMarketQuote } from '@/services';
import type { Portfolio } from '@/types/portfolio';

import type { SimulationWarning, UnavailableSimulationWarning } from '../types/simulationWarnings';
import { formatDateTime, formatHealthFactor } from './format';

/**
 * Simulation Warning builder — 06_TASKS.md M6-014 ("Implement
 * Simulation Warnings"). See `../types/simulationWarnings.ts` for the
 * full design reasoning (which 2 of the 6 documented cases are built,
 * and why the other 4 remain blocked or structurally unreachable).
 */
export const UNAVAILABLE_SIMULATION_WARNINGS: UnavailableSimulationWarning[] = [
  {
    item: 'nearLiquidation',
    reason:
      'No documented proximity threshold exists distinct from the disputed Health Factor risk bands (Conflict #1).',
  },
  {
    item: 'invalidAssumptions',
    reason:
      'Structurally unreachable — scenario input validation already rejects every invalid field before a simulation runs.',
  },
  {
    item: 'highLeverage',
    reason: 'No numeric leverage threshold exists anywhere in the specification.',
  },
  {
    item: 'highBorrowingCost',
    reason: 'No "acceptable" interest-cost threshold exists anywhere in the specification.',
  },
];

/**
 * Builds the 2 real, non-invented Simulation Warning cases from an
 * already-computed simulated Health Factor and the portfolio's own real
 * configuration — never a hand-picked threshold. `simulatedHealthFactor`
 * is caller-supplied (`ScenarioSummary.healthFactor` or
 * `PortfolioSummary.healthFactor`, whichever result is active) so this
 * function stays result-type-agnostic, the same "pass the value, not the
 * whole result" pattern already used elsewhere in this feature.
 */
export function buildSimulationWarnings(
  portfolio: Portfolio,
  simulatedHealthFactor: number | null,
): SimulationWarning[] {
  const warnings: SimulationWarning[] = [];

  const target = portfolio.settings.safetyTargets?.targetHealthFactor ?? null;
  if (
    target !== null &&
    simulatedHealthFactor !== null &&
    Number.isFinite(simulatedHealthFactor) &&
    simulatedHealthFactor < target
  ) {
    warnings.push({
      code: 'UNSAFE_HEALTH_FACTOR',
      reason: `The simulated Health Factor (${formatHealthFactor(simulatedHealthFactor)}) is below your configured target (${formatHealthFactor(target)}).`,
      potentialImpact:
        'A lower Health Factor means less buffer before liquidation — this scenario increases your risk of losing collateral if the market moves against you.',
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

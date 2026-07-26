/**
 * Portfolio Action Preview Service — 06_TASKS.md M3-006 ("Implement
 * Portfolio Action Preview Service"): "Preview the effect of portfolio
 * actions before saving them." DoD: "Each preview returns before-and-after
 * values and does not mutate the original portfolio."
 *
 * Batch 4's own scoping finding: this task is structurally
 * `calculatePortfolioSummary` (M3-005) called twice around a pure
 * portfolio transformation, not an independent calculation — the same
 * "snapshot, apply change, snapshot again" pattern
 * `engine/simulation/simulatePositionChange.ts` (M2-021) already uses at
 * the Engine layer for collateral/debt deltas, one layer up.
 *
 * `PortfolioAction` — 06_TASKS.md names exactly six actions with no
 * interface of its own. Approved shape: one variant per named action,
 * each carrying only the parameter it needs. No extensibility fields or
 * inferred behavior beyond the six named actions, per instruction.
 *
 * `applyAction` is a pure data transform (no Engine call, no validation
 * of its own) — the same category of operation as M3-004's mapping
 * functions. It does not need to check whether a withdrawal or repayment
 * exceeds what the portfolio holds: `calculateCollateralValue` and
 * `calculateDebtValue` already reject a negative `quantity`/`balance` via
 * `validateTokenQuantity` (`engine/validation/validate.ts`), so an
 * over-withdrawal or over-repayment surfaces naturally as a
 * `ServiceFailure` when the "after" summary is computed — duplicating
 * that check here would be inventing a second copy of validation the
 * Engine already owns.
 */
import type { ProtocolParameters } from '@/engine';

import type { ServiceResult } from '../shared/result';
import { createServiceSuccess } from '../shared/result';
import type { ApplicationPortfolio } from './models';
import { calculatePortfolioSummary, type PortfolioSummary } from './summary';

export type PortfolioAction =
  | { type: 'addCollateral'; quantity: number }
  | { type: 'withdrawCollateral'; quantity: number }
  | { type: 'borrow'; amount: number }
  | { type: 'repay'; amount: number }
  | { type: 'changeMarketPrice'; btcPriceUsd: number }
  | { type: 'changeProtocolParameters'; protocol: ProtocolParameters };

export interface PortfolioActionPreview {
  before: PortfolioSummary;
  after: PortfolioSummary;
}

function applyAction(
  portfolio: ApplicationPortfolio,
  action: PortfolioAction,
): ApplicationPortfolio {
  switch (action.type) {
    case 'addCollateral':
      return {
        ...portfolio,
        collateral: {
          ...portfolio.collateral,
          quantity: portfolio.collateral.quantity + action.quantity,
        },
      };
    case 'withdrawCollateral':
      return {
        ...portfolio,
        collateral: {
          ...portfolio.collateral,
          quantity: portfolio.collateral.quantity - action.quantity,
        },
      };
    case 'borrow':
      return {
        ...portfolio,
        debt: { ...portfolio.debt, balance: portfolio.debt.balance + action.amount },
      };
    case 'repay':
      return {
        ...portfolio,
        debt: { ...portfolio.debt, balance: portfolio.debt.balance - action.amount },
      };
    case 'changeMarketPrice':
      return { ...portfolio, market: { btcPriceUsd: action.btcPriceUsd } };
    case 'changeProtocolParameters':
      return { ...portfolio, protocol: action.protocol };
  }
}

/**
 * Previews a portfolio action — 06_TASKS.md M3-006. `sourceStatus` is
 * caller-supplied for the same reason as `calculatePortfolioSummary`
 * (M3-005): this Service has no source of its own to report.
 */
export function previewPortfolioAction(
  portfolio: ApplicationPortfolio,
  action: PortfolioAction,
  sourceStatus: string,
): ServiceResult<PortfolioActionPreview> {
  const beforeResult = calculatePortfolioSummary(portfolio, sourceStatus);
  if (!beforeResult.ok) return beforeResult;

  const afterPortfolio = applyAction(portfolio, action);
  const afterResult = calculatePortfolioSummary(afterPortfolio, sourceStatus);
  if (!afterResult.ok) return afterResult;

  return createServiceSuccess(
    { before: beforeResult.data, after: afterResult.data },
    {
      sourceStatus,
      engineVersion: afterResult.metadata.engineVersion,
      formulaVersion: afterResult.metadata.formulaVersion,
    },
    [...beforeResult.warnings, ...afterResult.warnings],
  );
}

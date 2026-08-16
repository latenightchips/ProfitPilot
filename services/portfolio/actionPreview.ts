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
 *
 * **V4 borrow/repay state (V4 Readiness Audit §12 Stage 11)** — the
 * `'borrow'`/`'repay'` cases below spread `...portfolio`, so a V4
 * portfolio's `v4DebtState` previously carried over completely UNCHANGED
 * regardless of `action.amount`: `mapApplicationPortfolioToEngineInput`
 * reads canonical V4 debt from `v4DebtState`, not `debt.balance`, so
 * these two actions' effect on debt was silently invisible to the
 * "after" summary for any V4 portfolio. Fixed via
 * `deriveV4DebtStateAfterDelta` (`services/portfolio/mapping.ts`, Stage
 * 11) — see that function's own doc comment for exactly which cases it
 * resolves versus deliberately leaves undefined (never inventing a
 * drawn/premium allocation policy). The other four action types don't
 * touch `debt` at all, so `v4DebtState` staying unchanged via the spread
 * is already correct for them — no change needed there.
 */
import type { ProtocolParameters } from '@/engine';

import type { ServiceResult } from '../shared/result';
import { createServiceSuccess } from '../shared/result';
import { deriveV4DebtStateAfterDelta } from './mapping';
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
        ...(portfolio.protocolVersion === 'v4' &&
          portfolio.v4DebtState !== undefined && {
            v4DebtState: deriveV4DebtStateAfterDelta(portfolio.v4DebtState, action.amount),
          }),
      };
    case 'repay':
      return {
        ...portfolio,
        debt: { ...portfolio.debt, balance: portfolio.debt.balance - action.amount },
        ...(portfolio.protocolVersion === 'v4' &&
          portfolio.v4DebtState !== undefined && {
            v4DebtState: deriveV4DebtStateAfterDelta(portfolio.v4DebtState, -action.amount),
          }),
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

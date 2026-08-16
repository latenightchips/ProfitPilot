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
 * `applyAction` is mostly a pure data transform (no Engine call, no
 * validation of its own) — the same category of operation as M3-004's
 * mapping functions — for four of its six cases. It does not need to
 * check whether a withdrawal or repayment exceeds what the portfolio
 * holds: `calculateCollateralValue` and `calculateDebtValue` already
 * reject a negative `quantity`/`balance` via `validateTokenQuantity`
 * (`engine/validation/validate.ts`), so an over-withdrawal or
 * over-repayment surfaces naturally as a `ServiceFailure` when the
 * "after" summary is computed — duplicating that check here would be
 * inventing a second copy of validation the Engine already owns.
 *
 * **V4 borrow/repay state (V4 Readiness Audit §12 Stage 11, resolved
 * with a real protocol-backed rule at Stage 12)** — the `'borrow'`/
 * `'repay'` cases previously spread `...portfolio`, so a V4 portfolio's
 * `v4DebtState` carried over completely UNCHANGED regardless of
 * `action.amount`: `mapApplicationPortfolioToEngineInput` reads canonical
 * V4 debt from `v4DebtState`, not `debt.balance`, so these two actions'
 * effect on debt was silently invisible to the "after" summary for any
 * V4 portfolio. Fixed via `deriveV4DebtStateAfterDelta`
 * (`services/portfolio/mapping.ts`) — which now calls the real Engine
 * formula (`engine/protocols/aaveV4/deriveDebtAfterRepayment.ts`, Stage
 * 12) for a `'repay'`, deterministically splitting the amount between
 * `drawnDebt`/`premiumDebt` (premium first, then drawn — ported directly
 * from `aave/aave-v4`'s own `calculateRestoreAmount`), and returns a
 * `FormulaStep` this file now composes exactly like every other Engine
 * call, propagating a failure instead of ignoring it. A `'borrow'`
 * remains genuinely ambiguous (see that function's own doc comment: it
 * requires the user's full multi-collateral Risk Premium recomputation,
 * data this codebase's domain model has never captured) and still fails
 * closed via the existing Stage 9/10 `AAVE_V4_DEBT_STATE_MISSING` guard.
 * The other four action types don't touch `debt` at all, so `v4DebtState`
 * staying unchanged via the spread is already correct for them — no
 * Engine call needed there, so they pass the caller's own `tracked`
 * through unchanged.
 */
import type { ProtocolParameters } from '@/engine';

import type { FormulaStep, TrackedFormulaVersion } from '../shared/formulaStep';
import type { ServiceResult, ServiceWarning } from '../shared/result';
import { createServiceSuccess } from '../shared/result';
import { deriveV4DebtStateAfterDelta } from './mapping';
import type { AaveV4DebtState, ApplicationPortfolio } from './models';
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

/**
 * Applies a debt-changing action (`'borrow'`/`'repay'`, `debtDelta`
 * positive/negative respectively) — the one case among the six actions
 * that may need a real Engine call (a V4 repay) and may therefore fail.
 */
function applyDebtDelta(
  portfolio: ApplicationPortfolio,
  debtDelta: number,
  tracked: TrackedFormulaVersion,
  sourceStatus: string,
): FormulaStep<ApplicationPortfolio> {
  let afterV4DebtState: AaveV4DebtState | undefined;
  let nextTracked = tracked;
  const warnings: ServiceWarning[] = [];

  if (portfolio.protocolVersion === 'v4' && portfolio.v4DebtState !== undefined) {
    const v4DebtStateStep = deriveV4DebtStateAfterDelta(
      portfolio.v4DebtState,
      debtDelta,
      tracked,
      sourceStatus,
    );
    if (!v4DebtStateStep.ok) return v4DebtStateStep;
    nextTracked = v4DebtStateStep.tracked;
    warnings.push(...v4DebtStateStep.warnings);
    afterV4DebtState = v4DebtStateStep.value;
  }

  return {
    ok: true,
    value: {
      ...portfolio,
      debt: { ...portfolio.debt, balance: portfolio.debt.balance + debtDelta },
      ...(portfolio.protocolVersion === 'v4' &&
        portfolio.v4DebtState !== undefined && { v4DebtState: afterV4DebtState }),
    },
    tracked: nextTracked,
    warnings,
  };
}

function applyAction(
  portfolio: ApplicationPortfolio,
  action: PortfolioAction,
  tracked: TrackedFormulaVersion,
  sourceStatus: string,
): FormulaStep<ApplicationPortfolio> {
  switch (action.type) {
    case 'addCollateral':
      return {
        ok: true,
        value: {
          ...portfolio,
          collateral: {
            ...portfolio.collateral,
            quantity: portfolio.collateral.quantity + action.quantity,
          },
        },
        tracked,
        warnings: [],
      };
    case 'withdrawCollateral':
      return {
        ok: true,
        value: {
          ...portfolio,
          collateral: {
            ...portfolio.collateral,
            quantity: portfolio.collateral.quantity - action.quantity,
          },
        },
        tracked,
        warnings: [],
      };
    case 'borrow':
      return applyDebtDelta(portfolio, action.amount, tracked, sourceStatus);
    case 'repay':
      return applyDebtDelta(portfolio, -action.amount, tracked, sourceStatus);
    case 'changeMarketPrice':
      return {
        ok: true,
        value: { ...portfolio, market: { btcPriceUsd: action.btcPriceUsd } },
        tracked,
        warnings: [],
      };
    case 'changeProtocolParameters':
      return {
        ok: true,
        value: { ...portfolio, protocol: action.protocol },
        tracked,
        warnings: [],
      };
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

  const applyStep = applyAction(
    portfolio,
    action,
    {
      engineVersion: beforeResult.metadata.engineVersion,
      formulaVersion: beforeResult.metadata.formulaVersion,
    },
    sourceStatus,
  );
  if (!applyStep.ok) return applyStep.failure;

  const afterResult = calculatePortfolioSummary(applyStep.value, sourceStatus);
  if (!afterResult.ok) return afterResult;

  return createServiceSuccess(
    { before: beforeResult.data, after: afterResult.data },
    {
      sourceStatus,
      engineVersion: afterResult.metadata.engineVersion,
      formulaVersion: afterResult.metadata.formulaVersion,
    },
    [...beforeResult.warnings, ...applyStep.warnings, ...afterResult.warnings],
  );
}

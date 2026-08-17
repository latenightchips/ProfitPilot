/**
 * Borrow Capacity Service — V4 Readiness Audit §12 Stage 23D.
 *
 * Wraps `calculateAdditionalBorrow` (F-027, "Maximum Additional Debt") with
 * the same protocol-aware risk-capacity dispatch `calculatePortfolioSummary`
 * (`./summary.ts`) now applies to Health Factor and liquidation price/
 * distance/buffer: V3 uses `protocol.liquidationThreshold`, unchanged; V4
 * uses `v4CollateralRisk.collateralFactor` (Stage 23B/23C), never a reuse of
 * the V3 field. F-027 itself is genuinely generic — same reasoning as
 * `calculateHealthFactor`/`calculateLiquidationPrice`/`Distance`/`Buffer`
 * (see `./mapping.ts`'s `resolveRiskCapacityFraction` doc comment) — so no
 * Engine change is needed here either, only which value this Service passes
 * in.
 *
 * **New Service-layer wiring, not a fix to an existing scattered call
 * site.** `calculateAdditionalBorrow` has no existing `services/` caller
 * today — it's used only internally inside `engine/recommendation/*`/
 * `engine/exit/*`. This function is Stage 23D's "smallest coherent
 * implementation necessary for maximum borrow/borrow capacity," ready for a
 * later consumer stage to wire into Loop Builder/Recommendations, not a
 * dispatch retrofit onto pre-existing UI-facing code.
 *
 * **Reuses `calculatePortfolioSummary` for `collateralValue`/`debtValue`
 * rather than re-deriving them.** This means the V4 `checkAaveV4DebtStateAvailable`
 * and `checkAaveV4CollateralRiskAvailable` fail-closed guards are inherited
 * automatically — a V4 portfolio missing either live debt or collateral-risk
 * state fails here exactly as it would summarizing the portfolio at all,
 * with no separate guard call needed in this file.
 *
 * **Hypothetical states remain possible.** Like `calculatePortfolioSummary`
 * itself, this performs only local Engine calculation from the
 * `ApplicationPortfolio` passed in — no RPC call, no `getUserAccountData()`
 * dependency. A caller previewing a hypothetical collateral/debt change
 * (e.g. Loop Builder simulating an additional supply) can pass a locally
 * modified portfolio and get a correct answer without any live chain read.
 */
import { calculateAdditionalBorrow } from '@/engine';

import { formulaStep as step, optionsFromTracked as optionsFrom } from '../shared/formulaStep';
import { createServiceSuccess, type ServiceResult } from '../shared/result';
import { resolveRiskCapacityFraction } from './mapping';
import type { ApplicationPortfolio } from './models';
import { calculatePortfolioSummary } from './summary';

/**
 * Maximum additional debt a portfolio can safely take on while keeping
 * Health Factor at or above `targetHealthFactor` — dispatches the
 * underlying risk-capacity parameter by `portfolio.protocolVersion`. The
 * result is signed: positive means additional safe borrowing is available;
 * negative means debt must be repaid by that amount to reach the target.
 *
 * Fails closed (via `calculatePortfolioSummary`'s own guards) for a V4
 * portfolio missing synced `v4DebtState` or `v4CollateralRisk` — never
 * silently substitutes V3 semantics for either.
 */
export function calculateMaxAdditionalBorrow(
  portfolio: ApplicationPortfolio,
  targetHealthFactor: number,
  sourceStatus: string,
): ServiceResult<number> {
  const summaryResult = calculatePortfolioSummary(portfolio, sourceStatus);
  if (!summaryResult.ok) return summaryResult;

  // Non-null by construction: `summaryResult.ok` above already proves
  // `calculatePortfolioSummary` passed its own `checkAaveV4CollateralRiskAvailable`
  // guard for this exact portfolio, so a V4 portfolio reaching this line is
  // guaranteed to have `v4CollateralRisk` present.
  const riskCapacityFraction = resolveRiskCapacityFraction(portfolio)!;

  const tracked = {
    engineVersion: summaryResult.metadata.engineVersion,
    formulaVersion: summaryResult.metadata.formulaVersion,
  };

  const additionalBorrowStep = step(
    calculateAdditionalBorrow(
      summaryResult.data.collateralValue,
      riskCapacityFraction,
      summaryResult.data.debtValue,
      targetHealthFactor,
    ),
    tracked,
    sourceStatus,
  );
  if (!additionalBorrowStep.ok) return additionalBorrowStep.failure;

  return createServiceSuccess(
    additionalBorrowStep.value,
    optionsFrom(sourceStatus, additionalBorrowStep.tracked),
    [...summaryResult.warnings, ...additionalBorrowStep.warnings],
  );
}

import { createFailure, type FormulaResult } from '../../shared/result';

/**
 * Aave V4 debt projection — V4 Readiness Audit §12 Stage 1 ("protocol
 * boundary scaffolding only"). The audit (§3, "Exact-number parity")
 * established that V4's debt accrual is structurally different from V3's:
 * a linear-interest drawn-rate index (`MathUtils.calculateLinearInterest`)
 * plus a separate, per-user Risk Premium stream
 * (`Premium.calculatePremiumRay`) — not V3's binomial compounded curve
 * (`engine/protocols/aaveV3/math.ts`). Porting that math is out of scope
 * for this stage.
 *
 * This module exists so `engine/protocols/index.ts`'s registry has a real,
 * typed V4 entry to dispatch to — never a fallback to V3's math, never a
 * placeholder financial value. Every call fails closed with a structured,
 * non-retryable `FormulaResult` error, exactly like any other Engine
 * failure a Service composition already knows how to propagate.
 */
const FORMULA_ID = 'AAVE-V4-UNSUPPORTED';
const FORMULA_VERSION = '1.0';

export function projectVariableDebt(
  currentDebt: number,
  borrowApr: number,
  elapsedDays: number,
): FormulaResult<number> {
  return createFailure(
    {
      code: 'AAVE_V4_PROJECTION_NOT_IMPLEMENTED',
      message:
        "Aave V4 debt projection is not implemented yet. V4 uses a different accrual model than V3 (a linear-interest drawn-rate index plus a separate risk-premium stream) and must not be approximated with V3's compounding formula.",
    },
    {
      formulaId: FORMULA_ID,
      formulaVersion: FORMULA_VERSION,
      inputsUsed: { currentDebt, borrowApr, elapsedDays },
    },
  );
}

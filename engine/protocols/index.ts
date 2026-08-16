import { createFailure, type FormulaResult } from '../shared/result';
import { projectVariableDebt as projectAaveV3Debt } from './aaveV3';
import { projectAaveV4Debt } from './aaveV4';
import type {
  AaveV3DebtProjectionRequest,
  AaveV4DebtProjection,
  AaveV4DebtProjectionRequest,
  ProtocolDebtProjectionRequest,
} from './types';

export type {
  AaveProtocolVersion,
  AaveV3DebtProjectionRequest,
  AaveV4DebtProjection,
  AaveV4DebtProjectionRequest,
  ProtocolDebtProjectionRequest,
} from './types';

/**
 * V4 repayment allocation (Stage 12) — re-exported here alongside the
 * dispatcher for the same reason `projectVariableDebt` (V3) is re-exported
 * from `../index.ts`: no V3 equivalent exists (V3 has no premium stream
 * to allocate a repayment against), so there is nothing to dispatch on.
 * See `./aaveV4/deriveDebtAfterRepayment.ts` for the full reasoning.
 */
export { type AaveV4RepaymentInput, deriveAaveV4DebtAfterRepayment } from './aaveV4';

/**
 * Centralized protocol/version dispatch for debt projection — V4 Readiness
 * Audit §12. Stage 1 built this as the one place that resolves "which
 * protocol-version's math to run" from an explicit `AaveProtocolVersion`,
 * closing the gap where `services/simulation/scenario.ts` previously
 * imported `projectVariableDebt` from `./aaveV3` directly. Stage 2 keeps
 * that same single dispatch point — no scattered version checks were added
 * anywhere else — while giving V4 a real, richer request/response shape
 * instead of forcing it through V3's 3-field `(currentDebt, borrowApr,
 * elapsedDays)` signature (`./types.ts`'s own doc comments explain why V3
 * and V4 need genuinely different shapes).
 *
 * A `Record<AaveProtocolVersion, DebtProjector>` (Stage 1's approach) no
 * longer type-checks once V3 and V4 have different input/output shapes —
 * a uniform function type can't describe both. Two overload signatures
 * plus a discriminated-union runtime implementation achieve the same
 * "every version is explicitly handled, TypeScript enforces it" property:
 * a caller passing an `AaveV3DebtProjectionRequest` still gets back
 * `FormulaResult<number>`, byte-identical to every call before Stage 2; a
 * caller passing an `AaveV4DebtProjectionRequest` gets
 * `FormulaResult<AaveV4DebtProjection>`. `protocolVersion` is the
 * discriminant on both the input union and each overload.
 *
 * A third, union-typed overload is declared below the two literal-typed
 * ones purely for callers that only statically know
 * `ProtocolDebtProjectionRequest` (e.g. a value narrowed at runtime from
 * unvalidated/legacy data via `as unknown as ProtocolDebtProjectionRequest`
 * in a test) — TypeScript does not automatically let a union-typed
 * argument satisfy a set of overloads declared only for its individual
 * members. Real call sites with a literal `protocolVersion` (every
 * production caller) still resolve to one of the two specific overloads
 * above it, in declaration order.
 */
export function projectProtocolDebt(request: AaveV3DebtProjectionRequest): FormulaResult<number>;
export function projectProtocolDebt(
  request: AaveV4DebtProjectionRequest,
): FormulaResult<AaveV4DebtProjection>;
export function projectProtocolDebt(
  request: ProtocolDebtProjectionRequest,
): FormulaResult<number> | FormulaResult<AaveV4DebtProjection>;
export function projectProtocolDebt(
  request: ProtocolDebtProjectionRequest,
): FormulaResult<number> | FormulaResult<AaveV4DebtProjection> {
  if (request.protocolVersion === 'v3') {
    return projectAaveV3Debt(request.currentDebt, request.borrowApr, request.elapsedDays);
  }
  if (request.protocolVersion === 'v4') {
    return projectAaveV4Debt(request);
  }
  const unrecognizedRequest = request as Record<string, unknown>;
  return createFailure(
    {
      code: 'PROTOCOL_VERSION_UNSUPPORTED',
      message: `No debt-projection implementation is registered for Aave protocol version "${String(unrecognizedRequest.protocolVersion)}".`,
    },
    {
      formulaId: 'AAVE-PROTOCOL-DISPATCH',
      formulaVersion: '1.0',
      inputsUsed: { ...unrecognizedRequest },
    },
  );
}

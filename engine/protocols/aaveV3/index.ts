/**
 * Aave V3 protocol-specific accrual semantics — isolated from the generic,
 * spec-driven formula categories elsewhere in the Engine. Only
 * `projectVariableDebt` is public; `math.ts`'s `calculateCompoundedInterest`/
 * `rayMul` are internal plumbing (own unit tests import them directly, the
 * same pattern `engine/validation/validate.ts` already uses).
 */
export { projectVariableDebt } from './projectVariableDebt';

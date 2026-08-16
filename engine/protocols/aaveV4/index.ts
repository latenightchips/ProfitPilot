/**
 * Aave V4 protocol module — public barrel. V4 Readiness Audit §12 Stage 2
 * ("real V4 math engine"), replacing Stage 1's explicit
 * not-implemented boundary (`AAVE_V4_PROJECTION_NOT_IMPLEMENTED`) with the
 * real drawn + risk-premium debt-projection math ported from `aave/aave-v4`
 * (see `./projectAaveV4Debt.ts` and `./math.ts` for exact source
 * citations).
 *
 * `./math.ts`'s `calculateLinearInterest`/`rayMulUp`/`RAY`/`SECONDS_PER_YEAR`
 * stay internal to this protocol module, mirroring `../aaveV3`'s own
 * pattern of not exposing its low-level math helpers past its own barrel.
 *
 * `deriveAaveV4DebtAfterRepayment` (Stage 12) added alongside
 * `projectAaveV4Debt` — a genuinely different operation (repayment
 * allocation, not time-based projection) with no V3 equivalent, so it
 * does not go through `projectProtocolDebt`'s dispatch. See its own file
 * for the exact `aave/aave-v4` source citations.
 */
export {
  type AaveV4RepaymentInput,
  deriveAaveV4DebtAfterRepayment,
} from './deriveDebtAfterRepayment';
export { type AaveV4DebtProjectionInput, projectAaveV4Debt } from './projectAaveV4Debt';

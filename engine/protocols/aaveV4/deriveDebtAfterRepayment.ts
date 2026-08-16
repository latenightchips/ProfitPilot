import { Decimal, toOutputNumber } from '../../shared/decimal';
import { createFailure, createSuccess, type FormulaResult } from '../../shared/result';
import { validateNonNegative } from '../../validation/validate';
import type { AaveV4DebtProjection } from '../types';

/**
 * Aave V4 repayment allocation — V4 Readiness Audit §12 Stage 12.
 * Determines exactly how a repayment amount splits between `drawnDebt`
 * and `premiumDebt`, ported algebraically from the authoritative on-chain
 * behavior (`aave/aave-v4`, `src/spoke/Spoke.sol`'s `repay` and
 * `src/spoke/libraries/UserPositionUtils.sol`'s `calculateRestoreAmount`,
 * read directly from the public repository, commit as of 2026-08-16):
 *
 * ```solidity
 * // UserPositionUtils.sol — calculateRestoreAmount
 * function calculateRestoreAmount(
 *     ISpoke.UserPosition storage userPosition,
 *     uint256 drawnIndex,
 *     uint256 amount
 *   ) internal view returns (uint256, uint256) {
 *     (uint256 drawnDebt, uint256 premiumDebtRay) = userPosition.getDebt(drawnIndex);
 *     uint256 premiumDebt = premiumDebtRay.fromRayUp();
 *     if (amount >= drawnDebt + premiumDebt) {
 *       return (drawnDebt, premiumDebtRay);
 *     }
 *     if (amount < premiumDebt) {
 *       uint256 amountRay = amount.toRay();
 *       return (0, amountRay);
 *     }
 *     return (amount - premiumDebt, premiumDebtRay);
 *   }
 * ```
 *
 * Reading the three branches: a repayment is applied to **premium debt
 * FIRST, then drawn debt with the remainder** — never proportionally,
 * never drawn-first:
 *   - `amount >= total`: both streams fully cleared (a full repayment).
 *   - `amount < premiumDebt`: the entire payment reduces premium debt;
 *     drawn debt is untouched.
 *   - otherwise: premium debt is fully cleared, and the remainder
 *     (`amount - premiumDebt`) reduces drawn debt.
 *
 * Collapsing those three branches into one formula (this module's own
 * `Decimal.min`-based implementation below) rather than porting the
 * if/else structure literally is NOT a simplification that changes
 * behavior — `min(repaid, premiumDebt)` / `repaid - premiumRestored`
 * produce byte-identical splits to all three Solidity branches; only the
 * uint256-vs-Decimal representation differs, the same "amounts not raw
 * shares" boundary `./projectAaveV4Debt.ts` already draws for its own
 * dollar-denominated `AaveV4DebtProjectionInput`.
 *
 * **`riskPremium` is deliberately NOT a parameter here — and deliberately
 * NOT read from the caller's persisted state either — because it is
 * genuinely UNCHANGED by a repayment.** `Spoke.sol`'s `repay` function
 * never calls `_notifyRiskPremiumUpdate` (confirmed by reading the
 * function body directly — only `borrow`/`withdraw`/`liquidationCall`/
 * `setUsingAsCollateral`/`updateUserRiskPremium`/`updateUserDynamicConfig`
 * do, per `docs/overview.md`'s own "Actions that trigger a premium
 * refresh" list and `infrastructure/protocols/aave/v4/abi.ts`'s existing
 * `spokeGetUserLastRiskPremiumAbi` doc comment). `calculatePremiumDelta`
 * (called by `repay` immediately after `calculateRestoreAmount`) rebases
 * `premiumShares`/`premiumOffsetRay` around the NEW `drawnShares` using
 * the position's EXISTING, unchanged `riskPremium` — a share/index
 * representation change with zero effect on the resulting dollar-amount
 * `premiumDebt`, which this function already computes correctly via the
 * premium-first allocation above. `baseDrawnApr` is a Hub-level asset
 * parameter no user action ever changes. Callers carry both fields
 * forward on the `AaveV4DebtState` they already have — this function
 * only needs to return what changes: `drawnDebt`/`premiumDebt`.
 *
 * **Deliberately NOT extended to cover a borrow.** `Spoke.sol`'s `borrow`
 * DOES call `_notifyRiskPremiumUpdate`, driven by
 * `_refreshAndValidateUserAccountData`'s freshly-recomputed Risk Premium
 * — `docs/overview.md`'s "Risk Premium Algorithm" section requires the
 * user's ENTIRE collateral set (sorted by Collateral Risk, weighted by
 * value: `RP_u = Σ(CR_i·C_i·P_i) / Σ(C_i·P_i)`), data this codebase's
 * single-BTC-collateral domain model has never captured, not even
 * partially (`AaveV4DebtProjectionInput.riskPremium`'s own doc comment
 * already documents this as "Not implemented"). A post-borrow
 * `riskPremium` (and therefore post-borrow `premiumDebt`) is genuinely
 * NOT locally derivable — no formula belongs here for it. See
 * `services/portfolio/mapping.ts`'s `deriveV4DebtStateAfterDelta` (Stage
 * 11, updated Stage 12) for where this stays fail-closed.
 */
const FORMULA_ID = 'AAVE-V4-REPAYMENT-ALLOCATION';
const FORMULA_VERSION = '1.0';

export interface AaveV4RepaymentInput {
  /** Current drawn (base) debt balance, in dollars, before this repayment. */
  drawnDebt: number;
  /** Current premium debt balance, in dollars, before this repayment. */
  premiumDebt: number;
  /** The dollar amount being repaid. Capped at `drawnDebt + premiumDebt` — an over-repayment fully clears both, exactly like the Solidity `amount >= total` branch. */
  repaymentAmount: number;
}

/**
 * Derives the exact post-repayment `drawnDebt`/`premiumDebt` split for a
 * V4 position — premium debt first, then drawn debt with the remainder.
 * Invalid inputs (negative balances/amount) fail closed with a structured
 * `FormulaResult` error, exactly like every other Engine formula.
 */
export function deriveAaveV4DebtAfterRepayment(
  input: AaveV4RepaymentInput,
): FormulaResult<AaveV4DebtProjection> {
  const options = {
    formulaId: FORMULA_ID,
    formulaVersion: FORMULA_VERSION,
    inputsUsed: { ...input },
  };

  const drawnDebt = validateNonNegative(input.drawnDebt, 'drawnDebt');
  if (!drawnDebt.ok) return createFailure(drawnDebt.error, options);

  const premiumDebt = validateNonNegative(input.premiumDebt, 'premiumDebt');
  if (!premiumDebt.ok) return createFailure(premiumDebt.error, options);

  const repaymentAmount = validateNonNegative(input.repaymentAmount, 'repaymentAmount');
  if (!repaymentAmount.ok) return createFailure(repaymentAmount.error, options);

  const totalDebt = drawnDebt.value.plus(premiumDebt.value);
  const repaid = Decimal.min(repaymentAmount.value, totalDebt);
  const premiumRestored = Decimal.min(repaid, premiumDebt.value);
  const drawnRestored = repaid.minus(premiumRestored);

  const newDrawnDebt = drawnDebt.value.minus(drawnRestored);
  const newPremiumDebt = premiumDebt.value.minus(premiumRestored);

  return createSuccess(
    {
      drawnDebt: toOutputNumber(newDrawnDebt),
      premiumDebt: toOutputNumber(newPremiumDebt),
      totalDebt: toOutputNumber(newDrawnDebt.plus(newPremiumDebt)),
    },
    options,
  );
}

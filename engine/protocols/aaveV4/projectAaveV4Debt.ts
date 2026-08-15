import { Decimal, toOutputNumber } from '../../shared/decimal';
import { createFailure, createSuccess, type FormulaResult } from '../../shared/result';
import { validateNonNegative, validateRate, validateTimePeriod } from '../../validation/validate';
import type { AaveV4DebtProjection } from '../types';
import { calculateLinearInterest, RAY, rayMulUp } from './math';

/**
 * Aave V4 drawn + risk-premium debt projection — V4 Readiness Audit §12
 * Stage 2 (hardened per the Stage 2 adversarial review). Projects the
 * two-stream accrual model documented in `docs/overview.md`'s "Interest
 * Accrual" section, cross-derived algebraically from the authoritative
 * per-user accounting (`aave/aave-v4` commit
 * 2524fe4018a42750300e114f2a8c4355df62a878):
 *
 *   `src/spoke/libraries/UserPositionUtils.sol`'s `getDebt`:
 *     drawnDebt(t)   = drawnShares · drawnIndex(t)                      [rayMulUp]
 *     premiumDebt(t) = premiumShares · drawnIndex(t) − premiumOffsetRay [Premium.calculatePremiumRay]
 *
 * `ISpoke.UserPosition` carries no per-user timestamp — both streams grow
 * off the same asset-level `drawnIndex(t)`, so a single `elapsedDays`
 * driving both is structurally correct, not a simplification.
 *
 * **A. Exact ports** (no algebra, no assumptions — see `./math.ts`):
 *   - `MathUtils.calculateLinearInterest` → this module's `growthFactorRay`
 *   - `WadRayMath.rayMulUp` → used for `newDrawnDebtRay` exactly as
 *     `AssetLogic.drawn()`/`toDrawnAssetsUp()` use it on-chain.
 *
 * **B. Derived projection** (algebra on top of the exact ports above, NOT
 * a literal Solidity operation): holding `premiumShares`/`premiumOffsetRay`
 * fixed (i.e. no `refreshPremium` during the projected window — the
 * correct assumption for a "no further position action" projection),
 *
 *   premiumDebt(t) = premiumShares·drawnIndex(t0)·(growthFactor(t)−1) + premiumDebt(t0)
 *
 * Substituting `premiumShares·drawnIndex(t0) ≈ riskPremium · drawnDebt(t0)`
 * (true when `premiumShares` was last set via `drawnShares.percentMulUp(riskPremium)`
 * — see the `riskPremium` contract below) collapses this to:
 *
 *   premiumDebt(t) ≈ premiumDebt(t0) + riskPremium · drawnInterestAccrued(t0→t)
 *
 * matching `docs/overview.md`'s own stated recurrence (line ~193:
 * `D_premium(t) = D_premium(t-1) + R_base·RP_u·D_base(t-1)`), extended
 * from one accrual step to the whole `elapsedDays` horizon under the same
 * "hold rate constant over the projection window" assumption V3's own
 * `borrowApr` parameter already makes. This module implements that
 * derived relationship as `rayMulUp(drawnInterestAccruedRay,
 * riskPremiumRay)` — a reformulation chosen for consistency with the
 * codebase's general "round up amounts owed" convention, NOT a port of a
 * named Solidity function; `Premium.calculatePremiumRay` itself performs
 * a plain multiply-then-subtract with no `rayMulUp` step. Do not cite
 * this line as a 1:1 Solidity port.
 *
 * **No single "normalized debt" output** — see `../types.ts`'s own
 * `AaveV4DebtProjection` comment for why drawn and premium are returned
 * separately rather than fabricated into one blended figure.
 *
 * **Not implemented: the Risk Premium Algorithm** — the multi-collateral,
 * sorted-by-Collateral-Risk weighted-average calculation that derives
 * `RP_u` itself from a user's full collateral set (`docs/overview.md`
 * "Risk Premium Algorithm"). See the `riskPremium` field doc on
 * `AaveV4DebtProjectionInput` below for the exact contract this module
 * requires instead.
 */
const FORMULA_ID = 'AAVE-V4-DRAWN-PREMIUM';
const FORMULA_VERSION = '1.0';

const RAY_DECIMAL = new Decimal(RAY.toString());
const SECONDS_PER_DAY_DECIMAL = new Decimal(86400);

function decimalToRay(value: Decimal): bigint {
  return BigInt(value.times(RAY_DECIMAL).toFixed(0));
}

function rayToDecimalValue(value: bigint): Decimal {
  return new Decimal(value.toString()).dividedBy(RAY_DECIMAL);
}

export interface AaveV4DebtProjectionInput {
  /** Current drawn (base) debt balance, in dollars. */
  drawnDebt: number;
  /** Current premium debt balance, in dollars — 0 for a position with no accrued premium yet. */
  premiumDebt: number;
  /** The Hub's base drawn rate for this asset, as a fraction (e.g. 0.05 for 5% APR) — not the user's own blended rate. */
  baseDrawnApr: number;
  /**
   * The position's CURRENTLY-EFFECTIVE V4 Risk Premium (`RP_u` in
   * `docs/overview.md`), as a fraction (e.g. 0.10 for 10%) — the value
   * implied by the position's actual, persisted on-chain premium
   * accounting (`premiumShares`/`premiumOffsetRay` relative to
   * `drawnShares`, per `ISpoke.UserPosition` / `UserPositionUtils.getDebt`),
   * NOT a value freshly recomputed from the user's current collateral
   * configuration via the Risk Premium Algorithm
   * (`docs/overview.md` "Risk Premium Algorithm").
   *
   * These two can legitimately diverge on-chain: `docs/overview.md`
   * states the User Risk Premium "is refreshed only on actions that can
   * change the position's effective collateralization... If a user
   * remains inactive, their User Risk Premium stays constant" — so a
   * position's stored, currently-effective `RP_u` can be stale relative
   * to what a fresh recomputation from its current collateral mix would
   * yield, until a triggering action (or `updateUserRiskPremium`/
   * `updateUserDynamicConfig`) refreshes it. This function's projection
   * math (see this file's header comment, part B) is only exactly
   * equivalent to the on-chain accrual when `riskPremium` is the
   * position's stored/effective value — supplying a freshly-recomputed
   * target instead silently produces a plausible-looking but incorrect
   * projection (validation cannot detect this; both are valid rates).
   *
   * Stage 3 (not implemented here) must derive this value from
   * authoritative on-chain position state/accounting (e.g. reading the
   * position's actual `premiumShares`/`drawnShares` ratio, or an
   * equivalent RPC-exposed currently-effective Risk Premium) rather than
   * recomputing it independently from collateral data.
   */
  riskPremium: number;
  elapsedDays: number;
}

/**
 * Projects Aave V4 drawn and premium debt forward by `elapsedDays`,
 * returning both streams and their sum. Invalid inputs (negative
 * balances/rates/time) fail closed with a structured `FormulaResult`
 * error — never `NaN`/`Infinity`/a partial result — exactly like every
 * other Engine formula.
 */
export function projectAaveV4Debt(
  input: AaveV4DebtProjectionInput,
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

  const baseDrawnApr = validateRate(input.baseDrawnApr, 'baseDrawnApr');
  if (!baseDrawnApr.ok) return createFailure(baseDrawnApr.error, options);

  // Not `validatePercentage` ([0,1]) — docs/overview.md's own Collateral
  // Risk domain runs 0 to 1000_00 BPS (0%-1000%), matching `borrowApr`'s
  // own non-negative-only bound elsewhere in this Engine, not a 0-100% cap.
  const riskPremium = validateRate(input.riskPremium, 'riskPremium');
  if (!riskPremium.ok) return createFailure(riskPremium.error, options);

  const period = validateTimePeriod(input.elapsedDays, 'elapsedDays');
  if (!period.ok) return createFailure(period.error, options);

  const drawnDebtRay = decimalToRay(drawnDebt.value);
  const premiumDebtRay = decimalToRay(premiumDebt.value);
  const baseDrawnAprRay = decimalToRay(baseDrawnApr.value);
  const riskPremiumRay = decimalToRay(riskPremium.value);
  const elapsedSeconds = BigInt(period.value.times(SECONDS_PER_DAY_DECIMAL).toFixed(0));

  const growthFactorRay = calculateLinearInterest(baseDrawnAprRay, elapsedSeconds);
  const newDrawnDebtRay = rayMulUp(drawnDebtRay, growthFactorRay);
  const drawnInterestAccruedRay = newDrawnDebtRay - drawnDebtRay;
  const premiumInterestAccruedRay = rayMulUp(drawnInterestAccruedRay, riskPremiumRay);
  const newPremiumDebtRay = premiumDebtRay + premiumInterestAccruedRay;
  const totalDebtRay = newDrawnDebtRay + newPremiumDebtRay;

  return createSuccess(
    {
      drawnDebt: toOutputNumber(rayToDecimalValue(newDrawnDebtRay)),
      premiumDebt: toOutputNumber(rayToDecimalValue(newPremiumDebtRay)),
      totalDebt: toOutputNumber(rayToDecimalValue(totalDebtRay)),
    },
    options,
  );
}

import { Decimal, toOutputNumber } from '../../shared/decimal';
import { createFailure, createSuccess, type FormulaResult } from '../../shared/result';
import { validateNonNegative, validateRate, validateTimePeriod } from '../../validation/validate';
import { calculateCompoundedInterest, RAY, rayMul } from './math';

/**
 * Not a 02_Formulas.md Formula ID — this is Aave V3's own on-chain
 * variable-debt accrual semantics (`MathUtils.calculateCompoundedInterest`),
 * not one of the documented F-001–F-069 equations. Kept in its own
 * namespace so it is never confused with a spec-derived formula, per this
 * batch's explicit scope: reproduce Aave's own math, not invent a new one.
 */
const FORMULA_ID = 'AAVE-V3-COMPOUND';
const FORMULA_VERSION = '1.0';

const RAY_DECIMAL = new Decimal(RAY.toString());
const SECONDS_PER_DAY_DECIMAL = new Decimal(86400);

function decimalToRay(value: Decimal): bigint {
  return BigInt(value.times(RAY_DECIMAL).toFixed(0));
}

function rayToDecimalValue(value: bigint): Decimal {
  return new Decimal(value.toString()).dividedBy(RAY_DECIMAL);
}

/**
 * Projects a variable-rate debt balance forward using Aave V3's exact
 * compounding curve and rounding rule (`engine/protocols/aaveV3/math.ts`),
 * computed at RAY (1e27) internal precision throughout — matching or
 * exceeding Aave's own on-chain precision for any realistically-sized
 * debt balance. `currentDebt`/`borrowApr` use the same decimal
 * conventions as the rest of the Engine (dollars; 0.05 = 5% APR).
 *
 * This is the only place in the Engine that applies compounded interest;
 * `calculateProratedInterest`/`calculateDebtGrowth` (F-030/F-033) remain
 * simple-interest and unchanged for any other caller.
 */
export function projectVariableDebt(
  currentDebt: number,
  borrowApr: number,
  elapsedDays: number,
): FormulaResult<number> {
  const options = {
    formulaId: FORMULA_ID,
    formulaVersion: FORMULA_VERSION,
    inputsUsed: { currentDebt, borrowApr, elapsedDays },
  };

  const debt = validateNonNegative(currentDebt, 'currentDebt');
  if (!debt.ok) return createFailure(debt.error, options);

  const rate = validateRate(borrowApr, 'borrowApr');
  if (!rate.ok) return createFailure(rate.error, options);

  const period = validateTimePeriod(elapsedDays, 'elapsedDays');
  if (!period.ok) return createFailure(period.error, options);

  const debtRay = decimalToRay(debt.value);
  const rateRay = decimalToRay(rate.value);
  const elapsedSeconds = BigInt(period.value.times(SECONDS_PER_DAY_DECIMAL).toFixed(0));

  const growthFactor = calculateCompoundedInterest(rateRay, elapsedSeconds);
  const projectedDebtRay = rayMul(debtRay, growthFactor);

  return createSuccess(toOutputNumber(rayToDecimalValue(projectedDebtRay)), options);
}

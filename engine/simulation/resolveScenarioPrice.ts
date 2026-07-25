import { toDecimal, toOutputNumber } from '../shared/decimal';
import { createFailure, createSuccess, type FormulaResult } from '../shared/result';
import { validateFinite, validatePrice } from '../validation/validate';

const FORMULA_ID = 'F-051';
const FORMULA_VERSION = '1.0';

export type PriceScenarioInput =
  | { type: 'absolute'; btcPriceUsd: number }
  | { type: 'percentageChange'; percentageChange: number };

/**
 * Percentage Price Movement — 02_Formulas.md F-051.
 * Equation: New Price = Current Price × (1 + Change%).
 *
 * Resolves either scenario shape 06_TASKS.md M2-019's DoD requires ("the
 * same simulation function supports both absolute prices and percentage
 * changes") into a single absolute price: an `'absolute'` scenario is
 * used as-is (validated); a `'percentageChange'` scenario applies F-051's
 * own equation to the current price. Shared by simulatePriceScenario
 * (M2-019) and simulateInterestScenario (M2-020) rather than duplicated.
 */
export function resolveScenarioPrice(
  currentBtcPriceUsd: number,
  scenario: PriceScenarioInput,
): FormulaResult<number> {
  const options = {
    formulaId: FORMULA_ID,
    formulaVersion: FORMULA_VERSION,
    inputsUsed: { currentBtcPriceUsd, scenario },
  };

  const currentPrice = validatePrice(currentBtcPriceUsd, 'currentBtcPriceUsd');
  if (!currentPrice.ok) return createFailure(currentPrice.error, options);

  if (scenario.type === 'absolute') {
    const absolutePrice = validatePrice(scenario.btcPriceUsd, 'scenario.btcPriceUsd');
    if (!absolutePrice.ok) return createFailure(absolutePrice.error, options);
    return createSuccess(toOutputNumber(absolutePrice.value), options);
  }

  const changePercent = validateFinite(scenario.percentageChange, 'scenario.percentageChange');
  if (!changePercent.ok) return createFailure(changePercent.error, options);

  const newPrice = currentPrice.value.times(toDecimal(1).plus(changePercent.value));
  // decimal.js's isPositive() treats 0 as positive (sign-based, not
  // magnitude-based), so a strict greaterThan(0) is required here.
  if (!newPrice.greaterThan(0)) {
    return createFailure(
      {
        code: 'INVALID_PERCENTAGE_CHANGE',
        message: 'scenario.percentageChange must not drop the resulting price to zero or below.',
      },
      options,
    );
  }

  return createSuccess(toOutputNumber(newPrice), options);
}

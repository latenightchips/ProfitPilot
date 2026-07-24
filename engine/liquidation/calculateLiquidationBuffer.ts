import { toDecimal, toOutputNumber } from '../shared/decimal';
import { createFailure, createSuccess, type FormulaResult } from '../shared/result';
import { calculateLiquidationPrice } from './calculateLiquidationPrice';

const FORMULA_ID = 'F-025';
const FORMULA_VERSION = '1.0';

/**
 * Liquidation Buffer — 02_Formulas.md F-025.
 * Equation: Buffer % = (Current Price − Liquidation Price) / Current Price × 100.
 * Reuses calculateLiquidationPrice (F-024) rather than recomputing it.
 *
 * The equation's own "× 100" means this returns a percentage on a 0–100
 * scale (e.g. 25, for 25%) — unlike protocol-parameter percentages
 * elsewhere in the Engine, which are decimals on a 0–1 scale
 * (04_BUILD_GUIDE.md). This matches 02_Formulas.md's F-025 example exactly.
 *
 * Also serves 06_TASKS.md M2-010's "Price decline to liquidation": that is
 * the same quantity as the Liquidation Buffer.
 */
export function calculateLiquidationBuffer(
  currentBtcPrice: number,
  debtValue: number,
  collateralValue: number,
  liquidationThreshold: number,
): FormulaResult<number> {
  const options = {
    formulaId: FORMULA_ID,
    formulaVersion: FORMULA_VERSION,
    inputsUsed: { currentBtcPrice, debtValue, collateralValue, liquidationThreshold },
  };

  const liquidationPriceResult = calculateLiquidationPrice(
    currentBtcPrice,
    debtValue,
    collateralValue,
    liquidationThreshold,
  );
  if (!liquidationPriceResult.ok) return createFailure(liquidationPriceResult.error, options);

  const buffer = toDecimal(currentBtcPrice)
    .minus(liquidationPriceResult.value)
    .dividedBy(currentBtcPrice)
    .times(100);

  return createSuccess(toOutputNumber(buffer), options, liquidationPriceResult.warnings);
}

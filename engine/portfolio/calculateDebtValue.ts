import { toOutputNumber } from '../shared/decimal';
import { createFailure, createSuccess, type FormulaResult } from '../shared/result';
import type { DebtPosition } from '../shared/types';
import { validateTokenQuantity } from '../validation/validate';

const FORMULA_ID = 'F-003';
const FORMULA_VERSION = '1.0';

/**
 * Debt Value — 02_Formulas.md F-003.
 * Equation: Debt Value = Borrowed Stablecoins.
 * Version 1 models a single stablecoin debt position — 01_PRD.md REQ-003.
 */
export function calculateDebtValue(debt: DebtPosition): FormulaResult<number> {
  const options = {
    formulaId: FORMULA_ID,
    formulaVersion: FORMULA_VERSION,
    inputsUsed: { debt },
  };

  const balance = validateTokenQuantity(debt.balance, 'debt.balance');
  if (!balance.ok) return createFailure(balance.error, options);

  return createSuccess(toOutputNumber(balance.value), options);
}

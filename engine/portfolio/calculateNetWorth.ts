import { toDecimal, toOutputNumber } from '../shared/decimal';
import { createFailure, createSuccess, type FormulaResult } from '../shared/result';
import type { PortfolioInput } from '../shared/types';
import { calculateDebtValue } from './calculateDebtValue';
import { calculatePortfolioValue } from './calculatePortfolioValue';

const FORMULA_ID = 'F-004';
const FORMULA_VERSION = '1.0';

/**
 * Net Portfolio Value — 02_Formulas.md F-004.
 * Equation: Net Value = Portfolio Value − Debt.
 *
 * The same quantity is referred to as "Net Worth" (02_Formulas.md F-004
 * example, 01_PRD.md) and "Net Equity" (TERMINOLOGY.md: "Net Equity —
 * Collateral Value − Debt Value") elsewhere in the documentation; this is
 * the one canonical implementation for all of those names.
 *
 * Negative equity is allowed and returned as-is, with a warning —
 * 02_Formulas.md F-004 "Edge Cases": "Debt larger than assets — Negative
 * equity — Allowed — Displayed as warning."
 */
export function calculateNetWorth(portfolio: PortfolioInput): FormulaResult<number> {
  const options = {
    formulaId: FORMULA_ID,
    formulaVersion: FORMULA_VERSION,
    inputsUsed: { portfolio },
  };

  const portfolioValueResult = calculatePortfolioValue(portfolio.collateral, portfolio.market);
  if (!portfolioValueResult.ok) return createFailure(portfolioValueResult.error, options);

  const debtValueResult = calculateDebtValue(portfolio.debt);
  if (!debtValueResult.ok) return createFailure(debtValueResult.error, options);

  const netWorth = toDecimal(portfolioValueResult.value).minus(debtValueResult.value);

  const warnings = [...portfolioValueResult.warnings, ...debtValueResult.warnings];
  if (netWorth.isNegative()) {
    warnings.push({
      code: 'NEGATIVE_EQUITY',
      message: 'Debt exceeds portfolio value. Net worth is negative.',
    });
  }

  return createSuccess(toOutputNumber(netWorth), options, warnings);
}

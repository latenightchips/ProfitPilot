import { toDecimal, toOutputNumber } from '../shared/decimal';
import { createFailure, createSuccess, type FormulaResult } from '../shared/result';
import { validateNonNegative } from '../validation/validate';

const FORMULA_ID = 'F-006';
const FORMULA_VERSION = '1.0';

/**
 * Debt Ratio — 02_Formulas.md F-006 ("FORMULA 006" in the page-1
 * Portfolio Value Mathematics chapter).
 * Equation: Debt Ratio = Debt / Portfolio Value.
 *
 * Previously identified (Batch 2) as one of four Portfolio Metrics
 * formulas (F-005-F-008) with no task assigned anywhere in `06_TASKS.md`
 * by name search — the same class of gap later resolved for F-007
 * (Batch 7, "Profit or loss"). Debt Ratio is now needed: 02_Formulas.md
 * F-061 "Borrow Recommendation" (M2-025) explicitly conditions on "Debt
 * Ratio below target." F-005 (Equity Ratio) and F-008 (Portfolio Return)
 * remain unassigned — see PROJECT_STATUS.md.
 *
 * F-006 documents no explicit zero-portfolio-value edge case; the zero/
 * zero vs. debt-with-zero-portfolio split below follows the same pattern
 * `calculateLoanToValue` (F-020) already established for the analogous
 * zero-collateral case, rather than silently returning 0 for a genuinely
 * undefined ratio.
 */
export function calculateDebtRatio(
  debtValue: number,
  portfolioValue: number,
): FormulaResult<number> {
  const options = {
    formulaId: FORMULA_ID,
    formulaVersion: FORMULA_VERSION,
    inputsUsed: { debtValue, portfolioValue },
  };

  const debt = validateNonNegative(debtValue, 'debtValue');
  if (!debt.ok) return createFailure(debt.error, options);

  const portfolio = validateNonNegative(portfolioValue, 'portfolioValue');
  if (!portfolio.ok) return createFailure(portfolio.error, options);

  if (portfolio.value.isZero()) {
    if (debt.value.isZero()) {
      return createSuccess(0, options, [
        {
          code: 'ZERO_PORTFOLIO_ZERO_DEBT',
          message: 'No portfolio value and no debt: Debt Ratio is 0.',
        },
      ]);
    }
    return createFailure(
      {
        code: 'DIVISION_BY_ZERO',
        message: 'Cannot compute Debt Ratio: debt exists with zero portfolio value.',
      },
      options,
    );
  }

  const debtRatio = toDecimal(debt.value).dividedBy(portfolio.value);
  return createSuccess(toOutputNumber(debtRatio), options);
}

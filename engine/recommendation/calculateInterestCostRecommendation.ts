import { calculateAnnualInterest } from '../interest/calculateAnnualInterest';
import { calculateDebtValue } from '../portfolio/calculateDebtValue';
import { createFailure, createSuccess, type FormulaResult } from '../shared/result';
import type { PortfolioInput } from '../shared/types';
import { validateNonNegative } from '../validation/validate';
import type { Recommendation } from './types';

const FORMULA_ID = 'F-065';
const FORMULA_VERSION = '1.0';

export interface InterestCostRecommendationParams {
  portfolio: PortfolioInput;
  /**
   * Owner decision (2026): a user-entered annual USD amount, NOT derived
   * from BTC appreciation %, current BTC price, collateral value, equity,
   * leveraged exposure, initial investment, cost basis, or historical
   * return. Caller-supplied, exactly like `calculateLoopRecommendation`'s
   * `maxAcceptableAnnualInterestCost` — 02_Formulas.md gives no numeric
   * value or derivation for it.
   */
  expectedAnnualPortfolioGrowthUsd: number;
}

/**
 * Interest Cost Recommendation — 02_Formulas.md F-065 ("Interest
 * Warning"). Rule: Annual Interest > Expected Annual Portfolio Growth →
 * warning. Reuses `calculateDebtValue` (F-003) and `calculateAnnualInterest`
 * (F-032, unchanged) rather than recomputing either — the same reuse
 * `calculateLoopRecommendation` (F-064) already established for
 * `calculateAnnualInterest`.
 *
 * **Units — owner decision, resolving the dimensional ambiguity a prior
 * read-only specification gate found (F-065 had no Formula ID of its own
 * and no defined unit for "Expected Annual Portfolio Growth").** Both
 * sides of the comparison are USD/year: Annual Interest is `Debt × APR`
 * (F-032, already USD/year), and `expectedAnnualPortfolioGrowthUsd` is a
 * user-entered annual USD expectation — ProfitPilot never derives or
 * forecasts this figure itself, it only compares the user's own number
 * against the real, computed interest cost.
 *
 * **Comparator is strict `>` — equality does NOT warn.** Not modified,
 * not extended with additional thresholds or severity bands.
 *
 * **Zero debt.** `calculateAnnualInterest(0, apr) = 0`, and
 * `expectedAnnualPortfolioGrowthUsd` is validated non-negative, so
 * `0 > expectedAnnualPortfolioGrowthUsd` is false for every valid
 * configured value — a zero-debt portfolio with a valid configured growth
 * figure never warns, matching F-061's/F-064's own "always return an
 * object for both branches" convention (never a warning fabricated from
 * no debt).
 */
export function calculateInterestCostRecommendation(
  params: InterestCostRecommendationParams,
): FormulaResult<Recommendation> {
  const options = {
    formulaId: FORMULA_ID,
    formulaVersion: FORMULA_VERSION,
    inputsUsed: { ...params },
  };

  const { portfolio, expectedAnnualPortfolioGrowthUsd } = params;

  const growth = validateNonNegative(
    expectedAnnualPortfolioGrowthUsd,
    'expectedAnnualPortfolioGrowthUsd',
  );
  if (!growth.ok) return createFailure(growth.error, options);

  const debtValueResult = calculateDebtValue(portfolio.debt);
  if (!debtValueResult.ok) return createFailure(debtValueResult.error, options);

  const annualInterestResult = calculateAnnualInterest(
    debtValueResult.value,
    portfolio.protocol.borrowApr,
  );
  if (!annualInterestResult.ok) return createFailure(annualInterestResult.error, options);

  const warningTriggered = annualInterestResult.value > expectedAnnualPortfolioGrowthUsd;

  const warnings = [...debtValueResult.warnings, ...annualInterestResult.warnings];

  return createSuccess(
    {
      category: 'interestCost',
      triggeringCondition: warningTriggered
        ? 'Annual Interest exceeds Expected Annual Portfolio Growth.'
        : 'Annual Interest does not exceed Expected Annual Portfolio Growth.',
      relevantValues: {
        annualInterestUsd: annualInterestResult.value,
        expectedAnnualPortfolioGrowthUsd,
      },
      expectedEffect: warningTriggered
        ? 'Interest costs may outweigh expected returns.'
        : 'Interest costs remain within the expected returns you configured.',
      decisionPriority: 'Reduce Interest Costs',
      suggestedAction: warningTriggered
        ? 'Interest costs may outweigh expected returns.'
        : 'No action needed — interest cost is not flagged.',
      formulaReferences: ['F-065', 'F-032', 'F-003'],
    },
    options,
    warnings,
  );
}

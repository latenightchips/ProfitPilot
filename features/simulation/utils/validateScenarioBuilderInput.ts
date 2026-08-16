/**
 * Scenario Builder validation — 06_TASKS.md M6-004. DoD: "Scenario
 * inputs are validated before calculation." Rules follow `03_UI.md`
 * Page 5's own "AUTO VALIDATION" section literally: "Negative BTC
 * Price," "Negative Portfolio," "Negative Health Factor," "Borrow
 * exceeds protocol limit" — each mapped to the one field it concretely
 * applies to, not invented beyond that list.
 *
 * Pure, synchronous, and Store-independent — takes the form's current
 * string values plus the portfolio being simulated against (needed for
 * the two contextual checks: a delta can't withdraw/repay more than
 * currently exists, and additional borrow can't exceed the protocol's
 * own `maxLoanToValue`). Returns one message per invalid field, or
 * `null` for a valid one — the same "no calculation, just a validation
 * verdict" boundary `types/portfolio.schema.ts` already establishes for
 * Portfolio's own forms.
 */
import { type ApplicationPortfolio, resolveCanonicalDebtBalance } from '@/services';

import type {
  ScenarioBuilderFieldErrors,
  ScenarioBuilderFormValues,
} from '../types/scenarioBuilder';

function parseNumber(value: string): number | null {
  if (value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function validateScenarioBuilderInput(
  values: ScenarioBuilderFormValues,
  portfolio: ApplicationPortfolio,
): ScenarioBuilderFieldErrors {
  const errors: ScenarioBuilderFieldErrors = {
    btcPriceUsd: null,
    percentageChange: null,
    borrowApr: null,
    collateralDelta: null,
    debtDelta: null,
    targetHealthFactor: null,
    customHoldingPeriodDays: null,
  };

  const btcPriceUsd = parseNumber(values.btcPriceUsd);
  if (btcPriceUsd === null || btcPriceUsd <= 0) {
    errors.btcPriceUsd = 'BTC price must be a positive number.';
  }

  // Optional — only validated when the user actually enters a value
  // (mirrors Target Health Factor's own optional-field pattern below).
  // This field is percentage-scale (UX punch-list UX-05: the user types
  // "10" for +10%, not "0.10") — bound is -100 (not -1), matching the
  // same underlying rejection as before the scale changed: a change of
  // -100% or worse would drop the resulting price to zero or below.
  if (values.percentageChange.trim() !== '') {
    const percentageChange = parseNumber(values.percentageChange);
    if (percentageChange === null || percentageChange <= -100) {
      errors.percentageChange = 'Percentage change cannot reduce the price to zero or below.';
    }
  }

  const borrowApr = parseNumber(values.borrowApr);
  if (borrowApr === null || borrowApr < 0) {
    errors.borrowApr = 'Borrow rate cannot be negative.';
  }

  const collateralDelta = parseNumber(values.collateralDelta);
  if (collateralDelta === null) {
    errors.collateralDelta = 'Collateral change must be a number.';
  } else if (collateralDelta < 0 && Math.abs(collateralDelta) > portfolio.collateral.quantity) {
    errors.collateralDelta = 'Withdrawal cannot exceed current collateral.';
  }

  // V4 Readiness Audit §12 Stage 16 — the canonical current total
  // (`resolveCanonicalDebtBalance`), not raw `debt.balance`, so this
  // pre-submission check doesn't wrongly block a valid repayment or
  // wrongly allow an invalid one for a V4 portfolio whose `debt.balance`
  // has drifted from its real synced total. The actual simulation
  // (`runPortfolioActionSimulation`) still independently fails closed on
  // missing V4 state regardless of what this validation concludes.
  const currentDebt = resolveCanonicalDebtBalance(portfolio);
  const debtDelta = parseNumber(values.debtDelta);
  if (debtDelta === null) {
    errors.debtDelta = 'Debt change must be a number.';
  } else if (debtDelta < 0 && Math.abs(debtDelta) > currentDebt) {
    errors.debtDelta = 'Repayment cannot exceed current debt.';
  } else if (debtDelta > 0) {
    const projectedDebt = currentDebt + debtDelta;
    const currentCollateralValue = portfolio.collateral.quantity * portfolio.market.btcPriceUsd;
    if (
      currentCollateralValue > 0 &&
      projectedDebt / currentCollateralValue > portfolio.protocol.maxLoanToValue
    ) {
      errors.debtDelta = "Additional borrow would exceed the protocol's maximum LTV.";
    }
  }

  const targetHealthFactor = parseNumber(values.targetHealthFactor);
  if (
    values.targetHealthFactor.trim() !== '' &&
    (targetHealthFactor === null || targetHealthFactor <= 0)
  ) {
    errors.targetHealthFactor = 'Target Health Factor must be a positive number.';
  }

  if (values.holdingPeriod === 'custom') {
    const customDays = parseNumber(values.customHoldingPeriodDays);
    if (customDays === null || customDays <= 0 || !Number.isInteger(customDays)) {
      errors.customHoldingPeriodDays =
        'Custom holding period must be a positive whole number of days.';
    }
  }

  return errors;
}

export function hasScenarioBuilderErrors(errors: ScenarioBuilderFieldErrors): boolean {
  return Object.values(errors).some((message) => message !== null);
}

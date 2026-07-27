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
import type { ApplicationPortfolio } from '@/services';

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

  const debtDelta = parseNumber(values.debtDelta);
  if (debtDelta === null) {
    errors.debtDelta = 'Debt change must be a number.';
  } else if (debtDelta < 0 && Math.abs(debtDelta) > portfolio.debt.balance) {
    errors.debtDelta = 'Repayment cannot exceed current debt.';
  } else if (debtDelta > 0) {
    const projectedDebt = portfolio.debt.balance + debtDelta;
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

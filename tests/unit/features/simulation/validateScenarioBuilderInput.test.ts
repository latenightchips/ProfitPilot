import { describe, expect, it } from 'vitest';

import type { ScenarioBuilderFormValues } from '@/features/simulation';
import { hasScenarioBuilderErrors, validateScenarioBuilderInput } from '@/features/simulation';
import type { ApplicationPortfolio } from '@/services';

/**
 * Scenario Builder validation — 06_TASKS.md M6-004. DoD: "Scenario
 * inputs are validated before calculation." Each test targets exactly
 * one rule from `03_UI.md` Page 5's own "AUTO VALIDATION" section:
 * "Negative BTC Price," "Negative Portfolio," "Negative Health Factor,"
 * "Borrow exceeds protocol limit."
 */
function portfolio(overrides: Partial<ApplicationPortfolio> = {}): ApplicationPortfolio {
  return {
    collateral: { asset: 'BTC', quantity: 2 },
    debt: { asset: 'USDC', balance: 20000 },
    market: { btcPriceUsd: 50000 },
    protocol: {
      maxLoanToValue: 0.75,
      liquidationThreshold: 0.8,
      borrowApr: 0.05,
      supplyApr: 0.02,
    },
    ...overrides,
  };
}

function values(overrides: Partial<ScenarioBuilderFormValues> = {}): ScenarioBuilderFormValues {
  return {
    btcPriceUsd: '50000',
    percentageChange: '',
    borrowApr: '0.05',
    collateralDelta: '0',
    debtDelta: '0',
    targetHealthFactor: '',
    holdingPeriod: '30',
    customHoldingPeriodDays: '',
    ...overrides,
  };
}

describe('validateScenarioBuilderInput — valid defaults', () => {
  it('reports no errors for the portfolio’s own current values unchanged', () => {
    const errors = validateScenarioBuilderInput(values(), portfolio());
    expect(hasScenarioBuilderErrors(errors)).toBe(false);
  });
});

describe('validateScenarioBuilderInput — Negative BTC Price', () => {
  it('rejects a zero or negative BTC price', () => {
    expect(
      validateScenarioBuilderInput(values({ btcPriceUsd: '0' }), portfolio()).btcPriceUsd,
    ).not.toBeNull();
    expect(
      validateScenarioBuilderInput(values({ btcPriceUsd: '-100' }), portfolio()).btcPriceUsd,
    ).not.toBeNull();
  });
});

describe('validateScenarioBuilderInput — Percentage Change (M6-005, Batch 4)', () => {
  it('leaves Percentage Change optional — an empty value is not an error', () => {
    expect(
      validateScenarioBuilderInput(values({ percentageChange: '' }), portfolio()).percentageChange,
    ).toBeNull();
  });

  it('rejects a change of -100% or worse (would drop the price to zero or below, per F-051)', () => {
    expect(
      validateScenarioBuilderInput(values({ percentageChange: '-1' }), portfolio())
        .percentageChange,
    ).not.toBeNull();
    expect(
      validateScenarioBuilderInput(values({ percentageChange: '-2' }), portfolio())
        .percentageChange,
    ).not.toBeNull();
  });

  it('accepts a valid negative or positive percentage change', () => {
    expect(
      validateScenarioBuilderInput(values({ percentageChange: '-0.5' }), portfolio())
        .percentageChange,
    ).toBeNull();
    expect(
      validateScenarioBuilderInput(values({ percentageChange: '0.25' }), portfolio())
        .percentageChange,
    ).toBeNull();
  });
});

describe('validateScenarioBuilderInput — non-numeric input', () => {
  it('rejects a non-numeric Borrow Rate', () => {
    expect(validateScenarioBuilderInput(values({ borrowApr: 'abc' }), portfolio()).borrowApr).toBe(
      'Borrow rate cannot be negative.',
    );
  });

  it('rejects a non-numeric Collateral Change', () => {
    expect(
      validateScenarioBuilderInput(values({ collateralDelta: 'abc' }), portfolio()).collateralDelta,
    ).toBe('Collateral change must be a number.');
  });

  it('rejects a non-numeric Debt Change', () => {
    expect(validateScenarioBuilderInput(values({ debtDelta: 'abc' }), portfolio()).debtDelta).toBe(
      'Debt change must be a number.',
    );
  });
});

describe('validateScenarioBuilderInput — Negative Portfolio (collateral/debt deltas)', () => {
  it('rejects a collateral withdrawal larger than what is currently held', () => {
    const errors = validateScenarioBuilderInput(
      values({ collateralDelta: '-3' }),
      portfolio({ collateral: { asset: 'BTC', quantity: 2 } }),
    );
    expect(errors.collateralDelta).not.toBeNull();
  });

  it('accepts a collateral withdrawal within what is currently held', () => {
    const errors = validateScenarioBuilderInput(
      values({ collateralDelta: '-1' }),
      portfolio({ collateral: { asset: 'BTC', quantity: 2 } }),
    );
    expect(errors.collateralDelta).toBeNull();
  });

  it('rejects a debt repayment larger than the current balance', () => {
    const errors = validateScenarioBuilderInput(
      values({ debtDelta: '-25000' }),
      portfolio({ debt: { asset: 'USDC', balance: 20000 } }),
    );
    expect(errors.debtDelta).not.toBeNull();
  });
});

describe('validateScenarioBuilderInput — Borrow exceeds protocol limit', () => {
  it('rejects an additional borrow that would push LTV above maxLoanToValue', () => {
    // 2 BTC * $50,000 = $100,000 collateral value; max LTV 0.75 → max debt $75,000.
    // Current debt $20,000 + $60,000 additional = $80,000, exceeding the $75,000 cap.
    const errors = validateScenarioBuilderInput(values({ debtDelta: '60000' }), portfolio());
    expect(errors.debtDelta).not.toBeNull();
  });

  it('accepts an additional borrow that stays within the protocol limit', () => {
    // $20,000 + $10,000 = $30,000, well within the $75,000 cap.
    const errors = validateScenarioBuilderInput(values({ debtDelta: '10000' }), portfolio());
    expect(errors.debtDelta).toBeNull();
  });
});

describe('validateScenarioBuilderInput — Negative Health Factor', () => {
  it('rejects a zero or negative Target Health Factor when provided', () => {
    expect(
      validateScenarioBuilderInput(values({ targetHealthFactor: '0' }), portfolio())
        .targetHealthFactor,
    ).not.toBeNull();
    expect(
      validateScenarioBuilderInput(values({ targetHealthFactor: '-2' }), portfolio())
        .targetHealthFactor,
    ).not.toBeNull();
  });

  it('leaves Target Health Factor optional — an empty value is not an error', () => {
    const errors = validateScenarioBuilderInput(values({ targetHealthFactor: '' }), portfolio());
    expect(errors.targetHealthFactor).toBeNull();
  });
});

describe('validateScenarioBuilderInput — custom holding period', () => {
  it('requires a positive whole number of days only when "custom" is selected', () => {
    const withoutCustom = validateScenarioBuilderInput(
      values({ holdingPeriod: '30', customHoldingPeriodDays: '' }),
      portfolio(),
    );
    expect(withoutCustom.customHoldingPeriodDays).toBeNull();

    const invalidCustom = validateScenarioBuilderInput(
      values({ holdingPeriod: 'custom', customHoldingPeriodDays: '-5' }),
      portfolio(),
    );
    expect(invalidCustom.customHoldingPeriodDays).not.toBeNull();

    const validCustom = validateScenarioBuilderInput(
      values({ holdingPeriod: 'custom', customHoldingPeriodDays: '45' }),
      portfolio(),
    );
    expect(validCustom.customHoldingPeriodDays).toBeNull();
  });
});

describe('hasScenarioBuilderErrors', () => {
  it('is true when any field carries an error message', () => {
    expect(
      hasScenarioBuilderErrors(
        validateScenarioBuilderInput(values({ btcPriceUsd: '-1' }), portfolio()),
      ),
    ).toBe(true);
  });

  it('is false when every field is valid', () => {
    expect(hasScenarioBuilderErrors(validateScenarioBuilderInput(values(), portfolio()))).toBe(
      false,
    );
  });
});

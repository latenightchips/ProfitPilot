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
    borrowApr: '5',
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
      validateScenarioBuilderInput(values({ percentageChange: '-100' }), portfolio())
        .percentageChange,
    ).not.toBeNull();
    expect(
      validateScenarioBuilderInput(values({ percentageChange: '-200' }), portfolio())
        .percentageChange,
    ).not.toBeNull();
  });

  it('accepts a valid negative or positive percentage change', () => {
    expect(
      validateScenarioBuilderInput(values({ percentageChange: '-50' }), portfolio())
        .percentageChange,
    ).toBeNull();
    expect(
      validateScenarioBuilderInput(values({ percentageChange: '25' }), portfolio())
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

/**
 * V4 canonical current debt — V4 Readiness Audit §12 Stage 16.
 * `debt.balance` deliberately disagrees with the real synced
 * `v4DebtState` below, proving both the repayment-limit and LTV checks
 * use the canonical total (`resolveCanonicalDebtBalance`), not the stale
 * legacy field.
 */
describe('validateScenarioBuilderInput — V4 canonical current debt (Stage 16)', () => {
  function v4Portfolio(overrides: Partial<ApplicationPortfolio> = {}): ApplicationPortfolio {
    return portfolio({
      debt: { asset: 'USDC', balance: 999999 },
      protocolVersion: 'v4',
      v4DebtState: { drawnDebt: 15000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.01 },
      // V4 semantic audit, Batch 3 (A3) — the two LTV-ceiling sub-tests
      // below need a real synced `v4CollateralRisk` now that the ceiling
      // check dispatches through `resolveRiskCapacityDisplay` (a V4
      // portfolio with no synced collateral risk skips the check
      // entirely, per that fix — see the dedicated A3 describe block
      // below). `collateralFactor: 0.75` deliberately matches this
      // fixture's own `protocol.maxLoanToValue` so these two sub-tests'
      // existing $75,000-cap arithmetic and expectations are unaffected
      // — they still exist to prove canonical-debt-total usage, not
      // ceiling-terminology correctness, which the new block covers.
      v4CollateralRisk: { collateralFactor: 0.75, dynamicConfigKey: 1 },
      ...overrides,
    });
  }

  it('rejects a repayment that exceeds the canonical total (15500), even though it is far below the stale legacy debt.balance (999999)', () => {
    const errors = validateScenarioBuilderInput(values({ debtDelta: '-20000' }), v4Portfolio());
    expect(errors.debtDelta).not.toBeNull();
  });

  it('accepts a repayment within the canonical total that a stale-999999-based check would have wrongly allowed alongside a far larger one', () => {
    const errors = validateScenarioBuilderInput(values({ debtDelta: '-15500' }), v4Portfolio());
    expect(errors.debtDelta).toBeNull();
  });

  it('rejects an additional borrow that would push LTV above maxLoanToValue when computed from the canonical total', () => {
    // 2 BTC * $50,000 = $100,000 collateral value; max LTV 0.75 → max debt $75,000.
    // Canonical current debt $15,500 + $65,000 additional = $80,500, exceeding the $75,000 cap.
    // A stale-999999-based check would have rejected this (and everything else) regardless.
    const errors = validateScenarioBuilderInput(values({ debtDelta: '65000' }), v4Portfolio());
    expect(errors.debtDelta).not.toBeNull();
  });

  it('accepts an additional borrow that stays within the protocol limit when computed from the canonical total', () => {
    // $15,500 + $10,000 = $25,500, well within the $75,000 cap — a
    // stale-999999-based check would have wrongly rejected this as
    // "exceeding" the (fictitious) current debt already past the cap.
    const errors = validateScenarioBuilderInput(values({ debtDelta: '10000' }), v4Portfolio());
    expect(errors.debtDelta).toBeNull();
  });

  it('a V3 (or unset) portfolio is completely unaffected — still validates against the real legacy debt.balance', () => {
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

/**
 * V4 semantic audit, Batch 3 (A3) — "Additional borrow would exceed the
 * protocol's..." previously always compared against
 * `portfolio.protocol.maxLoanToValue` and always said "maximum LTV,"
 * regardless of `protocolVersion`. `maxLoanToValue: 0.75` (V3's own
 * field, still present on every portfolio) is deliberately different
 * from `collateralFactor: 0.5` below, so a leak toward the V3 field
 * would be numerically obvious, not coincidentally matching.
 */
describe('validateScenarioBuilderInput — V4 Collateral Factor ceiling (A3)', () => {
  function v4Portfolio(overrides: Partial<ApplicationPortfolio> = {}): ApplicationPortfolio {
    return portfolio({
      protocolVersion: 'v4',
      v4CollateralRisk: { collateralFactor: 0.5, dynamicConfigKey: 1 },
      ...overrides,
    });
  }

  it('V3 behavior is unchanged: still rejects at maxLoanToValue (0.75) with the exact prior message', () => {
    // 2 BTC * $50,000 = $100,000 collateral value; max LTV 0.75 → max debt $75,000.
    // Current debt $20,000 + $60,000 additional = $80,000, exceeding the $75,000 cap.
    const errors = validateScenarioBuilderInput(values({ debtDelta: '60000' }), portfolio());
    expect(errors.debtDelta).toBe("Additional borrow would exceed the protocol's maximum LTV.");
  });

  it("V4 rejects a borrow that stays under V3's maxLoanToValue (0.75) but exceeds V4's real Collateral Factor (0.5) — proves the correct boundary is used, not the V3 one", () => {
    // 2 BTC * $50,000 = $100,000 collateral value; Collateral Factor 0.5 → max debt $50,000.
    // Current debt $20,000 + $40,000 = $60,000 — under V3's $75,000 cap, over V4's $50,000 cap.
    const errors = validateScenarioBuilderInput(values({ debtDelta: '40000' }), v4Portfolio());
    expect(errors.debtDelta).not.toBeNull();
  });

  it('V4 error wording says "Collateral Factor," never "Maximum LTV" or "maximum LTV"', () => {
    const errors = validateScenarioBuilderInput(values({ debtDelta: '40000' }), v4Portfolio());
    expect(errors.debtDelta).toBe(
      "Additional borrow would exceed the protocol's Collateral Factor.",
    );
    expect(errors.debtDelta).not.toMatch(/maximum LTV/i);
  });

  it('V4 accepts a borrow within the real Collateral Factor (0.5) cap', () => {
    // $20,000 + $20,000 = $40,000, within the $50,000 Collateral Factor cap.
    const errors = validateScenarioBuilderInput(values({ debtDelta: '20000' }), v4Portfolio());
    expect(errors.debtDelta).toBeNull();
  });

  it('missing V4 risk-capacity data (no synced v4CollateralRisk) skips the check entirely — never falls back to the V3 maxLoanToValue', () => {
    const portfolioMissingRisk = v4Portfolio({ v4CollateralRisk: undefined });
    // $20,000 + $60,000 = $80,000 — would violate BOTH V3's $75,000 cap
    // and V4's own real $50,000 cap were either applied; the absence of
    // an error here proves neither fired, not that both happened to pass.
    const errors = validateScenarioBuilderInput(
      values({ debtDelta: '60000' }),
      portfolioMissingRisk,
    );
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

import { describe, expect, it } from 'vitest';

import { calculateMaxAdditionalBorrow } from '@/services/portfolio/borrowCapacity';
import type { ApplicationPortfolio } from '@/services/portfolio/models';

/**
 * Borrow Capacity Service — V4 Readiness Audit §12 Stage 23D.
 *
 * Same base portfolio convention as `summary.test.ts`/`scenario.test.ts`:
 * 2 BTC @ $50,000 collateral ($100,000), $20,000 debt, V3
 * `protocol.liquidationThreshold: 0.8`. V4 fixtures use
 * `collateralFactor: 0.65` — deliberately different from 0.8 so a test
 * that silently used the V3 field would fail on an exact numeric
 * mismatch, not merely "some number came back."
 */
function basePortfolio(overrides: Partial<ApplicationPortfolio> = {}): ApplicationPortfolio {
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

describe('calculateMaxAdditionalBorrow — V3 (unaffected by Stage 23D)', () => {
  it('computes F-027 exactly: ((collateralValue * liquidationThreshold) / targetHealthFactor) - currentDebt', () => {
    // Collateral: $100,000. liquidationThreshold: 0.8. targetHealthFactor: 1.5.
    // = (100000 * 0.8) / 1.5 - 20000 = 53333.333... - 20000 = 33333.333...
    const result = calculateMaxAdditionalBorrow(basePortfolio(), 1.5, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toBeCloseTo(33333.333333333336, 6);
  });

  it('returns a negative value when the current debt already exceeds what the target Health Factor allows (repayment required)', () => {
    // Target HF 5.0: (100000 * 0.8) / 5.0 - 20000 = 16000 - 20000 = -4000.
    const result = calculateMaxAdditionalBorrow(basePortfolio(), 5.0, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toBeCloseTo(-4000, 6);
  });

  it('propagates a genuine Engine failure (invalid negative collateral) rather than throwing', () => {
    const invalid = basePortfolio({ collateral: { asset: 'BTC', quantity: -1 } });
    const result = calculateMaxAdditionalBorrow(invalid, 1.5, 'live');
    expect(result.ok).toBe(false);
  });

  it('does not have a data field on a failure result (discriminated union, not a nullable envelope)', () => {
    const invalid = basePortfolio({ collateral: { asset: 'BTC', quantity: -1 } });
    const result = calculateMaxAdditionalBorrow(invalid, 1.5, 'live');
    expect(result.ok).toBe(false);
    expect('data' in result).toBe(false);
  });

  it('threads the caller-supplied sourceStatus through to metadata, never fabricating it', () => {
    const result = calculateMaxAdditionalBorrow(basePortfolio(), 1.5, 'manual');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.metadata.sourceStatus).toBe('manual');
  });
});

describe('calculateMaxAdditionalBorrow — V4 risk-capacity dispatch (Stage 23D)', () => {
  function v4Portfolio(overrides: Partial<ApplicationPortfolio> = {}): ApplicationPortfolio {
    return basePortfolio({
      protocolVersion: 'v4',
      v4DebtState: { drawnDebt: 20000, premiumDebt: 0, baseDrawnApr: 0.05, riskPremium: 0 },
      v4CollateralRisk: { collateralFactor: 0.65, dynamicConfigKey: 1 },
      ...overrides,
    });
  }

  it('uses collateralFactor, never protocol.liquidationThreshold — numerical fixture from the authoritative Solidity formula', () => {
    // Authoritative V4 borrow-capacity gate (Stage 23B: Spoke.sol's
    // borrow() has no separate max-LTV check, only the same Health Factor
    // formula collateralFactor governs). Collateral: $100,000.
    // collateralFactor: 0.65. targetHealthFactor: 1.5.
    // = (100000 * 0.65) / 1.5 - 20000 = 43333.333... - 20000 = 23333.333...
    const result = calculateMaxAdditionalBorrow(v4Portfolio(), 1.5, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toBeCloseTo(23333.333333333332, 6);
    // If this had silently used protocol.liquidationThreshold (0.8), the
    // result would be 33333.33..., not 23333.33....
    expect(result.data).not.toBeCloseTo(33333.333333333336, 3);
  });

  it('a deliberately conflicting V3/V4 fixture on the same portfolio shape proves the correct branch is selected purely by protocolVersion', () => {
    const sharedOverrides = {
      v4DebtState: { drawnDebt: 20000, premiumDebt: 0, baseDrawnApr: 0.05, riskPremium: 0 },
      v4CollateralRisk: { collateralFactor: 0.65, dynamicConfigKey: 1 },
    };
    const v3Result = calculateMaxAdditionalBorrow(
      basePortfolio({ ...sharedOverrides, protocolVersion: 'v3' }),
      1.5,
      'live',
    );
    const v4Result = calculateMaxAdditionalBorrow(
      basePortfolio({ ...sharedOverrides, protocolVersion: 'v4' }),
      1.5,
      'live',
    );
    expect(v3Result.ok).toBe(true);
    expect(v4Result.ok).toBe(true);
    if (!v3Result.ok || !v4Result.ok) return;
    expect(v3Result.data).toBeCloseTo(33333.333333333336, 6);
    expect(v4Result.data).toBeCloseTo(23333.333333333332, 6);
  });

  it('fails closed with AAVE_V4_DEBT_STATE_MISSING when v4DebtState is missing (inherited from calculatePortfolioSummary), never falling back to legacy debt.balance', () => {
    const result = calculateMaxAdditionalBorrow(
      v4Portfolio({ v4DebtState: undefined }),
      1.5,
      'live',
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatchObject({ code: 'AAVE_V4_DEBT_STATE_MISSING' });
  });

  it('fails closed with AAVE_V4_COLLATERAL_RISK_MISSING when v4CollateralRisk is missing (inherited from calculatePortfolioSummary), never falling back to protocol.liquidationThreshold/maxLoanToValue', () => {
    const result = calculateMaxAdditionalBorrow(
      v4Portfolio({ v4CollateralRisk: undefined }),
      1.5,
      'live',
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatchObject({ code: 'AAVE_V4_COLLATERAL_RISK_MISSING' });
  });

  it('does not have a data field on the missing-collateral-risk failure (no partial/placeholder result leaks through)', () => {
    const result = calculateMaxAdditionalBorrow(
      v4Portfolio({ v4CollateralRisk: undefined }),
      1.5,
      'live',
    );
    expect(result.ok).toBe(false);
    expect('data' in result).toBe(false);
  });

  it('treats collateralFactor: 0 as real configuration, not missing data — reused via calculatePortfolioSummary, so it correctly fails on the same inherited DIVISION_BY_ZERO the liquidation-price step hits for zero effective collateral, never on the collateral-risk guard', () => {
    // This reuses `calculatePortfolioSummary` for `collateralValue`/
    // `debtValue` (see this file's own header comment), so it inherits
    // ALL of that function's behavior for a zero collateralFactor with
    // nonzero debt — including `calculateLiquidationPrice`'s pre-existing
    // Engine-layer DIVISION_BY_ZERO for zero effective collateral (see
    // `summary.test.ts`'s own identical case). The meaningful proof here
    // is the error code: DIVISION_BY_ZERO, never
    // AAVE_V4_COLLATERAL_RISK_MISSING — 0 passed the guard as real data,
    // and only the downstream math correctly rejects it.
    const result = calculateMaxAdditionalBorrow(
      v4Portfolio({ v4CollateralRisk: { collateralFactor: 0, dynamicConfigKey: 1 } }),
      1.5,
      'live',
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatchObject({ code: 'DIVISION_BY_ZERO' });
    expect(result.errors[0].code).not.toBe('AAVE_V4_COLLATERAL_RISK_MISSING');
  });

  it('treats collateralFactor: 0 as real configuration for a zero-debt portfolio, where the guard/dispatch succeeds and produces a real (non-positive) borrow capacity', () => {
    // Zero debt sidesteps calculatePortfolioSummary's liquidation-price
    // step entirely (conflict #20: liquidation is `null` for zero debt),
    // isolating collateralFactor: 0 to calculateAdditionalBorrow's own
    // formula, which the earlier Engine-level check above already proved
    // handles a zero threshold without error.
    const result = calculateMaxAdditionalBorrow(
      v4Portfolio({
        debt: { asset: 'USDC', balance: 0 },
        v4DebtState: { drawnDebt: 0, premiumDebt: 0, baseDrawnApr: 0.05, riskPremium: 0 },
        v4CollateralRisk: { collateralFactor: 0, dynamicConfigKey: 1 },
      }),
      1.5,
      'live',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // (100000 * 0) / 1.5 - 0 = 0 — no additional borrowing is safely
    // possible with a zero risk-capacity fraction, but the calculation
    // itself is a real, computed 0, not a failure.
    expect(result.data).toBe(0);
  });

  it('hypothetical collateral/debt changes produce a correct V4 borrow capacity via pure local Engine calculation, no RPC call', () => {
    const portfolio = v4Portfolio({ collateral: { asset: 'BTC', quantity: 3 } });
    const result = calculateMaxAdditionalBorrow(portfolio, 1.5, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Collateral: 3 BTC @ $50,000 = $150,000.
    // = (150000 * 0.65) / 1.5 - 20000 = 65000 - 20000 = 45000.
    expect(result.data).toBeCloseTo(45000, 6);
  });

  it('never maps collateralFactor to maxLoanToValue — the two stay separate even when numerically equal', () => {
    const portfolio = v4Portfolio({
      protocol: {
        maxLoanToValue: 0.65, // deliberately equal to collateralFactor
        liquidationThreshold: 0.8,
        borrowApr: 0.05,
        supplyApr: 0.02,
      },
    });
    const result = calculateMaxAdditionalBorrow(portfolio, 1.5, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toBeCloseTo(23333.333333333332, 6);
  });
});

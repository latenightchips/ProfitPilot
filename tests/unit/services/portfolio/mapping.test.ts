import { describe, expect, it } from 'vitest';

import {
  checkAaveV4CollateralRiskAvailable,
  checkAaveV4DebtStateAvailable,
  deriveAaveV4EffectiveBorrowRate,
  deriveV4DebtStateAfterDelta,
  mapApplicationPortfolioToEngineInput,
  mapPersistencePortfolioToApplicationPortfolio,
  projectAaveV4AnnualInterestCost,
  projectAaveV4InterestCost,
  resolveCanonicalDebtBalance,
  resolveRiskCapacityFraction,
} from '@/services/portfolio/mapping';
import type {
  AaveV4DebtState,
  ApplicationPortfolio,
  PersistencePortfolio,
} from '@/services/portfolio/models';

/**
 * Portfolio Mapping Utilities — 06_TASKS.md M3-004.
 */
const validPersistence: PersistencePortfolio = {
  collateral: { asset: 'BTC', quantity: 1.5 },
  debt: { asset: 'USDC', balance: 20000 },
  market: { btcPriceUsd: 65000 },
  protocol: {
    maxLoanToValue: 0.8,
    liquidationThreshold: 0.83,
    borrowApr: 0.05,
    supplyApr: 0.02,
  },
};

describe('mapPersistencePortfolioToApplicationPortfolio (M3-004)', () => {
  it('maps a fully-populated, valid persistence Portfolio to an ApplicationPortfolio', () => {
    const result = mapPersistencePortfolioToApplicationPortfolio(validPersistence);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual({
      collateral: { asset: 'BTC', quantity: 1.5 },
      debt: { asset: 'USDC', balance: 20000 },
      market: { btcPriceUsd: 65000 },
      protocol: {
        maxLoanToValue: 0.8,
        liquidationThreshold: 0.83,
        borrowApr: 0.05,
        supplyApr: 0.02,
      },
    });
  });

  it('does not have a data field on a failure result (discriminated union, not a nullable envelope)', () => {
    const result = mapPersistencePortfolioToApplicationPortfolio({});
    expect('data' in result).toBe(false);
  });

  it('does not have an errors field on a success result (discriminated union, not a nullable envelope)', () => {
    const result = mapPersistencePortfolioToApplicationPortfolio(validPersistence);
    expect('errors' in result).toBe(false);
  });

  it('fails when the collateral asset is not BTC', () => {
    const result = mapPersistencePortfolioToApplicationPortfolio({
      ...validPersistence,
      collateral: { asset: 'ETH', quantity: 1 },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: 'PORTFOLIO_COLLATERAL_ASSET_INVALID' }),
    );
  });

  it('fails when collateral quantity is missing', () => {
    const result = mapPersistencePortfolioToApplicationPortfolio({
      ...validPersistence,
      collateral: { asset: 'BTC' },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: 'PORTFOLIO_COLLATERAL_QUANTITY_MISSING' }),
    );
  });

  it('fails when collateral quantity is not a finite number', () => {
    const result = mapPersistencePortfolioToApplicationPortfolio({
      ...validPersistence,
      collateral: { asset: 'BTC', quantity: Number.POSITIVE_INFINITY },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: 'PORTFOLIO_COLLATERAL_QUANTITY_MISSING' }),
    );
  });

  it('fails when debt asset is missing', () => {
    const result = mapPersistencePortfolioToApplicationPortfolio({
      ...validPersistence,
      debt: { balance: 1000 },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: 'PORTFOLIO_DEBT_ASSET_MISSING' }),
    );
  });

  it('fails when debt asset is an empty string', () => {
    const result = mapPersistencePortfolioToApplicationPortfolio({
      ...validPersistence,
      debt: { asset: '', balance: 1000 },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: 'PORTFOLIO_DEBT_ASSET_MISSING' }),
    );
  });

  it('fails when debt balance is missing', () => {
    const result = mapPersistencePortfolioToApplicationPortfolio({
      ...validPersistence,
      debt: { asset: 'USDC' },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: 'PORTFOLIO_DEBT_BALANCE_MISSING' }),
    );
  });

  it('fails when market BTC price is missing', () => {
    const result = mapPersistencePortfolioToApplicationPortfolio({
      ...validPersistence,
      market: {},
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: 'PORTFOLIO_MARKET_PRICE_MISSING' }),
    );
  });

  it('fails when protocol maxLoanToValue is missing', () => {
    const result = mapPersistencePortfolioToApplicationPortfolio({
      ...validPersistence,
      protocol: { liquidationThreshold: 0.8, borrowApr: 0.05, supplyApr: 0.02 },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: 'PORTFOLIO_PROTOCOL_MAX_LTV_MISSING' }),
    );
  });

  it('fails when protocol liquidationThreshold is missing', () => {
    const result = mapPersistencePortfolioToApplicationPortfolio({
      ...validPersistence,
      protocol: { maxLoanToValue: 0.8, borrowApr: 0.05, supplyApr: 0.02 },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: 'PORTFOLIO_PROTOCOL_LIQUIDATION_THRESHOLD_MISSING' }),
    );
  });

  it('fails when protocol borrowApr is missing', () => {
    const result = mapPersistencePortfolioToApplicationPortfolio({
      ...validPersistence,
      protocol: { maxLoanToValue: 0.8, liquidationThreshold: 0.83, supplyApr: 0.02 },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: 'PORTFOLIO_PROTOCOL_BORROW_APR_MISSING' }),
    );
  });

  it('fails when protocol supplyApr is missing', () => {
    const result = mapPersistencePortfolioToApplicationPortfolio({
      ...validPersistence,
      protocol: { maxLoanToValue: 0.8, liquidationThreshold: 0.83, borrowApr: 0.05 },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: 'PORTFOLIO_PROTOCOL_SUPPLY_APR_MISSING' }),
    );
  });

  it('aggregates every field-level error across sub-objects rather than stopping at the first', () => {
    const result = mapPersistencePortfolioToApplicationPortfolio({});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const codes = result.errors.map((error) => error.code);
    expect(codes).toContain('PORTFOLIO_COLLATERAL_ASSET_INVALID');
    expect(codes).toContain('PORTFOLIO_COLLATERAL_QUANTITY_MISSING');
    expect(codes).toContain('PORTFOLIO_DEBT_ASSET_MISSING');
    expect(codes).toContain('PORTFOLIO_DEBT_BALANCE_MISSING');
    expect(codes).toContain('PORTFOLIO_MARKET_PRICE_MISSING');
    expect(codes).toContain('PORTFOLIO_PROTOCOL_MAX_LTV_MISSING');
    expect(codes).toContain('PORTFOLIO_PROTOCOL_LIQUIDATION_THRESHOLD_MISSING');
    expect(codes).toContain('PORTFOLIO_PROTOCOL_BORROW_APR_MISSING');
    expect(codes).toContain('PORTFOLIO_PROTOCOL_SUPPLY_APR_MISSING');
  });

  it('every error is categorized as validation', () => {
    const result = mapPersistencePortfolioToApplicationPortfolio({});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.every((error) => error.category === 'validation')).toBe(true);
  });
});

describe('mapApplicationPortfolioToEngineInput (M3-004)', () => {
  it('maps an ApplicationPortfolio to an Engine-compatible PortfolioInput with exactly the 4 fields', () => {
    const application: ApplicationPortfolio = {
      collateral: { asset: 'BTC', quantity: 2 },
      debt: { asset: 'USDC', balance: 30000 },
      market: { btcPriceUsd: 70000 },
      protocol: {
        maxLoanToValue: 0.75,
        liquidationThreshold: 0.8,
        borrowApr: 0.06,
        supplyApr: 0.03,
      },
    };
    const engineInput = mapApplicationPortfolioToEngineInput(application);
    expect(engineInput).toEqual(application);
    expect(Object.keys(engineInput).sort()).toEqual(['collateral', 'debt', 'market', 'protocol']);
  });

  it('drops unrelated fields that may exist on a future-extended ApplicationPortfolio', () => {
    const extended = {
      collateral: { asset: 'BTC' as const, quantity: 1 },
      debt: { asset: 'USDC', balance: 1000 },
      market: { btcPriceUsd: 50000 },
      protocol: {
        maxLoanToValue: 0.8,
        liquidationThreshold: 0.83,
        borrowApr: 0.05,
        supplyApr: 0.02,
      },
      name: 'My Portfolio',
      id: 'abc-123',
    };
    const engineInput = mapApplicationPortfolioToEngineInput(extended);
    expect(Object.keys(engineInput).sort()).toEqual(['collateral', 'debt', 'market', 'protocol']);
  });
});

/**
 * Canonical V4 debt balance — V4 Readiness Audit §12 Stage 9. See
 * `mapApplicationPortfolioToEngineInput`'s own doc comment for the full
 * reasoning: this is the one shared chokepoint every debt-consuming
 * Service reads through, so fixing it here fixes all of them at once.
 */
describe('mapApplicationPortfolioToEngineInput — canonical V4 debt (Stage 9)', () => {
  function v4Application(overrides: Partial<ApplicationPortfolio> = {}): ApplicationPortfolio {
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

  it('uses drawnDebt + premiumDebt from v4DebtState when protocolVersion is "v4" and v4DebtState is present', () => {
    const application = v4Application({
      protocolVersion: 'v4',
      v4DebtState: { drawnDebt: 15000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.01 },
    });
    const engineInput = mapApplicationPortfolioToEngineInput(application);
    expect(engineInput.debt.balance).toBe(15500);
  });

  it('uses the canonical total even when it deliberately disagrees with the legacy debt.balance field', () => {
    const application = v4Application({
      debt: { asset: 'USDC', balance: 999999 },
      protocolVersion: 'v4',
      v4DebtState: { drawnDebt: 15000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.01 },
    });
    const engineInput = mapApplicationPortfolioToEngineInput(application);
    expect(engineInput.debt.balance).toBe(15500);
    expect(engineInput.debt.balance).not.toBe(999999);
  });

  it('preserves debt.asset unchanged alongside the canonical balance', () => {
    const application = v4Application({
      debt: { asset: 'USDT', balance: 20000 },
      protocolVersion: 'v4',
      v4DebtState: { drawnDebt: 15000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.01 },
    });
    const engineInput = mapApplicationPortfolioToEngineInput(application);
    expect(engineInput.debt.asset).toBe('USDT');
  });

  it('still returns the legacy debt.balance (infallible, no substitution) when protocolVersion is "v4" but v4DebtState is undefined', () => {
    const application = v4Application({ protocolVersion: 'v4' });
    const engineInput = mapApplicationPortfolioToEngineInput(application);
    expect(engineInput.debt.balance).toBe(20000);
  });

  it('never substitutes for a "v3" portfolio, even when v4DebtState happens to be present (no cross-inference)', () => {
    const application = v4Application({
      protocolVersion: 'v3',
      v4DebtState: { drawnDebt: 15000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.01 },
    });
    const engineInput = mapApplicationPortfolioToEngineInput(application);
    expect(engineInput.debt.balance).toBe(20000);
  });

  it('never substitutes when protocolVersion is unset, even when v4DebtState happens to be present (no cross-inference)', () => {
    const application = v4Application({
      v4DebtState: { drawnDebt: 15000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.01 },
    });
    const engineInput = mapApplicationPortfolioToEngineInput(application);
    expect(engineInput.debt.balance).toBe(20000);
  });

  it('a plain V3 portfolio (neither field ever set) is byte-identical to before Stage 9', () => {
    const application = v4Application();
    const engineInput = mapApplicationPortfolioToEngineInput(application);
    expect(engineInput).toEqual({
      collateral: { asset: 'BTC', quantity: 2 },
      debt: { asset: 'USDC', balance: 20000 },
      market: { btcPriceUsd: 50000 },
      protocol: {
        maxLoanToValue: 0.75,
        liquidationThreshold: 0.8,
        borrowApr: 0.05,
        supplyApr: 0.02,
      },
    });
  });
});

/**
 * `resolveCanonicalDebtBalance` — V4 Readiness Audit §12 Stage 16. The
 * exact same `drawnDebt + premiumDebt` sum `mapApplicationPortfolioToEngineInput`
 * already performs, extracted so every other V4 consumer (Debt form edit
 * delta, Exit Planner target, Loop→Simulation delta, Scenario Builder
 * validation, Portfolios list badge, Dashboard debt quantity, CSV/exit
 * export) can reuse the identical derivation instead of reading
 * `debt.balance` directly.
 */
describe('resolveCanonicalDebtBalance (Stage 16)', () => {
  function v4Application(overrides: Partial<ApplicationPortfolio> = {}): ApplicationPortfolio {
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

  it('returns drawnDebt + premiumDebt for a V4 portfolio with synced state, ignoring a deliberately disagreeing debt.balance', () => {
    const application = v4Application({
      debt: { asset: 'USDC', balance: 999999 },
      protocolVersion: 'v4',
      v4DebtState: { drawnDebt: 15000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.01 },
    });
    expect(resolveCanonicalDebtBalance(application)).toBe(15500);
    expect(resolveCanonicalDebtBalance(application)).not.toBe(999999);
  });

  it('matches mapApplicationPortfolioToEngineInput exactly for the same portfolio (single source of truth, not a parallel derivation)', () => {
    const application = v4Application({
      protocolVersion: 'v4',
      v4DebtState: { drawnDebt: 15000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.01 },
    });
    expect(resolveCanonicalDebtBalance(application)).toBe(
      mapApplicationPortfolioToEngineInput(application).debt.balance,
    );
  });

  it('falls back to the legacy debt.balance (infallible, no substitution) when v4DebtState is missing', () => {
    const application = v4Application({ protocolVersion: 'v4' });
    expect(resolveCanonicalDebtBalance(application)).toBe(20000);
  });

  it('never substitutes for a V3 (or unset) portfolio, even when v4DebtState happens to be present (no cross-inference)', () => {
    const withStrayState = v4Application({
      v4DebtState: { drawnDebt: 15000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.01 },
    });
    expect(resolveCanonicalDebtBalance(withStrayState)).toBe(20000);
    expect(resolveCanonicalDebtBalance({ ...withStrayState, protocolVersion: 'v3' })).toBe(20000);
  });
});

/**
 * V4 fail-closed guard — V4 Readiness Audit §12 Stage 10. Promoted from
 * `services/portfolio/summary.ts`'s own original Stage 9 inline check so
 * `services/loop/strategy.ts`/`services/portfolio/interestBreakdown.ts`/
 * `services/recommendation/*` can enforce the identical rule. See each of
 * those Services' own test files for the integrated (not just unit-level)
 * proof that the guard is actually wired in.
 */
describe('checkAaveV4DebtStateAvailable (Stage 10)', () => {
  const tracked = { engineVersion: '1.0.0', formulaVersion: '1.0' };

  function v4Application(overrides: Partial<ApplicationPortfolio> = {}): ApplicationPortfolio {
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

  it('returns null (no failure) for a "v4" portfolio with v4DebtState present', () => {
    const application = v4Application({
      protocolVersion: 'v4',
      v4DebtState: { drawnDebt: 15000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.01 },
    });
    expect(checkAaveV4DebtStateAvailable(application, tracked, 'live')).toBeNull();
  });

  it('returns an AAVE_V4_DEBT_STATE_MISSING failure for a "v4" portfolio with no v4DebtState', () => {
    const application = v4Application({ protocolVersion: 'v4' });
    const failure = checkAaveV4DebtStateAvailable(application, tracked, 'live');
    expect(failure).not.toBeNull();
    expect(failure?.ok).toBe(false);
    expect(failure?.errors[0]).toMatchObject({
      category: 'calculation',
      code: 'AAVE_V4_DEBT_STATE_MISSING',
    });
  });

  it('threads sourceStatus and the caller-supplied tracked metadata through, never fabricating it', () => {
    const application = v4Application({ protocolVersion: 'v4' });
    const failure = checkAaveV4DebtStateAvailable(
      application,
      { engineVersion: '9.9.9', formulaVersion: '2.0' },
      'manual',
    );
    expect(failure?.metadata.sourceStatus).toBe('manual');
    expect(failure?.metadata.engineVersion).toBe('9.9.9');
    expect(failure?.metadata.formulaVersion).toBe('2.0');
  });

  it('returns null for a "v3" portfolio even when v4DebtState happens to be present (no cross-inference)', () => {
    const application = v4Application({
      protocolVersion: 'v3',
      v4DebtState: { drawnDebt: 15000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.01 },
    });
    expect(checkAaveV4DebtStateAvailable(application, tracked, 'live')).toBeNull();
  });

  it('returns null when protocolVersion is unset, even when v4DebtState happens to be present (no cross-inference)', () => {
    const application = v4Application({
      v4DebtState: { drawnDebt: 15000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.01 },
    });
    expect(checkAaveV4DebtStateAvailable(application, tracked, 'live')).toBeNull();
  });
});

/**
 * V4 collateral-risk fail-closed guard — V4 Readiness Audit §12 Stage
 * 23D. Same shape/reasoning as `checkAaveV4DebtStateAvailable` above, now
 * for `v4CollateralRisk` (Stage 23C).
 */
describe('checkAaveV4CollateralRiskAvailable (Stage 23D)', () => {
  const tracked = { engineVersion: '1.0.0', formulaVersion: '1.0' };

  function v4Application(overrides: Partial<ApplicationPortfolio> = {}): ApplicationPortfolio {
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

  it('returns null (no failure) for a "v4" portfolio with v4CollateralRisk present', () => {
    const application = v4Application({
      protocolVersion: 'v4',
      v4CollateralRisk: { collateralFactor: 0.75, dynamicConfigKey: 3 },
    });
    expect(checkAaveV4CollateralRiskAvailable(application, tracked, 'live')).toBeNull();
  });

  it('returns null for a "v4" portfolio with collateralFactor: 0 — a real, synced zero-weight config is not "missing"', () => {
    const application = v4Application({
      protocolVersion: 'v4',
      v4CollateralRisk: { collateralFactor: 0, dynamicConfigKey: 3 },
    });
    expect(checkAaveV4CollateralRiskAvailable(application, tracked, 'live')).toBeNull();
  });

  it('returns an AAVE_V4_COLLATERAL_RISK_MISSING failure for a "v4" portfolio with no v4CollateralRisk', () => {
    const application = v4Application({ protocolVersion: 'v4' });
    const failure = checkAaveV4CollateralRiskAvailable(application, tracked, 'live');
    expect(failure).not.toBeNull();
    expect(failure?.ok).toBe(false);
    expect(failure?.errors[0]).toMatchObject({
      category: 'calculation',
      code: 'AAVE_V4_COLLATERAL_RISK_MISSING',
    });
  });

  it('threads sourceStatus and the caller-supplied tracked metadata through, never fabricating it', () => {
    const application = v4Application({ protocolVersion: 'v4' });
    const failure = checkAaveV4CollateralRiskAvailable(
      application,
      { engineVersion: '9.9.9', formulaVersion: '2.0' },
      'manual',
    );
    expect(failure?.metadata.sourceStatus).toBe('manual');
    expect(failure?.metadata.engineVersion).toBe('9.9.9');
    expect(failure?.metadata.formulaVersion).toBe('2.0');
  });

  it('returns null for a "v3" portfolio even when v4CollateralRisk happens to be present (no cross-inference)', () => {
    const application = v4Application({
      protocolVersion: 'v3',
      v4CollateralRisk: { collateralFactor: 0.75, dynamicConfigKey: 3 },
    });
    expect(checkAaveV4CollateralRiskAvailable(application, tracked, 'live')).toBeNull();
  });

  it('returns null when protocolVersion is unset, even when v4CollateralRisk happens to be present (no cross-inference)', () => {
    const application = v4Application({
      v4CollateralRisk: { collateralFactor: 0.75, dynamicConfigKey: 3 },
    });
    expect(checkAaveV4CollateralRiskAvailable(application, tracked, 'live')).toBeNull();
  });
});

/**
 * `resolveRiskCapacityFraction` — V4 Readiness Audit §12 Stage 23D. The
 * single risk-capacity fraction Health Factor/liquidation/borrow-capacity
 * dispatch by protocol version: V3 unchanged (`protocol.liquidationThreshold`);
 * V4 uses `v4CollateralRisk.collateralFactor`, never a reuse of the V3
 * field — see the function's own doc comment for why it returns `null`
 * (never a silent V3 fallback) when V4 data is unavailable.
 */
describe('resolveRiskCapacityFraction (Stage 23D)', () => {
  function v4Application(overrides: Partial<ApplicationPortfolio> = {}): ApplicationPortfolio {
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

  it('returns protocol.liquidationThreshold for a "v3" portfolio', () => {
    expect(resolveRiskCapacityFraction(v4Application({ protocolVersion: 'v3' }))).toBe(0.8);
  });

  it('returns protocol.liquidationThreshold when protocolVersion is unset (backward-compatible default)', () => {
    expect(resolveRiskCapacityFraction(v4Application())).toBe(0.8);
  });

  it('returns v4CollateralRisk.collateralFactor for a "v4" portfolio, never protocol.liquidationThreshold', () => {
    const application = v4Application({
      protocolVersion: 'v4',
      v4CollateralRisk: { collateralFactor: 0.7, dynamicConfigKey: 2 },
    });
    expect(resolveRiskCapacityFraction(application)).toBe(0.7);
    expect(resolveRiskCapacityFraction(application)).not.toBe(0.8);
  });

  it('never maps collateralFactor to maxLoanToValue either — the two concepts stay separate', () => {
    const application = v4Application({
      protocolVersion: 'v4',
      protocol: {
        maxLoanToValue: 0.6,
        liquidationThreshold: 0.8,
        borrowApr: 0.05,
        supplyApr: 0.02,
      },
      v4CollateralRisk: { collateralFactor: 0.7, dynamicConfigKey: 2 },
    });
    expect(resolveRiskCapacityFraction(application)).toBe(0.7);
    expect(resolveRiskCapacityFraction(application)).not.toBe(0.6);
    expect(resolveRiskCapacityFraction(application)).not.toBe(0.8);
  });

  it('preserves collateralFactor: 0 as real data, not missing — returns 0, not null or a V3 fallback', () => {
    const application = v4Application({
      protocolVersion: 'v4',
      v4CollateralRisk: { collateralFactor: 0, dynamicConfigKey: 2 },
    });
    expect(resolveRiskCapacityFraction(application)).toBe(0);
  });

  it('returns null for a "v4" portfolio with no v4CollateralRisk — never silently falls back to protocol.liquidationThreshold', () => {
    const application = v4Application({ protocolVersion: 'v4' });
    expect(resolveRiskCapacityFraction(application)).toBeNull();
  });

  it('a deliberately conflicting V3/V4 fixture selects the correct branch strictly by protocolVersion', () => {
    const sharedFields = {
      collateral: { asset: 'BTC' as const, quantity: 2 },
      debt: { asset: 'USDC', balance: 20000 },
      market: { btcPriceUsd: 50000 },
      protocol: {
        maxLoanToValue: 0.75,
        liquidationThreshold: 0.8,
        borrowApr: 0.05,
        supplyApr: 0.02,
      },
      v4CollateralRisk: { collateralFactor: 0.65, dynamicConfigKey: 4 },
    };
    expect(resolveRiskCapacityFraction({ ...sharedFields, protocolVersion: 'v3' })).toBe(0.8);
    expect(resolveRiskCapacityFraction({ ...sharedFields, protocolVersion: 'v4' })).toBe(0.65);
  });
});

/**
 * V4 Annual Interest via the real V4 accrual engine — V4 Readiness Audit
 * §12 Stage 10. Replaces `calculateAnnualInterest(debtValue, protocol.borrowApr)`
 * for a V4 portfolio, which was rate-questionable (a V3-shaped scalar with
 * no defined relationship to V4's real `baseDrawnApr`/`riskPremium` pair).
 */
describe('projectAaveV4AnnualInterestCost (Stage 10)', () => {
  it('computes the real 365-day V4 projected accrual, not a simple rate*balance multiplication', () => {
    // Same regression vector as the Stage 8 Engine-integration tests
    // (tests/unit/engine/protocols/aaveV4/projectAaveV4Debt.test.ts):
    // drawnDebt 20000, premiumDebt 500, baseDrawnApr 0.05, riskPremium 0.1,
    // elapsedDays 365 -> totalDebt 21600.
    const result = projectAaveV4AnnualInterestCost({
      drawnDebt: 20000,
      premiumDebt: 500,
      baseDrawnApr: 0.05,
      riskPremium: 0.1,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 21600 - 20500 = 1100, not the legacy V3-shaped formula's answer
    // (20500 * 0.05 = 1025).
    expect(result.value).toBeCloseTo(1100, 6);
    expect(result.value).not.toBeCloseTo(1025, 6);
  });

  it('returns 0 when both baseDrawnApr and riskPremium are 0 (no accrual)', () => {
    const result = projectAaveV4AnnualInterestCost({
      drawnDebt: 10000,
      premiumDebt: 0,
      baseDrawnApr: 0,
      riskPremium: 0,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBe(0);
  });

  it('propagates a genuine Engine failure (negative drawnDebt) rather than throwing', () => {
    const result = projectAaveV4AnnualInterestCost({
      drawnDebt: -1,
      premiumDebt: 0,
      baseDrawnApr: 0.05,
      riskPremium: 0.01,
    });
    expect(result.ok).toBe(false);
  });
});

/**
 * V4 interest cost over an arbitrary holding period — V4 Readiness Audit
 * §12 Stage 11 (generalizes Stage 10's `projectAaveV4AnnualInterestCost`,
 * which now delegates here with `elapsedDays: 365`).
 */
describe('projectAaveV4InterestCost (Stage 11)', () => {
  const v4DebtState: AaveV4DebtState = {
    drawnDebt: 15000,
    premiumDebt: 500,
    baseDrawnApr: 0.05,
    riskPremium: 0.01,
  };

  it('projects the real 1-day and 30-day V4 accrual, matching independently-derived Engine values', () => {
    // Independently computed via projectAaveV4Debt directly (same Engine
    // dispatch this function calls).
    const daily = projectAaveV4InterestCost(v4DebtState, 1);
    const monthly = projectAaveV4InterestCost(v4DebtState, 30);
    expect(daily.ok).toBe(true);
    expect(monthly.ok).toBe(true);
    if (!daily.ok || !monthly.ok) return;
    expect(daily.value).toBeCloseTo(2.0753424657541473, 9);
    expect(monthly.value).toBeCloseTo(62.26027397260259, 9);
  });

  it('elapsedDays: 365 matches projectAaveV4AnnualInterestCost exactly (same underlying delegation)', () => {
    const viaGeneral = projectAaveV4InterestCost(v4DebtState, 365);
    const viaAnnual = projectAaveV4AnnualInterestCost(v4DebtState);
    expect(viaGeneral.ok).toBe(true);
    expect(viaAnnual.ok).toBe(true);
    if (!viaGeneral.ok || !viaAnnual.ok) return;
    expect(viaGeneral.value).toBe(viaAnnual.value);
  });

  it('a longer elapsedDays always projects a strictly larger cost for a nonzero rate', () => {
    const daily = projectAaveV4InterestCost(v4DebtState, 1);
    const monthly = projectAaveV4InterestCost(v4DebtState, 30);
    const annual = projectAaveV4InterestCost(v4DebtState, 365);
    expect(daily.ok && monthly.ok && annual.ok).toBe(true);
    if (!daily.ok || !monthly.ok || !annual.ok) return;
    expect(daily.value).toBeLessThan(monthly.value);
    expect(monthly.value).toBeLessThan(annual.value);
  });

  it('propagates a genuine Engine failure (negative elapsedDays) rather than throwing', () => {
    const result = projectAaveV4InterestCost(v4DebtState, -1);
    expect(result.ok).toBe(false);
  });
});

/**
 * V4 effective borrow rate — V4 Readiness Audit §12 Stage 15. Every
 * assertion below cross-checks against an independently-computed
 * `projectAaveV4AnnualInterestCost` call rather than a hand-derived
 * constant, proving this reads the blend back out of the already-trusted
 * cost projection instead of a parallel formula.
 */
describe('deriveAaveV4EffectiveBorrowRate (Stage 15)', () => {
  const tracked = { engineVersion: '1.0.0', formulaVersion: '1.0' };

  it('derives the exact rate implied by the real annual-cost projection (annualCost / currentTotalDebt), not a fabricated blend', () => {
    const v4DebtState: AaveV4DebtState = {
      drawnDebt: 20000,
      premiumDebt: 500,
      baseDrawnApr: 0.05,
      riskPremium: 0.1,
    };
    const costResult = projectAaveV4AnnualInterestCost(v4DebtState);
    expect(costResult.ok).toBe(true);
    if (!costResult.ok) return;

    const result = deriveAaveV4EffectiveBorrowRate(v4DebtState, tracked, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Same Stage 10 regression vector: annualCost 1100 / totalDebt 20500.
    expect(result.value).toBe(costResult.value / 20500);
    expect(result.value).toBeCloseTo(0.05365853658536585, 10);
    // Never the naive/legacy baseDrawnApr-only reading — the risk-premium
    // markup genuinely changes the blended rate.
    expect(result.value).not.toBeCloseTo(0.05, 3);
  });

  it('matches an independently-computed annualCost/totalDebt exactly for a drawn-only position (no premium)', () => {
    const v4DebtState: AaveV4DebtState = {
      drawnDebt: 10000,
      premiumDebt: 0,
      baseDrawnApr: 0.06,
      riskPremium: 0,
    };
    const costResult = projectAaveV4AnnualInterestCost(v4DebtState);
    expect(costResult.ok).toBe(true);
    if (!costResult.ok) return;

    const result = deriveAaveV4EffectiveBorrowRate(v4DebtState, tracked, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBe(costResult.value / 10000);
    expect(result.value).toBeCloseTo(0.06, 4);
  });

  it('falls back to baseDrawnApr (never protocol.borrowApr, never NaN/Infinity) when current total debt is exactly zero', () => {
    const v4DebtState: AaveV4DebtState = {
      drawnDebt: 0,
      premiumDebt: 0,
      baseDrawnApr: 0.07,
      riskPremium: 0.2,
    };
    const result = deriveAaveV4EffectiveBorrowRate(v4DebtState, tracked, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBe(0.07);
    expect(Number.isFinite(result.value)).toBe(true);
  });

  it('propagates a genuine Engine failure (negative drawnDebt) rather than throwing or fabricating a rate', () => {
    const result = deriveAaveV4EffectiveBorrowRate(
      { drawnDebt: -1, premiumDebt: 0, baseDrawnApr: 0.05, riskPremium: 0.01 },
      tracked,
      'live',
    );
    expect(result.ok).toBe(false);
  });

  it('threads the caller-supplied tracked metadata through unchanged on success', () => {
    const v4DebtState: AaveV4DebtState = {
      drawnDebt: 10000,
      premiumDebt: 0,
      baseDrawnApr: 0.05,
      riskPremium: 0.01,
    };
    const result = deriveAaveV4EffectiveBorrowRate(v4DebtState, tracked, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tracked).toEqual(tracked);
  });
});

/**
 * V4 post-change debt state — V4 Readiness Audit §12 Stage 11, resolved
 * with a real protocol-backed rule at Stage 12. ANY repayment (partial or
 * full) is now fully deterministic, delegated to the real Engine formula
 * (`deriveAaveV4DebtAfterRepayment`, premium-first allocation). A borrow
 * remains genuinely ambiguous (Risk Premium refresh requires the user's
 * full multi-collateral configuration, data this codebase never
 * captures) and still returns `undefined` — see this function's own doc
 * comment in `services/portfolio/mapping.ts` for the full Stage 12
 * protocol-audit reasoning.
 */
describe('deriveV4DebtStateAfterDelta (Stage 11, resolved for repay at Stage 12)', () => {
  const v4DebtState: AaveV4DebtState = {
    drawnDebt: 15000,
    premiumDebt: 5000,
    baseDrawnApr: 0.05,
    riskPremium: 0.01,
  };
  const tracked = { engineVersion: '1.0.0', formulaVersion: '1.0' };

  it('returns the state unchanged (reference-identical) for a zero delta (a genuine no-op, not a guess, no Engine call)', () => {
    const result = deriveV4DebtStateAfterDelta(v4DebtState, 0, tracked, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBe(v4DebtState);
    expect(result.tracked).toBe(tracked);
  });

  it('zeroes both drawnDebt and premiumDebt when the delta repays the exact total (premium-first allocation, both streams reach exactly $0)', () => {
    const result = deriveV4DebtStateAfterDelta(v4DebtState, -20000, tracked, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({
      drawnDebt: 0,
      premiumDebt: 0,
      baseDrawnApr: 0.05,
      riskPremium: 0.01,
    });
  });

  it('preserves baseDrawnApr/riskPremium unchanged after a repayment (rates are position parameters, never touched by repay on-chain)', () => {
    const result = deriveV4DebtStateAfterDelta(v4DebtState, -20000, tracked, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value?.baseDrawnApr).toBe(0.05);
    expect(result.value?.riskPremium).toBe(0.01);
  });

  it('a partial repayment smaller than premiumDebt reduces ONLY premiumDebt (premium-first allocation, now resolved deterministically)', () => {
    const result = deriveV4DebtStateAfterDelta(v4DebtState, -2000, tracked, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({
      drawnDebt: 15000,
      premiumDebt: 3000,
      baseDrawnApr: 0.05,
      riskPremium: 0.01,
    });
  });

  it('a partial repayment larger than premiumDebt clears premium and reduces drawnDebt with the remainder', () => {
    const result = deriveV4DebtStateAfterDelta(v4DebtState, -12000, tracked, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({
      drawnDebt: 8000,
      premiumDebt: 0,
      baseDrawnApr: 0.05,
      riskPremium: 0.01,
    });
  });

  it('an over-repayment past the total debt is capped — both streams reach exactly $0, not a negative balance', () => {
    const result = deriveV4DebtStateAfterDelta(v4DebtState, -25000, tracked, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({
      drawnDebt: 0,
      premiumDebt: 0,
      baseDrawnApr: 0.05,
      riskPremium: 0.01,
    });
  });

  it('zeroes correctly even when drawnDebt or premiumDebt alone is already 0', () => {
    const drawnOnly: AaveV4DebtState = {
      drawnDebt: 15000,
      premiumDebt: 0,
      baseDrawnApr: 0.05,
      riskPremium: 0.01,
    };
    const result = deriveV4DebtStateAfterDelta(drawnOnly, -15000, tracked, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({
      drawnDebt: 0,
      premiumDebt: 0,
      baseDrawnApr: 0.05,
      riskPremium: 0.01,
    });
  });

  it('returns undefined for any nonzero borrow — genuinely ambiguous (Risk Premium refresh requires full collateral data this codebase never captures)', () => {
    const result = deriveV4DebtStateAfterDelta(v4DebtState, 10000, tracked, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBeUndefined();
  });

  it('threads real Engine metadata through for a repayment (a genuine Engine call happened)', () => {
    const result = deriveV4DebtStateAfterDelta(v4DebtState, -2000, tracked, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tracked.formulaVersion).toBe('1.0');
  });

  it('propagates a genuine Engine failure rather than throwing (negative drawnDebt reaching the repayment formula)', () => {
    const invalidState: AaveV4DebtState = {
      drawnDebt: -1,
      premiumDebt: 0,
      baseDrawnApr: 0.05,
      riskPremium: 0.01,
    };
    const result = deriveV4DebtStateAfterDelta(invalidState, -100, tracked, 'live');
    expect(result.ok).toBe(false);
  });
});

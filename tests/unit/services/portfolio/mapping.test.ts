import { describe, expect, it } from 'vitest';

import {
  mapApplicationPortfolioToEngineInput,
  mapPersistencePortfolioToApplicationPortfolio,
} from '@/services/portfolio/mapping';
import type { ApplicationPortfolio, PersistencePortfolio } from '@/services/portfolio/models';

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

import { describe, expect, it } from 'vitest';

import type {
  ApplicationPortfolio,
  PersistenceCollateralPosition,
  PersistenceDebtPosition,
  PersistenceMarketPrices,
  PersistencePortfolio,
  PersistenceProtocolParameters,
} from '@/services/portfolio/models';

/**
 * Portfolio models — 06_TASKS.md M3-004.
 *
 * These are plain structural types (no runtime behavior of their own), so
 * the tests exist to prove the shapes actually compile against real
 * literal values and stay assignable to `PortfolioInput`'s own field
 * types (`@/engine`), which is the whole point of reusing them directly
 * rather than duplicating them.
 */
describe('Portfolio models (M3-004)', () => {
  it('ApplicationPortfolio accepts a value built from real Engine-compatible fields', () => {
    const application: ApplicationPortfolio = {
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
    expect(application.collateral.asset).toBe('BTC');
  });

  it('PersistenceCollateralPosition allows missing and null fields', () => {
    const empty: PersistenceCollateralPosition = {};
    const nulled: PersistenceCollateralPosition = { asset: null, quantity: null };
    expect(empty).toEqual({});
    expect(nulled).toEqual({ asset: null, quantity: null });
  });

  it('PersistenceDebtPosition allows missing and null fields', () => {
    const empty: PersistenceDebtPosition = {};
    const nulled: PersistenceDebtPosition = { asset: null, balance: null };
    expect(empty).toEqual({});
    expect(nulled).toEqual({ asset: null, balance: null });
  });

  it('PersistenceMarketPrices allows missing and null fields', () => {
    const empty: PersistenceMarketPrices = {};
    const nulled: PersistenceMarketPrices = { btcPriceUsd: null };
    expect(empty).toEqual({});
    expect(nulled).toEqual({ btcPriceUsd: null });
  });

  it('PersistenceProtocolParameters allows missing and null fields', () => {
    const empty: PersistenceProtocolParameters = {};
    const nulled: PersistenceProtocolParameters = {
      maxLoanToValue: null,
      liquidationThreshold: null,
      borrowApr: null,
      supplyApr: null,
    };
    expect(empty).toEqual({});
    expect(nulled.maxLoanToValue).toBeNull();
  });

  it('PersistencePortfolio allows a fully-populated shape', () => {
    const persistence: PersistencePortfolio = {
      collateral: { asset: 'BTC', quantity: 1 },
      debt: { asset: 'USDC', balance: 1000 },
      market: { btcPriceUsd: 50000 },
      protocol: {
        maxLoanToValue: 0.75,
        liquidationThreshold: 0.8,
        borrowApr: 0.04,
        supplyApr: 0.01,
      },
    };
    expect(persistence.collateral?.asset).toBe('BTC');
  });

  it('PersistencePortfolio allows a fully-empty shape', () => {
    const persistence: PersistencePortfolio = {};
    expect(persistence).toEqual({});
  });
});

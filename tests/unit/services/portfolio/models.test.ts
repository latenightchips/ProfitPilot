import { describe, expect, it } from 'vitest';

import type {
  AaveV4PositionIdentity,
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

/**
 * `AaveV4PositionIdentity`/`ApplicationPortfolio.v4Position` — Stage 4A
 * (V4 Readiness Audit §12). Mirrors `protocolVersion`'s own test coverage
 * style directly above: plain structural types, tested by compiling real
 * literal values against them.
 */
describe('AaveV4PositionIdentity / ApplicationPortfolio.v4Position (Stage 4A)', () => {
  function basePortfolio(): ApplicationPortfolio {
    return {
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
  }

  it('ApplicationPortfolio accepts a value with v4Position set', () => {
    const v4Position: AaveV4PositionIdentity = {
      userAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
    };
    const application: ApplicationPortfolio = { ...basePortfolio(), v4Position };
    expect(application.v4Position?.userAddress).toBe('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045');
  });

  it('ApplicationPortfolio remains valid without v4Position (backward compatible, same as protocolVersion)', () => {
    const application: ApplicationPortfolio = basePortfolio();
    expect(application.v4Position).toBeUndefined();
  });

  it('a V3 portfolio (no protocolVersion, no v4Position) is unchanged from existing behavior', () => {
    const application: ApplicationPortfolio = basePortfolio();
    expect(application.protocolVersion).toBeUndefined();
    expect(application.v4Position).toBeUndefined();
    expect(application.collateral.asset).toBe('BTC');
  });

  it('does not duplicate debt.asset — v4Position carries only userAddress', () => {
    const v4Position: AaveV4PositionIdentity = {
      userAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
    };
    expect(Object.keys(v4Position)).toEqual(['userAddress']);
  });

  /**
   * Field-level JSON round-trip only — proves `v4Position` is plain,
   * storage-safe data (no bigint/class/Map, nothing `JSON.stringify`
   * would silently drop or mangle). NOT a full persistence-pipeline
   * round-trip: `PersistencePortfolio`/`mapPersistencePortfolioToApplicationPortfolio`/
   * `services/persistence/schemas/portfolio.schema.ts` do not read or
   * write this field yet, deliberately, mirroring `protocolVersion`'s own
   * current scope — see this file's own `ApplicationPortfolio` header
   * comment for why.
   */
  it('v4Position survives a plain JSON serialization round-trip', () => {
    const application: ApplicationPortfolio = {
      ...basePortfolio(),
      v4Position: { userAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' },
    };
    const roundTripped: ApplicationPortfolio = JSON.parse(JSON.stringify(application));
    expect(roundTripped.v4Position).toEqual(application.v4Position);
  });
});

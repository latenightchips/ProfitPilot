import { describe, expect, it } from 'vitest';

import { mapAaveV3Snapshot } from '@/infrastructure/protocols/aave/v3/mapAaveV3Snapshot';
import type { RawAaveV3Snapshot } from '@/infrastructure/protocols/aave/v3/types';

function baseSnapshot(): RawAaveV3Snapshot {
  return {
    blockNumber: 21_000_000n,
    collateralConfig: {
      decimals: 8n,
      ltv: 7000n,
      liquidationThreshold: 7500n,
      liquidationBonus: 10500n,
      reserveFactor: 1000n,
      usageAsCollateralEnabled: true,
      borrowingEnabled: true,
      stableBorrowRateEnabled: false,
      isActive: true,
      isFrozen: false,
    },
    collateralReserve: {
      unbacked: 0n,
      accruedToTreasuryScaled: 0n,
      totalAToken: 0n,
      totalStableDebt: 0n,
      totalVariableDebt: 0n,
      liquidityRate: 20_000_000_000_000_000_000_000_000n, // 2%
      variableBorrowRate: 0n,
      stableBorrowRate: 0n,
      averageStableBorrowRate: 0n,
      liquidityIndex: 1_000_000_000_000_000_000_000_000_000n,
      variableBorrowIndex: 1_000_000_000_000_000_000_000_000_000n,
      lastUpdateTimestamp: 1_700_000_000,
    },
    collateralPrice: {
      price: 6_500_000_000_000n, // $65,000 at 8 oracle decimals
      baseCurrencyUnit: 100_000_000n,
    },
    borrowReserve: {
      unbacked: 0n,
      accruedToTreasuryScaled: 0n,
      totalAToken: 0n,
      totalStableDebt: 0n,
      totalVariableDebt: 0n,
      liquidityRate: 0n,
      variableBorrowRate: 50_000_000_000_000_000_000_000_000n, // 5%
      stableBorrowRate: 0n,
      averageStableBorrowRate: 0n,
      liquidityIndex: 1_000_000_000_000_000_000_000_000_000n,
      variableBorrowIndex: 1_000_000_000_000_000_000_000_000_000n,
      lastUpdateTimestamp: 1_700_000_000,
    },
    collateralDecimals: 8,
    borrowDecimals: 6,
  };
}

describe('mapAaveV3Snapshot — pure unit conversion, no calculation', () => {
  it('maps raw contract values to the adapter output shape', () => {
    const data = mapAaveV3Snapshot(baseSnapshot(), {
      network: 'Ethereum Mainnet',
      collateralSymbol: 'WBTC',
      borrowSymbol: 'USDC',
      now: '2026-08-14T00:00:00.000Z',
    });

    expect(data.priceCandidate).toEqual({
      origin: 'provider',
      price: 65000,
      timestamp: '2026-08-14T00:00:00.000Z',
    });
    expect(data.protocolCandidate.parameters).toEqual({
      maxLoanToValue: 0.7,
      liquidationThreshold: 0.75,
      borrowApr: 0.05,
      supplyApr: 0.02,
    });
    expect(data.protocolCandidate.origin).toBe('live');
    expect(data.collateralSymbol).toBe('WBTC');
    expect(data.borrowSymbol).toBe('USDC');
  });

  it('stamps source metadata including the pinned block number', () => {
    const data = mapAaveV3Snapshot(baseSnapshot(), {
      network: 'Ethereum Mainnet',
      collateralSymbol: 'WBTC',
      borrowSymbol: 'USDC',
      now: '2026-08-14T00:00:00.000Z',
    });

    expect(data.source).toEqual({
      protocol: 'aave',
      version: 'v3',
      network: 'Ethereum Mainnet',
      method: 'rpc',
      blockNumber: '21000000',
    });
  });

  it("derives protocolCandidate.timestamp from the reserve's lastUpdateTimestamp, not the caller's now", () => {
    const data = mapAaveV3Snapshot(baseSnapshot(), {
      network: 'Ethereum Mainnet',
      collateralSymbol: 'WBTC',
      borrowSymbol: 'USDC',
      now: '2026-08-14T00:00:00.000Z',
    });
    expect(data.protocolCandidate.timestamp).toBe(new Date(1_700_000_000 * 1000).toISOString());
  });
});

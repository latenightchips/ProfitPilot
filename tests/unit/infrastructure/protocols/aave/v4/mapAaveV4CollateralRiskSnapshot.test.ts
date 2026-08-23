import { describe, expect, it } from 'vitest';

import { mapAaveV4CollateralRiskSnapshot } from '@/infrastructure/protocols/aave/v4/mapAaveV4CollateralRiskSnapshot';
import type { RawAaveV4CollateralRiskSnapshot } from '@/infrastructure/protocols/aave/v4/types';

const USER = '0x1111111111111111111111111111111111111111' as const;
const SPOKE = '0x94e7A5dCbE816e498b89aB752661904E2F56c485' as const;

const ORACLE = '0x2222222222222222222222222222222222222222' as const;

function baseSnapshot(): RawAaveV4CollateralRiskSnapshot {
  return {
    blockNumber: 21_000_000n,
    blockTimestamp: 1_700_000_000n,
    spoke: SPOKE,
    collateralReserveId: 11n,
    userDynamicConfigKey: 3,
    dynamicReserveConfig: { collateralFactor: 7500 }, // 75%
    oracle: ORACLE,
    oraclePriceRaw: 6_900_000_000_000n, // $69,000 at 8 decimals
    oracleDecimals: 8,
  };
}

describe('mapAaveV4CollateralRiskSnapshot — pure unit conversion, no accrual math', () => {
  it('maps collateralFactor from BPS to a decimal fraction', () => {
    const data = mapAaveV4CollateralRiskSnapshot(baseSnapshot(), {
      network: 'Ethereum Mainnet',
      collateralSymbol: 'WBTC',
      userAddress: USER,
    });
    expect(data.canonical.collateralFactor).toBeCloseTo(0.75, 10);
  });

  it('carries the user-bound dynamicConfigKey through unchanged, never reprojecting or discarding it', () => {
    const data = mapAaveV4CollateralRiskSnapshot(baseSnapshot(), {
      network: 'Ethereum Mainnet',
      collateralSymbol: 'WBTC',
      userAddress: USER,
    });
    expect(data.canonical.dynamicConfigKey).toBe(3);
  });

  it('stamps display metadata including the pinned block number/timestamp, stringified', () => {
    const data = mapAaveV4CollateralRiskSnapshot(baseSnapshot(), {
      network: 'Ethereum Mainnet',
      collateralSymbol: 'WBTC',
      userAddress: USER,
    });
    expect(data.display).toEqual({
      network: 'Ethereum Mainnet',
      collateralSymbol: 'WBTC',
      spoke: SPOKE,
      reserveId: '11',
      blockNumber: '21000000',
      blockTimestamp: new Date(1_700_000_000 * 1000).toISOString(),
      userAddress: USER,
    });
  });

  it('preserves the raw snapshot unchanged, alongside the derived canonical shape', () => {
    const raw = baseSnapshot();
    const data = mapAaveV4CollateralRiskSnapshot(raw, {
      network: 'Ethereum Mainnet',
      collateralSymbol: 'WBTC',
      userAddress: USER,
    });
    expect(data.raw).toBe(raw);
  });

  it('maps a zero/uninitialized dynamic config (collateralFactor: 0) as the real read, not a special-cased value', () => {
    const raw = baseSnapshot();
    raw.dynamicReserveConfig = { collateralFactor: 0 };
    raw.userDynamicConfigKey = 0;
    const data = mapAaveV4CollateralRiskSnapshot(raw, {
      network: 'Ethereum Mainnet',
      collateralSymbol: 'WBTC',
      userAddress: USER,
    });
    expect(data.canonical.collateralFactor).toBe(0);
    expect(data.canonical.dynamicConfigKey).toBe(0);
  });

  it('derives blockTimestamp display value from blockTimestamp, not from blockNumber or wall-clock time', () => {
    const raw = baseSnapshot();
    raw.blockTimestamp = 1_650_000_000n;
    const data = mapAaveV4CollateralRiskSnapshot(raw, {
      network: 'Ethereum Mainnet',
      collateralSymbol: 'WBTC',
      userAddress: USER,
    });
    expect(data.display.blockTimestamp).toBe(new Date(1_650_000_000 * 1000).toISOString());
  });
});

/**
 * V4 Readiness Audit §12 P1-B — `collateralPriceUsd` normalization.
 * Infrastructure boundary only: this mapper has no opinion on who
 * consumes the value, only that it is scaled correctly using the raw
 * snapshot's OWN `oracleDecimals`, never a hardcoded precision.
 */
describe('mapAaveV4CollateralRiskSnapshot — collateralPriceUsd normalization', () => {
  it('normalizes an 8-decimal oracle price (the reference implementation default) to a plain USD number', () => {
    const raw = baseSnapshot();
    raw.oraclePriceRaw = 6_900_000_000_000n; // $69,000 at 8 decimals
    raw.oracleDecimals = 8;
    const data = mapAaveV4CollateralRiskSnapshot(raw, {
      network: 'Ethereum Mainnet',
      collateralSymbol: 'WBTC',
      userAddress: USER,
    });
    expect(data.canonical.collateralPriceUsd).toBe(69000);
  });

  it('normalizes correctly at a different decimal precision, proving decimals is never hardcoded', () => {
    const raw = baseSnapshot();
    raw.oraclePriceRaw = 69_000_000_000_000_000_000_000n; // $69,000 at 18 decimals
    raw.oracleDecimals = 18;
    const data = mapAaveV4CollateralRiskSnapshot(raw, {
      network: 'Ethereum Mainnet',
      collateralSymbol: 'WBTC',
      userAddress: USER,
    });
    expect(data.canonical.collateralPriceUsd).toBe(69000);
  });

  it('normalizes correctly at 6-decimal precision too', () => {
    const raw = baseSnapshot();
    raw.oraclePriceRaw = 69_000_000_000n; // $69,000 at 6 decimals
    raw.oracleDecimals = 6;
    const data = mapAaveV4CollateralRiskSnapshot(raw, {
      network: 'Ethereum Mainnet',
      collateralSymbol: 'WBTC',
      userAddress: USER,
    });
    expect(data.canonical.collateralPriceUsd).toBe(69000);
  });
});

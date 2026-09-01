import { describe, expect, it } from 'vitest';

import { mapAaveV4ReservePriceSnapshot } from '@/infrastructure/protocols/aave/v4/mapAaveV4ReservePriceSnapshot';
import type { RawAaveV4ReservePriceSnapshot } from '@/infrastructure/protocols/aave/v4/types';

const SPOKE = '0x94e7A5dCbE816e498b89aB752661904E2F56c485' as const;
const ORACLE = '0x2222222222222222222222222222222222222222' as const;

function baseSnapshot(): RawAaveV4ReservePriceSnapshot {
  return {
    blockNumber: 21_000_000n,
    blockTimestamp: 1_700_000_000n,
    spoke: SPOKE,
    collateralReserveId: 11n,
    oracle: ORACLE,
    oraclePriceRaw: 6_900_000_000_000n, // $69,000 at 8 decimals
    oracleDecimals: 8,
  };
}

/**
 * V4 wallet-independent price fix — mirrors
 * `mapAaveV4CollateralRiskSnapshot.test.ts`'s own coverage, minus every
 * assertion about `collateralFactor`/`dynamicConfigKey`/`userAddress` —
 * this snapshot has none of those fields, by construction, not by
 * omission (see `RawAaveV4ReservePriceSnapshot`'s own header comment).
 */
describe('mapAaveV4ReservePriceSnapshot — pure unit conversion, no accrual math', () => {
  it('stamps display metadata including the pinned block number/timestamp, stringified', () => {
    const data = mapAaveV4ReservePriceSnapshot(baseSnapshot(), {
      network: 'Ethereum Mainnet',
      collateralSymbol: 'WBTC',
    });
    expect(data.display).toEqual({
      network: 'Ethereum Mainnet',
      collateralSymbol: 'WBTC',
      spoke: SPOKE,
      reserveId: '11',
      blockNumber: '21000000',
      blockTimestamp: new Date(1_700_000_000 * 1000).toISOString(),
    });
  });

  it('preserves the raw snapshot unchanged, alongside the derived canonical shape', () => {
    const raw = baseSnapshot();
    const data = mapAaveV4ReservePriceSnapshot(raw, {
      network: 'Ethereum Mainnet',
      collateralSymbol: 'WBTC',
    });
    expect(data.raw).toBe(raw);
  });

  it('derives blockTimestamp display value from blockTimestamp, not from blockNumber or wall-clock time', () => {
    const raw = baseSnapshot();
    raw.blockTimestamp = 1_650_000_000n;
    const data = mapAaveV4ReservePriceSnapshot(raw, {
      network: 'Ethereum Mainnet',
      collateralSymbol: 'WBTC',
    });
    expect(data.display.blockTimestamp).toBe(new Date(1_650_000_000 * 1000).toISOString());
  });
});

describe('mapAaveV4ReservePriceSnapshot — collateralPriceUsd normalization', () => {
  it('normalizes an 8-decimal oracle price (the reference implementation default) to a plain USD number', () => {
    const raw = baseSnapshot();
    raw.oraclePriceRaw = 6_900_000_000_000n; // $69,000 at 8 decimals
    raw.oracleDecimals = 8;
    const data = mapAaveV4ReservePriceSnapshot(raw, {
      network: 'Ethereum Mainnet',
      collateralSymbol: 'WBTC',
    });
    expect(data.canonical.collateralPriceUsd).toBe(69000);
  });

  it('normalizes correctly at a different decimal precision, proving decimals is never hardcoded', () => {
    const raw = baseSnapshot();
    raw.oraclePriceRaw = 69_000_000_000_000_000_000_000n; // $69,000 at 18 decimals
    raw.oracleDecimals = 18;
    const data = mapAaveV4ReservePriceSnapshot(raw, {
      network: 'Ethereum Mainnet',
      collateralSymbol: 'WBTC',
    });
    expect(data.canonical.collateralPriceUsd).toBe(69000);
  });
});

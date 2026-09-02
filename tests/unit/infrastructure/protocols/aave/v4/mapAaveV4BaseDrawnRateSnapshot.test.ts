import { describe, expect, it } from 'vitest';

import { mapAaveV4BaseDrawnRateSnapshot } from '@/infrastructure/protocols/aave/v4/mapAaveV4BaseDrawnRateSnapshot';
import type { RawAaveV4BaseDrawnRateSnapshot } from '@/infrastructure/protocols/aave/v4/types';

const HUB = '0x1111111111111111111111111111111111111111' as const;
const SPOKE = '0x94e7A5dCbE816e498b89aB752661904E2F56c485' as const;

function baseSnapshot(): RawAaveV4BaseDrawnRateSnapshot {
  return {
    blockNumber: 21_000_000n,
    blockTimestamp: 1_700_000_000n,
    hub: HUB,
    spoke: SPOKE,
    reserveId: 11n,
    drawnRateRay: 40_000_000_000_000_000_000_000_000n, // 4% APR
  };
}

/**
 * V4 Manual-Data / Provenance Audit — mirrors
 * `mapAaveV4ReservePriceSnapshot.test.ts`'s own coverage exactly, for the
 * base-drawn-rate address-independent subset instead of the collateral
 * price.
 */
describe('mapAaveV4BaseDrawnRateSnapshot — pure unit conversion, no accrual math', () => {
  it('stamps display metadata including the pinned block number/timestamp, stringified', () => {
    const data = mapAaveV4BaseDrawnRateSnapshot(baseSnapshot(), {
      network: 'Ethereum Mainnet',
      debtSymbol: 'USDC',
    });
    expect(data.display).toEqual({
      network: 'Ethereum Mainnet',
      debtSymbol: 'USDC',
      hub: HUB,
      spoke: SPOKE,
      reserveId: '11',
      blockNumber: '21000000',
      blockTimestamp: new Date(1_700_000_000 * 1000).toISOString(),
    });
  });

  it('preserves the raw snapshot unchanged, alongside the derived canonical shape', () => {
    const raw = baseSnapshot();
    const data = mapAaveV4BaseDrawnRateSnapshot(raw, {
      network: 'Ethereum Mainnet',
      debtSymbol: 'USDC',
    });
    expect(data.raw).toBe(raw);
  });

  it('derives blockTimestamp display value from blockTimestamp, not from blockNumber or wall-clock time', () => {
    const raw = baseSnapshot();
    raw.blockTimestamp = 1_650_000_000n;
    const data = mapAaveV4BaseDrawnRateSnapshot(raw, {
      network: 'Ethereum Mainnet',
      debtSymbol: 'USDC',
    });
    expect(data.display.blockTimestamp).toBe(new Date(1_650_000_000 * 1000).toISOString());
  });
});

describe('mapAaveV4BaseDrawnRateSnapshot — baseDrawnApr normalization', () => {
  it('normalizes a RAY-scaled (1e27) rate to a plain decimal fraction — the exact conversion mapAaveV4Snapshot.ts already applies to this same field', () => {
    const raw = baseSnapshot();
    raw.drawnRateRay = 40_000_000_000_000_000_000_000_000n; // 4%
    const data = mapAaveV4BaseDrawnRateSnapshot(raw, {
      network: 'Ethereum Mainnet',
      debtSymbol: 'USDC',
    });
    expect(data.canonical.baseDrawnApr).toBeCloseTo(0.04);
  });

  it('normalizes a zero rate to exactly 0, a legitimate value, never treated as missing', () => {
    const raw = baseSnapshot();
    raw.drawnRateRay = 0n;
    const data = mapAaveV4BaseDrawnRateSnapshot(raw, {
      network: 'Ethereum Mainnet',
      debtSymbol: 'USDC',
    });
    expect(data.canonical.baseDrawnApr).toBe(0);
  });
});

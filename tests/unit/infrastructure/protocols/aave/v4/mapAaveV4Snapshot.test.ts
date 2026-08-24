import { describe, expect, it } from 'vitest';

import { mapAaveV4Snapshot } from '@/infrastructure/protocols/aave/v4/mapAaveV4Snapshot';
import type { RawAaveV4Snapshot } from '@/infrastructure/protocols/aave/v4/types';

const USER = '0x1111111111111111111111111111111111111111' as const;
const HUB = '0xCca852Bc40e560adC3b1Cc58CA5b55638ce826c9' as const;
const SPOKE = '0x94e7A5dCbE816e498b89aB752661904E2F56c485' as const;
const ORACLE = '0x9999999999999999999999999999999999999999' as const;

function baseSnapshot(): RawAaveV4Snapshot {
  return {
    blockNumber: 21_000_000n,
    blockTimestamp: 1_700_000_000n,
    hub: HUB,
    spoke: SPOKE,
    assetId: 7n,
    reserveId: 42n,
    reserve: {
      underlying: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      hub: HUB,
      assetId: 7,
      decimals: 6,
      collateralRisk: 500,
      flags: 0,
      dynamicConfigKey: 0,
    },
    userDebt: {
      drawnDebt: 20_000_000_000n, // 20,000 @ 6 decimals
      premiumDebt: 500_000_000n, // 500 @ 6 decimals
    },
    drawnRateRay: 50_000_000_000_000_000_000_000_000n, // 0.05
    userLastRiskPremiumBps: 1000n, // 10%
    userReserveStatus: { usingAsCollateral: false, borrowed: true },
    liveDecimals: 6,
    oracle: ORACLE,
    debtAssetPriceRaw: 99_980_000n, // $0.9998 at 8 decimals
    debtAssetPriceDecimals: 8,
  };
}

describe('mapAaveV4Snapshot — pure unit conversion, no accrual math', () => {
  it('maps raw contract values to the engine input shape', () => {
    const data = mapAaveV4Snapshot(baseSnapshot(), {
      network: 'Ethereum Mainnet',
      collateralSymbol: 'WBTC',
      debtSymbol: 'USDC',
      userAddress: USER,
    });

    expect(data.engineInputs).toEqual({
      drawnDebt: 20000,
      premiumDebt: 500,
      baseDrawnApr: 0.05,
      riskPremium: 0.1,
    });
  });

  it('stamps display metadata including the pinned block number/timestamp, stringified', () => {
    const data = mapAaveV4Snapshot(baseSnapshot(), {
      network: 'Ethereum Mainnet',
      collateralSymbol: 'WBTC',
      debtSymbol: 'USDC',
      userAddress: USER,
    });

    expect(data.display).toEqual({
      network: 'Ethereum Mainnet',
      collateralSymbol: 'WBTC',
      debtSymbol: 'USDC',
      hub: HUB,
      spoke: SPOKE,
      reserveId: '42',
      blockNumber: '21000000',
      blockTimestamp: new Date(1_700_000_000 * 1000).toISOString(),
      userAddress: USER,
    });
  });

  it('preserves the raw snapshot unchanged, alongside the derived engineInputs', () => {
    const raw = baseSnapshot();
    const data = mapAaveV4Snapshot(raw, {
      network: 'Ethereum Mainnet',
      collateralSymbol: 'WBTC',
      debtSymbol: 'USDC',
      userAddress: USER,
    });
    expect(data.raw).toBe(raw);
  });

  it('maps a zero premiumDebt / zero riskPremium position without special-casing', () => {
    const raw = baseSnapshot();
    raw.userDebt.premiumDebt = 0n;
    raw.userLastRiskPremiumBps = 0n;
    const data = mapAaveV4Snapshot(raw, {
      network: 'Ethereum Mainnet',
      collateralSymbol: 'WBTC',
      debtSymbol: 'USDC',
      userAddress: USER,
    });
    expect(data.engineInputs.premiumDebt).toBe(0);
    expect(data.engineInputs.riskPremium).toBe(0);
  });

  it('scales a USDT-decimals (6) debt reserve identically to USDC (same decimals, different symbol)', () => {
    const raw = baseSnapshot();
    const data = mapAaveV4Snapshot(raw, {
      network: 'Ethereum Mainnet',
      collateralSymbol: 'WBTC',
      debtSymbol: 'USDT',
      userAddress: USER,
    });
    expect(data.engineInputs.drawnDebt).toBe(20000);
    expect(data.display.debtSymbol).toBe('USDT');
  });

  it('does not include elapsedDays anywhere in the output (caller-supplied projection parameter, not on-chain state)', () => {
    const data = mapAaveV4Snapshot(baseSnapshot(), {
      network: 'Ethereum Mainnet',
      collateralSymbol: 'WBTC',
      debtSymbol: 'USDC',
      userAddress: USER,
    });
    expect('elapsedDays' in data.engineInputs).toBe(false);
  });

  it('derives blockTimestamp display value from blockTimestamp, not from blockNumber or wall-clock time', () => {
    const raw = baseSnapshot();
    raw.blockTimestamp = 1_650_000_000n;
    const data = mapAaveV4Snapshot(raw, {
      network: 'Ethereum Mainnet',
      collateralSymbol: 'WBTC',
      debtSymbol: 'USDC',
      userAddress: USER,
    });
    expect(data.display.blockTimestamp).toBe(new Date(1_650_000_000 * 1000).toISOString());
  });
});

import { describe, expect, it } from 'vitest';

import { projectProtocolDebt } from '@/engine';
import { mapAaveV4Snapshot } from '@/infrastructure/protocols/aave/v4/mapAaveV4Snapshot';
import type { RawAaveV4Snapshot } from '@/infrastructure/protocols/aave/v4/types';

const USER = '0x1111111111111111111111111111111111111111' as const;
const HUB = '0xCca852Bc40e560adC3b1Cc58CA5b55638ce826c9' as const;
const SPOKE = '0x94e7A5dCbE816e498b89aB752661904E2F56c485' as const;
const ORACLE = '0x9999999999999999999999999999999999999999' as const;

/**
 * Stage 3 completion audit (Medium finding: "no automated integration
 * test proves Stage 3's output feeds Stage 2's engine") — this file
 * closes that gap. `tests/unit/infrastructure/protocols/aave/v4/*.test.ts`
 * (adapter/mapper) and `tests/unit/engine/protocols/aaveV4/*.test.ts`
 * (Engine math) each verify their own layer in isolation; nothing
 * previously asserted the two actually compose. This test builds a raw
 * V4 snapshot, maps it to `AaveV4EngineDebtInputs` via the real
 * `mapAaveV4Snapshot`, spreads it with `protocolVersion: 'v4'` and a
 * caller-supplied `elapsedDays` into the real `projectProtocolDebt`
 * dispatcher (imported from the public `@/engine` barrel — the same path
 * any real caller must use; `projectAaveV4Debt` itself is deliberately
 * not exported at the top level, reachable only through the dispatcher —
 * see `engine/index.ts`'s own header comment), and asserts the projected
 * result. No mocking of either layer.
 *
 * The fixture below is the same raw values as
 * `mapAaveV4Snapshot.test.ts`'s own `baseSnapshot()` (20,000 drawn debt,
 * 500 existing premium debt, 5% base drawn APR, 10% risk premium, all at
 * 6 decimals) run forward 365 days — the exact scenario independently
 * verified in Stage 2's own test suite
 * (`tests/unit/engine/protocols/aaveV4/projectAaveV4Debt.test.ts`,
 * "an existing nonzero premiumDebt balance is carried forward..."):
 * drawnDebt -> 21000, premiumDebt -> 600 (500 existing + 100 newly
 * accrued), totalDebt -> 21600. Reusing that independently-derived vector
 * here (rather than inventing a new one) keeps this test's expected
 * values traceable to the same standalone-script derivation discipline
 * the rest of the V4 math test suite uses.
 */
function realisticSnapshot(): RawAaveV4Snapshot {
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
    drawnRateRay: 50_000_000_000_000_000_000_000_000n, // 0.05 (5% APR)
    userLastRiskPremiumBps: 1000n, // 10%
    userReserveStatus: { usingAsCollateral: false, borrowed: true },
    liveDecimals: 6,
    oracle: ORACLE,
    debtAssetPriceRaw: 99_980_000n, // $0.9998 at 8 decimals
    debtAssetPriceDecimals: 8,
  };
}

describe('Stage 3 -> Stage 2 engine wiring — mapAaveV4Snapshot output feeds projectProtocolDebt (the V4 dispatcher)', () => {
  it('maps a realistic raw snapshot, spreads engineInputs + elapsedDays into projectProtocolDebt, and produces the expected 365-day projection', () => {
    const snapshot = mapAaveV4Snapshot(realisticSnapshot(), {
      network: 'Ethereum Mainnet',
      collateralSymbol: 'WBTC',
      debtSymbol: 'USDC',
      userAddress: USER,
    });

    // No cast, no manual field picking — proves engineInputs is
    // structurally identical to the dispatcher's v4 request shape (minus
    // protocolVersion/elapsedDays), not just "close enough" at runtime.
    const projection = projectProtocolDebt({
      protocolVersion: 'v4',
      ...snapshot.engineInputs,
      elapsedDays: 365,
    });

    expect(projection.ok).toBe(true);
    if (!projection.ok) return;
    expect(projection.value.drawnDebt).toBeCloseTo(21000, 6);
    expect(projection.value.premiumDebt).toBeCloseTo(600, 6);
    expect(projection.value.totalDebt).toBeCloseTo(21600, 6);
    expect(projection.metadata.formulaId).toBe('AAVE-V4-DRAWN-PREMIUM');
  });

  it('elapsed=0 leaves the projected debt unchanged, confirming the mapped engineInputs are treated as the current (t0) balance, not re-accrued', () => {
    const snapshot = mapAaveV4Snapshot(realisticSnapshot(), {
      network: 'Ethereum Mainnet',
      collateralSymbol: 'WBTC',
      debtSymbol: 'USDC',
      userAddress: USER,
    });

    const projection = projectProtocolDebt({
      protocolVersion: 'v4',
      ...snapshot.engineInputs,
      elapsedDays: 0,
    });

    expect(projection.ok).toBe(true);
    if (!projection.ok) return;
    expect(projection.value.drawnDebt).toBe(snapshot.engineInputs.drawnDebt);
    expect(projection.value.premiumDebt).toBe(snapshot.engineInputs.premiumDebt);
  });

  it('a snapshot with zero premium debt and zero risk premium projects with no premium accrual', () => {
    const raw = realisticSnapshot();
    raw.userDebt.premiumDebt = 0n;
    raw.userLastRiskPremiumBps = 0n;
    const snapshot = mapAaveV4Snapshot(raw, {
      network: 'Ethereum Mainnet',
      collateralSymbol: 'WBTC',
      debtSymbol: 'USDC',
      userAddress: USER,
    });

    const projection = projectProtocolDebt({
      protocolVersion: 'v4',
      ...snapshot.engineInputs,
      elapsedDays: 30,
    });

    expect(projection.ok).toBe(true);
    if (!projection.ok) return;
    expect(projection.value.premiumDebt).toBe(0);
    expect(projection.value.drawnDebt).toBeGreaterThan(snapshot.engineInputs.drawnDebt);
  });
});

import { describe, expect, it } from 'vitest';

import {
  classifyCollateralRiskBoundaryResult,
  classifyDebtBoundaryResult,
} from '@/scripts/verifyAaveV4Boundary';

/**
 * `scripts/verifyAaveV4Boundary.ts` — V4 Readiness Audit §12 P0-3. Only
 * the two pure classification functions are unit-tested here (no
 * network access, no live RPC) — they take an already-obtained
 * `fetchAaveV4DebtSnapshot`/`fetchAaveV4CollateralRiskSnapshot`-shaped
 * result and decide PASS/FAIL, independent of how that result was
 * obtained. The script's own `main()` (real RPC orchestration) is
 * deliberately not unit-tested — it has no pure logic of its own beyond
 * calling these two functions and printing their output, and importing
 * this module at all must never trigger a real network call (see the
 * script's own `isMainModule` guard).
 */
const VALID_ENGINE_INPUTS = {
  drawnDebt: 15000,
  premiumDebt: 500,
  baseDrawnApr: 0.05,
  riskPremium: 0.01,
};

const VALID_CANONICAL = { collateralFactor: 0.8, dynamicConfigKey: 1, collateralPriceUsd: 69000 };

describe('classifyDebtBoundaryResult — AAVE_V4_NO_BORROW_POSITION is the expected PASS signal', () => {
  it('treats AAVE_V4_NO_BORROW_POSITION as a pass, not a failure', () => {
    const result = classifyDebtBoundaryResult('USDC', {
      ok: false,
      error: {
        code: 'AAVE_V4_NO_BORROW_POSITION',
        message: 'User 0x0 has no active USDC borrow position.',
        userMessage: 'No live USDC debt position was found for this account.',
        retryable: false,
      },
    });
    expect(result.ok).toBe(true);
    expect(result.name).toBe('Debt boundary (USDC)');
  });

  it('treats any OTHER classified adapter error as a genuine failure, carrying the real code/message', () => {
    const result = classifyDebtBoundaryResult('USDC', {
      ok: false,
      error: {
        code: 'AAVE_V4_RESERVE_NOT_FOUND',
        message: 'No Aave V4 reserve for USDC was found on Spoke 0x... across any known Hubs.',
        userMessage: 'Live Aave V4 data is not yet available for USDC.',
        retryable: false,
      },
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('AAVE_V4_RESERVE_NOT_FOUND');
    expect(result.detail).toContain('No Aave V4 reserve for USDC');
  });

  it("treats a genuine RPC timeout as a failure, reusing the adapter's own code verbatim", () => {
    const result = classifyDebtBoundaryResult('USDT', {
      ok: false,
      error: {
        code: 'AAVE_V4_RPC_TIMEOUT',
        message: 'RPC request timed out: ...',
        userMessage: 'The Aave V4 data request timed out. Please try again.',
        retryable: true,
      },
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('AAVE_V4_RPC_TIMEOUT');
  });

  it('a successful read (unexpected but possible) passes when engineInputs matches the reused schema', () => {
    const result = classifyDebtBoundaryResult('USDC', {
      ok: true,
      data: {
        raw: {} as never,
        engineInputs: VALID_ENGINE_INPUTS,
        display: {} as never,
        debtAssetPriceUsd: 0.9998,
      },
    });
    expect(result.ok).toBe(true);
    expect(result.detail).toContain('drawnDebt=15000');
  });

  it('a successful read whose engineInputs fails the reused schema is a SHAPE_MISMATCH failure', () => {
    const result = classifyDebtBoundaryResult('USDC', {
      ok: true,
      data: {
        raw: {} as never,
        // Negative drawnDebt is invalid per `aaveV4DebtStateSchema` —
        // proves a real shape drift, not a coincidental false positive.
        engineInputs: { ...VALID_ENGINE_INPUTS, drawnDebt: -1 },
        display: {} as never,
        debtAssetPriceUsd: 0.9998,
      },
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('SHAPE_MISMATCH');
  });
});

describe('classifyCollateralRiskBoundaryResult — a genuine ok:true read is the expected outcome', () => {
  it('passes on a successful read whose canonical value matches the reused schema', () => {
    const result = classifyCollateralRiskBoundaryResult({
      ok: true,
      data: {
        raw: {} as never,
        canonical: VALID_CANONICAL,
        display: {} as never,
      },
    });
    expect(result.ok).toBe(true);
    expect(result.detail).toContain('collateralFactor=0.8');
  });

  it('a successful read whose canonical value fails the reused schema is a SHAPE_MISMATCH failure', () => {
    const result = classifyCollateralRiskBoundaryResult({
      ok: true,
      data: {
        raw: {} as never,
        // collateralFactor > 1 is invalid per `aaveV4CollateralRiskConfigSchema`.
        canonical: { ...VALID_CANONICAL, collateralFactor: 1.5 },
        display: {} as never,
      },
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('SHAPE_MISMATCH');
  });

  it('an unambiguous, address-independent adapter failure is reported as a genuine failure, reusing the real code', () => {
    const result = classifyCollateralRiskBoundaryResult({
      ok: false,
      error: {
        code: 'AAVE_V4_RPC_TIMEOUT',
        message: 'RPC request timed out: ...',
        userMessage: 'The Aave V4 data request timed out. Please try again.',
        retryable: true,
      },
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('AAVE_V4_RPC_TIMEOUT');
  });

  it('there is no "no position" special case here — reserve-not-found is reported as-is', () => {
    const result = classifyCollateralRiskBoundaryResult({
      ok: false,
      error: {
        code: 'AAVE_V4_RESERVE_NOT_FOUND',
        message: 'No Aave V4 reserve for WBTC was found.',
        userMessage: 'Live Aave V4 collateral-risk data is not yet available for WBTC.',
        retryable: false,
      },
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('AAVE_V4_RESERVE_NOT_FOUND');
  });

  /**
   * V4 Readiness Audit §12 — P0-3 final review. `AAVE_V4_RPC_CONTRACT_ERROR`
   * is the one code a genuine "the zero address has no bound
   * dynamicConfigKey" revert would ALSO produce — this script has no way
   * to confirm from outside whether Solidity would revert or return a
   * zero-value config for an unset key, so it must never silently treat
   * this specific code as a pass. Fails, with an explanatory (not
   * generic) detail message distinguishing it from an ordinary failure.
   */
  it('AAVE_V4_RPC_CONTRACT_ERROR is never silently treated as a pass — fails with an explanatory, non-generic detail', () => {
    const result = classifyCollateralRiskBoundaryResult({
      ok: false,
      error: {
        code: 'AAVE_V4_RPC_CONTRACT_ERROR',
        message: 'Contract reverted: ...',
        userMessage: 'Aave V4 returned an unexpected response. Please try again later.',
        retryable: false,
      },
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('AAVE_V4_RPC_CONTRACT_ERROR');
    expect(result.detail).toContain('may indicate real ABI/deployment drift');
    expect(result.detail).toContain('may be an expected revert');
    // Must not be the raw adapter message alone — this is the script's
    // own explanatory text, not a passthrough.
    expect(result.detail).not.toBe('Contract reverted: ...');
  });
});

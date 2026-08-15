import { describe, expect, it } from 'vitest';

import {
  calculateLinearInterest,
  RAY,
  rayMulUp,
  SECONDS_PER_YEAR,
} from '@/engine/protocols/aaveV4/math';

/**
 * Deterministic parity vectors for `calculateLinearInterest`/`rayMulUp` —
 * V4 Readiness Audit §12 Stage 2. Every expected value below was computed
 * by a standalone Node.js BigInt script (NOT this test file, NOT
 * `math.ts` — see the Stage 2 report's vector-derivation methodology),
 * reimplementing `MathUtils.calculateLinearInterest`/`WadRayMath.rayMulUp`
 * from scratch against `aave/aave-v4` (commit
 * 2524fe4018a42750300e114f2a8c4355df62a878). The `365*7 days, rate=0.08`
 * case is additionally cross-checked against the official Foundry test
 * itself (`tests/contracts/libraries/math/MathUtils.t.sol`,
 * `test_calculateLinearInterest`: 0.08e27 over 7 years -> 1.56e27), and
 * the three `rayMulUp` spot checks are the exact values asserted by the
 * official `tests/contracts/libraries/math/WadRayMath.t.sol`.
 *
 * Rate arguments below are built as `(RAY * n) / d` for small integers
 * `n`/`d` (e.g. `(RAY * 8n) / 100n` for 8%) rather than pasted RAY-scaled
 * literals — RAY = 10^27 divides exactly by every denominator used here,
 * so this is exact BigInt arithmetic, not an approximation, and it keeps
 * each rate's intent (8%, 5%, 1bps, 200%) legible at the call site.
 */
describe('calculateLinearInterest — deterministic RAY-precision vectors (aave-v4 MathUtils.sol parity)', () => {
  it('SECONDS_PER_YEAR is exactly 365 days, matching the official Foundry constant test', () => {
    expect(SECONDS_PER_YEAR).toBe(31_536_000n);
  });

  it('elapsed=0 -> RAY exactly, regardless of rate (no growth)', () => {
    const rate = (RAY * 8n) / 100n; // 8%
    expect(calculateLinearInterest(rate, 0n)).toBe(RAY);
  });

  it('rate=0 -> RAY exactly, regardless of elapsed time (no growth)', () => {
    expect(calculateLinearInterest(0n, 365n * 86400n)).toBe(RAY);
    expect(calculateLinearInterest(0n, 365n * 86400n)).toBe(1_000_000_000_000_000_000_000_000_000n);
  });

  it('1 second, rate=8% APR', () => {
    const rate = (RAY * 8n) / 100n;
    expect(calculateLinearInterest(rate, 1n)).toBe(1_000_000_002_536_783_358_701_166_920n);
  });

  it('1 day, rate=5% APR', () => {
    const rate = (RAY * 5n) / 100n;
    expect(calculateLinearInterest(rate, 86400n)).toBe(1_000_136_986_301_369_863_013_698_630n);
  });

  it('30 days, rate=5% APR', () => {
    const rate = (RAY * 5n) / 100n;
    expect(calculateLinearInterest(rate, 30n * 86400n)).toBe(
      1_004_109_589_041_095_890_410_958_904n,
    );
  });

  it('365 days (1 year), rate=5% APR', () => {
    const rate = (RAY * 5n) / 100n;
    expect(calculateLinearInterest(rate, 365n * 86400n)).toBe(
      1_050_000_000_000_000_000_000_000_000n,
    );
  });

  it('365*7 days (7 years), rate=8% APR — official Foundry test_calculateLinearInterest vector (0.08e27 -> 1.56e27)', () => {
    const rate = (RAY * 8n) / 100n;
    expect(calculateLinearInterest(rate, 365n * 7n * 86400n)).toBe(
      1_560_000_000_000_000_000_000_000_000n,
    );
  });

  it('365 days, rate=0.01% APR (1 bps) — very-small-rate case', () => {
    const rate = RAY / 10_000n; // 0.0001
    expect(calculateLinearInterest(rate, 365n * 86400n)).toBe(
      1_000_100_000_000_000_000_000_000_000n,
    );
  });

  it('30 days, rate=200% APR — representative-high-rate case', () => {
    const rate = RAY * 2n;
    expect(calculateLinearInterest(rate, 30n * 86400n)).toBe(
      1_164_383_561_643_835_616_438_356_164n,
    );
  });

  it('730 days (2 years), rate=5% APR — multi-year case', () => {
    const rate = (RAY * 5n) / 100n;
    expect(calculateLinearInterest(rate, 730n * 86400n)).toBe(
      1_100_000_000_000_000_000_000_000_000n,
    );
  });

  it('boundary: rate=type(uint96).max, elapsed=type(uint40).max — largest values the Solidity type widths admit', () => {
    const maxUint96 = (1n << 96n) - 1n;
    const maxUint40 = (1n << 40n) - 1n;
    expect(calculateLinearInterest(maxUint96, maxUint40)).toBe(
      2_762_313_466_123_827_323_823_872_246_443_417n,
    );
  });

  it('boundary: rate=type(uint96).max, elapsed=0 -> RAY exactly', () => {
    const maxUint96 = (1n << 96n) - 1n;
    expect(calculateLinearInterest(maxUint96, 0n)).toBe(RAY);
  });

  it('boundary: rate=type(uint96).max, elapsed=1', () => {
    const maxUint96 = (1n << 96n) - 1n;
    expect(calculateLinearInterest(maxUint96, 1n)).toBe(1_000_002_512_308_552_583_217_199_186n);
  });
});

describe('rayMulUp — WadRayMath ceiling-rounding semantics (official WadRayMath.t.sol spot checks)', () => {
  it('rayMulUp(369, 271) === 1 (ceil of a sub-RAY product rounds up to the smallest non-zero unit)', () => {
    expect(rayMulUp(369n, 271n)).toBe(1n);
  });

  it('rayMulUp(2.5e27, 0.5e27) === 1.25e27 (exact product, no rounding needed)', () => {
    const a = (RAY * 5n) / 2n; // 2.5e27
    const b = RAY / 2n; // 0.5e27
    expect(rayMulUp(a, b)).toBe(1_250_000_000_000_000_000_000_000_000n);
  });

  it('rayMulUp(6e27, 2e27) === 12e27 (exact product, no rounding needed)', () => {
    const a = RAY * 6n;
    const b = RAY * 2n;
    expect(rayMulUp(a, b)).toBe(12_000_000_000_000_000_000_000_000_000n);
  });

  it('rayMulUp(0, anything) === 0 (zero short-circuit)', () => {
    expect(rayMulUp(0n, RAY)).toBe(0n);
  });

  it('rayMulUp(RAY, RAY) === RAY (identity: 1.0 * 1.0 = 1.0)', () => {
    expect(rayMulUp(RAY, RAY)).toBe(RAY);
  });
});

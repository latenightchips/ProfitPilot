import { describe, expect, it } from 'vitest';

import { calculateCompoundedInterest, RAY, rayMul } from '@/engine/protocols/aaveV3/math';

/**
 * Deterministic parity vectors for `calculateCompoundedInterest`/`rayMul`.
 *
 * These are NOT merely "the TS re-derives the same number the TS wrote" —
 * every expected value below was independently computed twice, in two
 * separate languages/toolchains, from the algorithm as written in
 * `MathUtils.sol`/`WadRayMath.sol` (`aave-dao/aave-v3-origin`):
 *   1. Python's arbitrary-precision `int` (native floor division, which
 *      is equivalent to truncation for the non-negative operands used
 *      here — the same truncation BigInt division performs).
 *   2. A second, standalone Node.js BigInt script (not this test file,
 *      not `math.ts`) reimplementing the same four-line formula from
 *      scratch.
 * Both independent implementations agreed bit-for-bit on every vector
 * before any value was pasted in here. This test then asserts the actual
 * `engine/protocols/aaveV3/math.ts` module — the code the app runs —
 * reproduces those same independently-derived integers exactly, not to a
 * tolerance.
 */
describe('calculateCompoundedInterest — deterministic RAY-precision vectors (aave-v3-origin MathUtils.sol parity)', () => {
  it('rate=0 -> no growth regardless of elapsed time', () => {
    expect(calculateCompoundedInterest(0n, 31_536_000n)).toBe(RAY);
  });

  it('elapsed=0 -> RAY exactly, regardless of rate (the exp===0 short-circuit)', () => {
    expect(calculateCompoundedInterest(5n * 10n ** 25n, 0n)).toBe(RAY);
  });

  it('5% APR (ray) over exactly 1 year (365 days)', () => {
    const rate = 5n * 10n ** 25n; // 0.05 * RAY
    const elapsed = 365n * 86400n;
    expect(calculateCompoundedInterest(rate, elapsed)).toBe(1_051_270_833_333_333_333_333_333_333n);
  });

  it('5% APR over 1 day', () => {
    const rate = 5n * 10n ** 25n;
    expect(calculateCompoundedInterest(rate, 86400n)).toBe(1_000_136_995_684_421_674_802_557_900n);
  });

  it('5% APR over 30 days', () => {
    const rate = 5n * 10n ** 25n;
    expect(calculateCompoundedInterest(rate, 30n * 86400n)).toBe(
      1_004_118_044_969_757_105_730_597_891n,
    );
  });

  it('5% APR over 90 days', () => {
    const rate = 5n * 10n ** 25n;
    expect(calculateCompoundedInterest(rate, 90n * 86400n)).toBe(
      1_012_405_078_698_360_225_902_724_045n,
    );
  });

  it('5% APR over 180 days', () => {
    const rate = 5n * 10n ** 25n;
    expect(calculateCompoundedInterest(rate, 180n * 86400n)).toBe(
      1_024_964_029_849_595_261_903_721_431n,
    );
  });

  it('5% APR over 800 days', () => {
    const rate = 5n * 10n ** 25n;
    expect(calculateCompoundedInterest(rate, 800n * 86400n)).toBe(
      1_115_813_276_369_241_789_776_110_898n,
    );
  });

  it('10% APR over 730 days (2 years)', () => {
    const rate = 10n * 10n ** 25n;
    expect(calculateCompoundedInterest(rate, 730n * 86400n)).toBe(
      1_221_333_333_333_333_333_333_333_333n,
    );
  });

  it('extreme case: 100% APR over 1 year — binomial approximation, not true e^1 (matches MathUtils.sol comment)', () => {
    const rate = 100n * 10n ** 25n;
    const result = calculateCompoundedInterest(rate, 365n * 86400n);
    expect(result).toBe(2_666_666_666_666_666_666_666_666_666n);
    // The contract's own comment: the binomial approximation is not
    // Math.exp(1) ~= 2.71828 — it deliberately undercharges at large x.
    expect(Number(result) / Number(RAY)).toBeLessThan(Math.exp(1));
  });
});

describe('rayMul — WadRayMath round-half-up semantics', () => {
  it('rounds an exact .5-remainder product up, not down (plain truncating division would floor to 1, not 2)', () => {
    // a = HALF_RAY, b = 3n -> a*b = 1.5 * RAY exactly, so (a*b) mod RAY === HALF_RAY.
    const a = RAY / 2n;
    const b = 3n;
    expect((a * b) % RAY).toBe(RAY / 2n); // confirms this vector actually lands on the .5 boundary
    expect((a * b) / RAY).toBe(1n); // plain floor division would give 1
    expect(rayMul(a, b)).toBe(2n); // round-half-up gives 2
  });

  it('rayMul(RAY, RAY) === RAY (identity: 1.0 * 1.0 = 1.0)', () => {
    expect(rayMul(RAY, RAY)).toBe(RAY);
  });

  it('rayMul(0, anything) === 0', () => {
    expect(rayMul(0n, RAY)).toBe(0n);
  });
});

/**
 * Aave V4 drawn-rate math — an exact BigInt port of
 * `MathUtils.calculateLinearInterest` and `WadRayMath.rayMulUp`, verified
 * against `aave/aave-v4` (commit 2524fe4018a42750300e114f2a8c4355df62a878):
 *   - src/libraries/math/MathUtils.sol — calculateLinearInterest, SECONDS_PER_YEAR
 *   - src/libraries/math/WadRayMath.sol — rayMulUp, RAY
 *
 * Isolated in its own protocol-scoped Engine module, independent of
 * `engine/protocols/aaveV3/math.ts` — V4's drawn-debt index grows via a
 * LINEAR interest factor over each elapsed period
 * (`src/hub/libraries/AssetLogic.sol`'s `getDrawnIndex`:
 * `previousIndex.rayMulUp(MathUtils.calculateLinearInterest(rate,
 * lastUpdateTimestamp))`), not V3's binomial compounded-interest curve.
 * No functions or constants are shared with V3's module.
 */

/** 1e27 — Aave's "ray" fixed-point unit (WadRayMath.RAY). */
export const RAY = 1_000_000_000_000_000_000_000_000_000n;

/**
 * `365 days` — MathUtils.sol's own leap-year-ignoring constant (same
 * numeric value as V3's SECONDS_PER_YEAR, ported independently here).
 * Confirmed via the official Foundry test
 * (`tests/contracts/libraries/math/MathUtils.t.sol`, `test_constants`):
 * `assertEq(MathUtils.SECONDS_PER_YEAR, 365 days)`.
 */
export const SECONDS_PER_YEAR = 31_536_000n;

/**
 * `WadRayMath.rayMulUp(a, b) = ceil(a * b / RAY)` — exact port, including
 * its zero short-circuit: `a * b == 0 ? 0 : (a * b - 1) / RAY + 1`.
 */
export function rayMulUp(a: bigint, b: bigint): bigint {
  const product = a * b;
  if (product === 0n) return 0n;
  return (product - 1n) / RAY + 1n;
}

/**
 * Exact port of `MathUtils.calculateLinearInterest(rate,
 * lastUpdateTimestamp)`:
 *
 * ```solidity
 * function calculateLinearInterest(uint96 rate, uint40 lastUpdateTimestamp)
 *   internal view returns (uint256 result)
 * {
 *   assembly ('memory-safe') {
 *     if gt(lastUpdateTimestamp, timestamp()) { revert(0, 0) }
 *     result := sub(timestamp(), lastUpdateTimestamp)
 *     result := add(div(mul(rate, result), SECONDS_PER_YEAR), RAY)
 *   }
 * }
 * ```
 *
 * Returns a RAY-scaled growth factor (RAY itself = no growth, i.e.
 * `elapsedSeconds === 0`):
 *
 *   result = RAY + (rate * elapsedSeconds) / SECONDS_PER_YEAR
 *
 * `rateRay` is the ray-scaled annualized drawn rate; `elapsedSeconds`
 * collapses the contract's own `(lastUpdateTimestamp, block.timestamp)`
 * pair into their difference, which is all the formula ever uses. The
 * Solidity reverts if `lastUpdateTimestamp > block.timestamp` (negative
 * elapsed time) — callers must validate `elapsedSeconds >= 0` before
 * calling this (`projectAaveV4Debt.ts` does, via `validateTimePeriod`,
 * before this function is ever reached).
 *
 * Verified against the official Foundry test
 * (`tests/contracts/libraries/math/MathUtils.t.sol`,
 * `test_calculateLinearInterest`): rate 0.08e27 (8% APR) over 7 years
 * (365 days × 7) → 1.56e27 (56% total growth) — see
 * `tests/unit/engine/protocols/aaveV4/math.test.ts` for the same vector.
 */
export function calculateLinearInterest(rateRay: bigint, elapsedSeconds: bigint): bigint {
  return RAY + (rateRay * elapsedSeconds) / SECONDS_PER_YEAR;
}

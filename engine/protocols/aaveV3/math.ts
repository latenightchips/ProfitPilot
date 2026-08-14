/**
 * Aave V3 compounded variable-debt interest — an exact BigInt port of
 * `MathUtils.calculateCompoundedInterest` and `WadRayMath.rayMul`, verified
 * against `aave-dao/aave-v3-origin`'s `src/contracts/protocol/libraries/math/`.
 *
 * Isolated in its own protocol-scoped Engine module (not merged into the
 * generic `engine/interest/` "Simple Interest" formulas — F-030–F-032 —
 * which remain simple/linear by design and unchanged). A future V4 adapter
 * would add its own sibling `engine/protocols/aaveV4/` with its own
 * semantics, independent of this one.
 *
 * Solidity operates on `uint256`, which reverts on overflow; JS `bigint` is
 * unbounded, so the overflow-revert guards in `WadRayMath.sol`'s assembly
 * are structurally unnecessary here — the arithmetic result is identical
 * for every input that would not have reverted on-chain (any realistic
 * rate/elapsed-time pair for this application).
 */

/** 1e27 — Aave's "ray" fixed-point unit. */
export const RAY = 1_000_000_000_000_000_000_000_000_000n;
const HALF_RAY = RAY / 2n;

/** `365 days`, matching `MathUtils.sol`'s own leap-year-ignoring constant. */
export const SECONDS_PER_YEAR = 31_536_000n;

/**
 * `WadRayMath.rayMul(a, b) = (a * b + HALF_RAY) / RAY` — Solidity's
 * round-half-up convention, replicated via BigInt integer division
 * (truncation after adding the half-ray bias == round half up for
 * non-negative operands, exactly as in the assembly implementation).
 */
export function rayMul(a: bigint, b: bigint): bigint {
  return (a * b + HALF_RAY) / RAY;
}

/**
 * Exact port of `MathUtils.calculateCompoundedInterest`. Returns a
 * RAY-scaled growth factor (RAY itself = no growth, i.e. `elapsedSeconds
 * === 0`). `rateRay` is the ray-scaled annualized rate (Aave's own
 * `variableBorrowRate` convention); `elapsedSeconds` collapses the
 * contract's `(lastUpdateTimestamp, currentTimestamp)` pair into their
 * difference, which is all the formula ever uses.
 *
 * Binomial approximation of e^(rate * years), same as the contract:
 *   x = rate * elapsed / SECONDS_PER_YEAR
 *   result = RAY + x + x * (x/2 + x * (x/6))   [each "*" is rayMul]
 */
export function calculateCompoundedInterest(rateRay: bigint, elapsedSeconds: bigint): bigint {
  if (elapsedSeconds === 0n) return RAY;

  const x = (rateRay * elapsedSeconds) / SECONDS_PER_YEAR;
  return RAY + x + rayMul(x, x / 2n + rayMul(x, x / 6n));
}

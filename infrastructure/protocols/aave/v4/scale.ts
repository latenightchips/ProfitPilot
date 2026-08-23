/**
 * Raw-value unit conversions only — no financial calculation, mirroring
 * `../v3/scale.ts`'s own discipline (04_BUILD_GUIDE.md: "Keep financial
 * calculations out of infrastructure code").
 */

/** RAY-scaled (1e27) fixed-point -> decimal fraction (e.g. `0.05` for 5% APR). */
export function rayToDecimal(raw: bigint): number {
  return Number(raw) / 1e27;
}

/** BPS (10000 = 100%) -> decimal fraction. V4's Risk Premium can exceed 10000 BPS (docs/overview.md: up to 1000_00 BPS = 1000%), so this deliberately has no upper-bound assumption baked in. */
export function basisPointsToDecimal(raw: bigint): number {
  return Number(raw) / 10000;
}

/** Asset-unit (native token decimals) integer -> decimal number, e.g. USDC's `20000_000000n` at 6 decimals -> `20000`. */
export function assetUnitsToDecimal(raw: bigint, decimals: number): number {
  return Number(raw) / 10 ** decimals;
}

/**
 * BPS (10000 = 100%) -> decimal fraction, same scale as
 * `basisPointsToDecimal` above but for a value viem already decoded as a
 * plain `number` rather than a `bigint`. `basisPointsToDecimal` is used
 * today only for `getUserLastRiskPremium`'s `uint256` return value
 * (always a `bigint`); V4 Readiness Audit §12 Stage 23C's
 * `DynamicReserveConfig.collateralFactor` is a `uint16` — viem decodes
 * any Solidity integer type of 48 bits or fewer (uint8/16/24/32) as a
 * plain `number`, not `bigint` — so it needs this sibling instead. A
 * separate function, not an overload, so neither call site needs a
 * runtime `typeof` branch.
 */
export function bpsNumberToDecimal(raw: number): number {
  return raw / 10000;
}

/**
 * V4 oracle price (`IPriceOracle.getReservePrice`'s raw `uint256`, at
 * `IPriceOracle.decimals()` precision) -> a plain USD decimal number, e.g.
 * `69000` for one WBTC. Same `Number(raw) / 10 ** decimals` pattern as
 * `assetUnitsToDecimal` above — deliberately not a new precision
 * strategy, just applied to a price instead of an asset amount. Named to
 * mirror `../v3/scale.ts`'s own `oraclePriceToUsd`, adapted to V4's
 * `decimals()`-based signature (V4 has no V3-style `baseCurrencyUnit`
 * bigint — see `./abi.ts`'s `priceOracleAbi` header comment).
 */
export function oraclePriceToUsd(raw: bigint, decimals: number): number {
  return Number(raw) / 10 ** decimals;
}

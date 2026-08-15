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

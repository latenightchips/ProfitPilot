/**
 * Raw-value unit conversions only — no financial calculation.
 * 04_BUILD_GUIDE.md: "Keep financial calculations out of infrastructure
 * code." These functions decode fixed-point on-chain integers into plain
 * decimals for display/normalization; they never project, accrue, or
 * compound anything.
 */
export function basisPointsToDecimal(raw: bigint): number {
  return Number(raw) / 10000;
}

export function rayToDecimal(raw: bigint): number {
  return Number(raw) / 1e27;
}

export function oraclePriceToUsd(raw: bigint, baseCurrencyUnit: bigint): number {
  return Number(raw) / Number(baseCurrencyUnit);
}

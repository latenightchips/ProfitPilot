/**
 * Pure unit-rescale conversions for Aave V3 subgraph wire values — no
 * financial calculation, just decoding the wire encoding described in
 * `types.ts`.
 *
 * `Number(BigInt(raw)) / divisor` is used throughout rather than a
 * plain `Number(raw) / divisor`. This is safe here because every result
 * is an *approximate ratio* (a percentage or a cross price for
 * display), not a value requiring exact-integer precision — a
 * double-precision float retains ~15-17 significant digits, far more
 * than a percentage or price display needs, and `BigInt` avoids any
 * precision loss parsing the raw (up to 27-digit) wire string itself.
 */

/** Aave basis-point fields (e.g. "8000" = 80.00%) — divide by 10,000 for a [0,1] decimal. */
export function basisPointsToDecimal(raw: string): number {
  return Number(BigInt(raw)) / 10000;
}

/**
 * Aave RAY-scaled rate fields (10^27) — documented by Aave itself as
 * APR (simple, non-compounding), matching ProfitPilot's own
 * `borrowApr`/`supplyApr` model with no APY conversion required.
 */
export function rayToDecimal(raw: string): number {
  return Number(BigInt(raw)) / 1e27;
}

/**
 * Derives a USD price from Aave's ETH-cross oracle fields:
 * `priceInEth` (wei-scaled, 10^18) is the asset's price in ETH;
 * `usdPriceEth` (8-decimal-scaled) is ETH's own USD price.
 *
 * **Unverified against a live response** — see this batch's own report
 * for why (network access to Aave/The Graph is blocked from this
 * session) and the recommendation to spot-check this against a known
 * reference price before production reliance.
 */
export function deriveUsdPrice(priceInEthWei: string, usdPriceEth8Decimals: string): number {
  const priceInEth = Number(BigInt(priceInEthWei)) / 1e18;
  const ethUsdPrice = Number(BigInt(usdPriceEth8Decimals)) / 1e8;
  return priceInEth * ethUsdPrice;
}

/**
 * Market Data Service — public entry point.
 *
 * 06_TASKS.md M3-001 ("Create Service Foundation") established this
 * directory; M3-007 ("Implement Market Data Service") is its first
 * occupant.
 */
export {
  FRESHNESS_THRESHOLD_MINUTES,
  type MarketQuote,
  type MarketQuoteAvailable,
  type MarketQuoteUnavailable,
  normalizeMarketQuote,
  type NormalizeMarketQuoteInput,
  type PriceFreshness,
  type PriceOrigin,
  type RawPriceCandidate,
} from './quote';

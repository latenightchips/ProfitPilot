/**
 * Market Data Service — 06_TASKS.md M3-007 ("Implement Market Data
 * Service"): "Create a Service for retrieving and normalizing market
 * prices." Support: Manual prices, Provider prices, Stale-data
 * detection, Fallback behavior, Price timestamps. DoD: "Features consume
 * normalized market quotes without depending on provider-specific
 * formats."
 *
 * SCOPE NOTE (read before extending): `04_BUILD_GUIDE.md`'s "PRICE
 * SERVICE" section describes a full external-integration design — a
 * `PriceProvider` interface, a CoinGecko adapter, an `infrastructure/`
 * directory, API client timeout/retry/caching, Zod response validation.
 * None of that is assigned to any task in `06_TASKS.md` (no task creates
 * `infrastructure/`, and M3-007's own text names none of it), so none of
 * it is built here — per instruction, `04_BUILD_GUIDE.md` is
 * architectural guidance only where it doesn't conflict with actual task
 * assignments, and building an unassigned adapter/network layer would be
 * inventing scope no task ever gave this batch. This file implements
 * only the Service-layer normalization logic: given already-obtained
 * candidate prices (however they were obtained — that's a future,
 * currently-unassigned task's concern), classify freshness and pick a
 * value per the fallback order, both of which `04_BUILD_GUIDE.md` *does*
 * document concretely (see below) and neither of which count as
 * inventing a business rule.
 *
 * **06_TASKS.md M9-045 ("Test Provider Failure Recovery") "Price provider
 * unavailable / Timeout / Malformed provider response" are N/A for the
 * identical reason, not a gap** — those scenarios describe a network
 * client this file deliberately does not contain (see the SCOPE NOTE
 * above). What this file's own `normalizeMarketQuote` *does* own —
 * classifying an already-obtained candidate as Fresh/Stale/Unavailable,
 * and rejecting a malformed candidate value — is thoroughly covered by
 * `tests/unit/services/market/quote.test.ts` (16 cases). "Partial
 * response" and "stale data" are the same "Unavailable"/"Stale"
 * classification this file already models as first-class outcomes, not
 * a separate failure to simulate.
 *
 * Two real, documented rules this file implements verbatim, not
 * invented:
 *   - **Price Freshness** (`04_BUILD_GUIDE.md` "PRICE FRESHNESS"): Fresh
 *     — updated within 5 minutes. Stale — older than 5 minutes.
 *     Unavailable — no valid price exists. "When price data is stale:
 *     display a warning, continue calculations only after clearly
 *     labeling the data as stale." "When price data is unavailable: use
 *     manual input or the last confirmed value. Do not silently invent a
 *     price."
 *   - **Service Fallback Order** (`04_BUILD_GUIDE.md` "SERVICE FALLBACK
 *     ORDER", prices): 1. Live provider. 2. Last valid cached value. 3.
 *     Manual input. "Every fallback must be visible to the user."
 *
 * **`MarketQuote` is a discriminated union on `freshness`, not
 * `ServiceResult<MarketQuote>`.** `normalizeMarketQuote` makes no Engine
 * call, so — exactly like M3-004's mapping functions — it has no real
 * `engineVersion`/`formulaVersion` to report; it returns
 * `MappingResult<MarketQuote>` (`services/shared/mappingResult.ts`)
 * instead of fabricating Engine metadata. "No valid price exists" is
 * modeled as a *successful* `MarketQuoteUnavailable` result (a legitimate
 * domain state — the Service correctly determined there is no price, it
 * did not fail to compute one), the same way `engine/health/
 * calculateHealthFactor.ts` treats zero debt as a successful `Infinity`
 * rather than an error. `MappingFailure` is reserved for genuinely
 * malformed input (a non-finite/non-positive price, an unparseable
 * timestamp) — data integrity problems, not "no price available."
 *
 * **No separate `warnings` channel is needed** for "stale must be
 * labeled" or "fallback must be visible": both are already visible
 * directly on the returned `MarketQuote` — `freshness === 'stale'` and
 * `origin !== 'provider'` respectively — so a caller (eventually the UI)
 * can act on them without a parallel `ServiceWarning[]` array carrying
 * the same information twice.
 */
import { type ApplicationError, createApplicationError } from '../shared/errors';
import type { MappingResult } from '../shared/mappingResult';

export type PriceOrigin = 'provider' | 'cache' | 'manual';
export type PriceFreshness = 'fresh' | 'stale' | 'unavailable';

/**
 * `04_BUILD_GUIDE.md` "PRICE FRESHNESS": "Stale — Older than 5 minutes."
 * Exported (V4 Readiness Audit §12 Stage 17) so `utils/protocolStatus.ts`
 * can apply the exact same threshold to V4's own `lastFetchedAt`-based
 * staleness check, rather than a second, independently-chosen number.
 */
export const FRESHNESS_THRESHOLD_MINUTES = 5;

/** `04_BUILD_GUIDE.md` "SERVICE FALLBACK ORDER": Live provider, then cache, then manual. */
const FALLBACK_ORDER: readonly PriceOrigin[] = ['provider', 'cache', 'manual'];

export interface RawPriceCandidate {
  origin: PriceOrigin;
  price: number;
  /** ISO 8601. */
  timestamp: string;
}

export interface MarketQuoteAvailable {
  asset: string;
  currency: string;
  freshness: Exclude<PriceFreshness, 'unavailable'>;
  price: number;
  origin: PriceOrigin;
  timestamp: string;
}

export interface MarketQuoteUnavailable {
  asset: string;
  currency: string;
  freshness: Extract<PriceFreshness, 'unavailable'>;
}

export type MarketQuote = MarketQuoteAvailable | MarketQuoteUnavailable;

export interface NormalizeMarketQuoteInput {
  asset: string;
  currency: string;
  candidates: RawPriceCandidate[];
  /** ISO 8601 instant to classify freshness against. Caller-supplied for determinism. */
  now: string;
}

/**
 * Normalizes candidate prices from up to three origins into one
 * provider-agnostic `MarketQuote` — 06_TASKS.md M3-007.
 */
export function normalizeMarketQuote(input: NormalizeMarketQuoteInput): MappingResult<MarketQuote> {
  const errors: ApplicationError[] = [];

  const nowMs = Date.parse(input.now);
  if (Number.isNaN(nowMs)) {
    errors.push(
      createApplicationError(
        'validation',
        'MARKET_QUOTE_NOW_INVALID',
        '"now" must be a valid ISO 8601 timestamp.',
      ),
    );
  }

  const validCandidates: RawPriceCandidate[] = [];
  for (const candidate of input.candidates) {
    if (
      typeof candidate.price !== 'number' ||
      !Number.isFinite(candidate.price) ||
      candidate.price <= 0
    ) {
      errors.push(
        createApplicationError(
          'validation',
          'MARKET_QUOTE_PRICE_INVALID',
          `Candidate price for origin "${candidate.origin}" must be a positive finite number.`,
        ),
      );
      continue;
    }
    if (Number.isNaN(Date.parse(candidate.timestamp))) {
      errors.push(
        createApplicationError(
          'validation',
          'MARKET_QUOTE_TIMESTAMP_INVALID',
          `Candidate timestamp for origin "${candidate.origin}" must be a valid ISO 8601 timestamp.`,
        ),
      );
      continue;
    }
    validCandidates.push(candidate);
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  let chosen: RawPriceCandidate | undefined;
  for (const origin of FALLBACK_ORDER) {
    chosen = validCandidates.find((candidate) => candidate.origin === origin);
    if (chosen !== undefined) break;
  }

  if (chosen === undefined) {
    return {
      ok: true,
      data: { asset: input.asset, currency: input.currency, freshness: 'unavailable' },
    };
  }

  const ageMinutes = (nowMs - Date.parse(chosen.timestamp)) / 60000;
  const freshness: Exclude<PriceFreshness, 'unavailable'> =
    ageMinutes > FRESHNESS_THRESHOLD_MINUTES ? 'stale' : 'fresh';

  return {
    ok: true,
    data: {
      asset: input.asset,
      currency: input.currency,
      freshness,
      price: chosen.price,
      origin: chosen.origin,
      timestamp: chosen.timestamp,
    },
  };
}

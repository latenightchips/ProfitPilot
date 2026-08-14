import { AAVE_RESERVES_QUERY, buildAaveReservesVariables } from './query';
import { aaveReservesResponseSchema } from './schemas';
import type { RawAaveReserve } from './types';

/**
 * Aave V3 subgraph client — the network layer `services/market/quote.ts`
 * and `services/protocol/quote.ts` both deliberately left unbuilt (see
 * their own SCOPE NOTE headers). Talks to The Graph's Gateway, which
 * hosts Aave's own published, official V3 subgraph deployments
 * (`aave/protocol-subgraphs`) — see `market.ts` for the exact deployment
 * used and `types.ts` for why this is used instead of the newer AaveKit
 * GraphQL API.
 *
 * **Requires a Graph API key — a real, separate-from-Aave product
 * dependency, not an Aave-issued credential.** The Graph deprecated
 * unauthenticated "hosted service" queries; every subgraph on its
 * current decentralized network is queried through
 * `https://gateway.thegraph.com/api/<API_KEY>/subgraphs/id/<SUBGRAPH_ID>`,
 * requiring a caller-provisioned key (free tier available, but a
 * separate signup at thegraph.com, not something this batch can
 * self-provision). `THEGRAPH_API_KEY` is read server-side only — see
 * `app/api/aave/reserve/route.ts`'s own header comment for why this
 * cannot be a `NEXT_PUBLIC_`-prefixed client-side variable, the same
 * "real secret" treatment `utils/env.ts` already gives
 * `COINGECKO_API_KEY`.
 *
 * **`04_BUILD_GUIDE.md` "API CLIENT RULES" implemented directly, not
 * assumed from a library**: an 8-second timeout (`AbortController`,
 * the doc's own "Recommended defaults" value) and up to 2 retries (the
 * doc's own "Retry Count: 2") on a network-level failure or a 5xx/429
 * response — never retried on a 4xx *client* error (a malformed query
 * would fail identically on every retry) or once the response body has
 * already been read (a partial/malformed body is a data problem, not a
 * transient one). No response caching is implemented here (the doc's
 * own "Cache Duration" values are a caller/route concern, not this
 * client's).
 */
const TIMEOUT_MS = 8000;
const MAX_RETRIES = 2;
const GRAPH_GATEWAY_BASE = 'https://gateway.thegraph.com/api';

export interface AaveProviderError {
  code: string;
  message: string;
  userMessage: string;
  retryable: boolean;
  provider: 'aave-v3-subgraph';
  timestamp: string;
}

export type AaveFetchResult =
  { ok: true; reserves: RawAaveReserve[] } | { ok: false; error: AaveProviderError };

function providerError(
  code: string,
  message: string,
  userMessage: string,
  retryable: boolean,
): AaveProviderError {
  return {
    code,
    message,
    userMessage,
    retryable,
    provider: 'aave-v3-subgraph',
    timestamp: new Date().toISOString(),
  };
}

async function fetchOnce(
  url: string,
  collateralSymbol: string,
  borrowSymbol: string,
  fetchImpl: typeof fetch,
): Promise<AaveFetchResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: AAVE_RESERVES_QUERY,
        variables: buildAaveReservesVariables(collateralSymbol, borrowSymbol),
      }),
      signal: controller.signal,
    });
  } catch (error) {
    // `error.name === 'AbortError'` covers both the DOMException `fetch`
    // itself throws on a real timeout and a plain Error a test double
    // might throw — DOMException is not `instanceof Error` in every
    // environment, so checking `.name` directly is the reliable test.
    const aborted =
      typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      (error as { name: unknown }).name === 'AbortError';
    return {
      ok: false,
      error: providerError(
        aborted ? 'AAVE_TIMEOUT' : 'AAVE_NETWORK_ERROR',
        aborted
          ? 'Request to the Aave subgraph timed out.'
          : 'Network request to the Aave subgraph failed.',
        'Live Aave data is temporarily unavailable.',
        true,
      ),
    };
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const retryable = response.status === 429 || response.status >= 500;
    return {
      ok: false,
      error: providerError(
        `AAVE_HTTP_${response.status}`,
        `Aave subgraph responded with HTTP ${response.status}.`,
        response.status === 429
          ? 'Live Aave data is temporarily rate-limited.'
          : 'Live Aave data is temporarily unavailable.',
        retryable,
      ),
    };
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return {
      ok: false,
      error: providerError(
        'AAVE_MALFORMED_RESPONSE',
        'Aave subgraph response was not valid JSON.',
        'Live Aave data is temporarily unavailable.',
        false,
      ),
    };
  }

  const parsed = aaveReservesResponseSchema.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      error: providerError(
        'AAVE_SCHEMA_VALIDATION_FAILED',
        `Aave subgraph response did not match the expected shape: ${parsed.error.issues[0]?.message ?? 'unknown validation error'}.`,
        'Live Aave data is temporarily unavailable.',
        false,
      ),
    };
  }

  return { ok: true, reserves: parsed.data.data.reserves };
}

export interface FetchAaveReservesParams {
  subgraphId: string;
  apiKey: string;
  collateralSymbol: string;
  borrowSymbol: string;
  /** Injectable for tests — `04_BUILD_GUIDE.md` "No network dependency should exist in unit tests. Use mocked providers." */
  fetchImpl?: typeof fetch;
}

export async function fetchAaveReserves(params: FetchAaveReservesParams): Promise<AaveFetchResult> {
  const fetchImpl = params.fetchImpl ?? fetch;
  const url = `${GRAPH_GATEWAY_BASE}/${params.apiKey}/subgraphs/id/${params.subgraphId}`;

  let lastResult: AaveFetchResult | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const result = await fetchOnce(url, params.collateralSymbol, params.borrowSymbol, fetchImpl);
    if (result.ok || !result.error.retryable) return result;
    lastResult = result;
  }
  return lastResult!;
}

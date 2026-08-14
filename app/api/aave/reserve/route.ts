import { NextResponse } from 'next/server';

import { fetchAaveReserves, mapAaveReserves } from '@/infrastructure/protocols/aave';
import { AAVE_V3_ETHEREUM_MAINNET } from '@/infrastructure/protocols/aave/market';
import type { RawPriceCandidate } from '@/services/market/quote';
import type { RawProtocolCandidate } from '@/services/protocol/quote';
import { env } from '@/utils/env';

/**
 * Server-only Route Handler for the Phase 1 read-only Aave live-data
 * integration. `THEGRAPH_API_KEY` (`utils/env.ts`) is read here, never
 * in client code — `04_BUILD_GUIDE.md`'s "CLIENT AND SERVER BOUNDARIES"
 * ("Credentials or protected operations must execute on the server").
 * `stores/aaveLiveDataStore.ts` (client-side) calls this same-origin
 * route instead of talking to the Aave subgraph / The Graph directly,
 * so the API key never reaches the browser.
 *
 * A missing/empty key is a normal, fully-handled state (no key
 * provisioned yet for this deployment), not a special case — it
 * returns the same clean, non-retryable error shape any other provider
 * failure would, so the client-side fallback logic needs no branch for
 * "not configured" versus "failed."
 */
export interface AaveReserveApiResponse {
  ok: boolean;
  data?: {
    priceCandidate: RawPriceCandidate;
    protocolCandidate: RawProtocolCandidate;
    collateralSymbol: string;
    borrowSymbol: string;
  };
  error?: {
    code: string;
    userMessage: string;
    retryable: boolean;
  };
}

export async function GET(): Promise<NextResponse<AaveReserveApiResponse>> {
  const apiKey = env.THEGRAPH_API_KEY;

  if (apiKey === undefined || apiKey === '') {
    return NextResponse.json({
      ok: false,
      error: {
        code: 'AAVE_NOT_CONFIGURED',
        userMessage: 'Live Aave data is not configured for this deployment.',
        retryable: false,
      },
    });
  }

  const fetchResult = await fetchAaveReserves({
    subgraphId: AAVE_V3_ETHEREUM_MAINNET.subgraphId,
    apiKey,
    collateralSymbol: AAVE_V3_ETHEREUM_MAINNET.collateralSymbol,
    borrowSymbol: AAVE_V3_ETHEREUM_MAINNET.borrowSymbol,
  });

  if (!fetchResult.ok) {
    return NextResponse.json({
      ok: false,
      error: {
        code: fetchResult.error.code,
        userMessage: fetchResult.error.userMessage,
        retryable: fetchResult.error.retryable,
      },
    });
  }

  const mapped = mapAaveReserves(fetchResult.reserves, AAVE_V3_ETHEREUM_MAINNET);
  if (!mapped.ok) {
    return NextResponse.json({
      ok: false,
      error: {
        code: mapped.error.code,
        userMessage: 'Live Aave data is temporarily unavailable.',
        retryable: false,
      },
    });
  }

  return NextResponse.json({ ok: true, data: mapped.data });
}

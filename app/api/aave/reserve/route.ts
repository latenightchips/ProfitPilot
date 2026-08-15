import { NextResponse } from 'next/server';

import type { AaveAdapterData, AaveAdapterError } from '@/infrastructure/protocols/aave';
import { getAaveAdapter } from '@/infrastructure/protocols/aave';
import { AAVE_V3_DEFAULT_RPC_URL } from '@/infrastructure/protocols/aave/v3/addresses';
import { env } from '@/utils/env';

/**
 * Read-only Aave V3 reserve snapshot — server-side only (RPC calls happen
 * here, not in the browser, via `infrastructure/protocols/aave/v3`'s
 * direct-RPC adapter). No wallet, no transaction execution.
 *
 * Supersedes the earlier Graph-subgraph-based Phase 1 route: same
 * `{ priceCandidate, protocolCandidate, collateralSymbol, borrowSymbol }`
 * response shape `stores/aaveLiveDataStore.ts` already consumes (plus a
 * new `source` field carrying protocol/version/network/block-number
 * metadata), so that store needs no changes. Falls back to a public
 * default RPC endpoint when `AAVE_RPC_URL` is unset — no "not configured"
 * state, unlike the old Graph-API-key-gated route — so Manual Mode's "no
 * external services required" guarantee holds without configuration.
 *
 * **`?borrowAsset` (USDT Support milestone)** — selects which Aave V3
 * borrow reserve to fetch (USDC or USDT this milestone; see
 * `infrastructure/protocols/aave/v3/addresses.ts`'s own header comment for
 * why DAI is deliberately excluded). Omitted/empty defaults to `USDC` for
 * backward compatibility with any existing caller that doesn't send it yet
 * — but every normal portfolio live-sync caller (`stores/aaveLiveDataStore.ts`)
 * sends the active portfolio's own `debt.asset` explicitly. Validation is
 * server-side: an unrecognized asset never reaches the adapter's RPC layer
 * silently — `fetchReserveSnapshot` itself fails closed with
 * `AAVE_UNSUPPORTED_BORROW_ASSET`, mapped to 400 below (a client input
 * problem, not an upstream RPC failure).
 */
export interface AaveReserveApiResponse {
  ok: boolean;
  data?: AaveAdapterData;
  error?: AaveAdapterError;
}

const DEFAULT_BORROW_ASSET = 'USDC';

export async function GET(request: Request): Promise<NextResponse<AaveReserveApiResponse>> {
  const requestedBorrowAsset = new URL(request.url).searchParams.get('borrowAsset');
  const borrowAsset =
    requestedBorrowAsset !== null && requestedBorrowAsset !== ''
      ? requestedBorrowAsset
      : DEFAULT_BORROW_ASSET;

  const rpcUrl =
    env.AAVE_RPC_URL !== '' && env.AAVE_RPC_URL != null
      ? env.AAVE_RPC_URL
      : AAVE_V3_DEFAULT_RPC_URL;
  const adapter = getAaveAdapter({ version: 'v3', rpcUrl });
  const result = await adapter.fetchReserveSnapshot(borrowAsset);

  if (!result.ok) {
    const status =
      result.error.code === 'AAVE_UNSUPPORTED_BORROW_ASSET'
        ? 400
        : result.error.retryable
          ? 503
          : 502;
    return NextResponse.json({ ok: false, error: result.error }, { status });
  }

  return NextResponse.json({ ok: true, data: result.data });
}

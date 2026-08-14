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
 */
export interface AaveReserveApiResponse {
  ok: boolean;
  data?: AaveAdapterData;
  error?: AaveAdapterError;
}

export async function GET(): Promise<NextResponse<AaveReserveApiResponse>> {
  const rpcUrl =
    env.AAVE_RPC_URL !== '' && env.AAVE_RPC_URL != null
      ? env.AAVE_RPC_URL
      : AAVE_V3_DEFAULT_RPC_URL;
  const adapter = getAaveAdapter({ version: 'v3', rpcUrl });
  const result = await adapter.fetchReserveSnapshot();

  if (!result.ok) {
    const status = result.error.retryable ? 503 : 502;
    return NextResponse.json({ ok: false, error: result.error }, { status });
  }

  return NextResponse.json({ ok: true, data: result.data });
}

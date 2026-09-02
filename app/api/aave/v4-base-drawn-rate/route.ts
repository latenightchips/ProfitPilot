import { NextResponse } from 'next/server';

import { fetchAaveV4BaseDrawnRate } from '@/infrastructure/protocols/aave/v4';
import { AAVE_V4_DEFAULT_RPC_URL } from '@/infrastructure/protocols/aave/v4/addresses';
import { createAaveV4RpcClient } from '@/infrastructure/protocols/aave/v4/client';
import type { AaveV4BaseDrawnRateSnapshot } from '@/infrastructure/protocols/aave/v4/types';
import { mapAaveV4AdapterFailure } from '@/services/aave/v4LivePosition';
import { createApplicationError } from '@/services/shared';
import type { ApplicationError } from '@/services/shared/errors';
import { env } from '@/utils/env';

import { type JsonSafe, toJsonSafe } from '../_shared/toJsonSafe';
import { withUnexpectedErrorBoundary } from '../_shared/unexpectedErrorBoundary';

/**
 * Read-only Aave V4 wallet-independent base-drawn-rate snapshot — closes
 * the "V4 portfolio creation always requires an on-chain address before
 * the market's own base drawn rate can become live" finding (V4
 * Manual-Data / Provenance Audit). Mirrors `../v4-reserve-price/route.ts`
 * exactly: server-side only, RPC calls happen here directly against
 * `fetchAaveV4BaseDrawnRate` (`infrastructure/protocols/aave/v4`) — never
 * in the browser, never inside `services/`
 * (`tests/unit/services/serviceFoundation.test.ts`'s M3-013 regression
 * test).
 *
 * **`?debtAsset` required, unlike `../v4-reserve-price/route.ts`.** The
 * collateral reserve's price has one fixed collateral asset
 * (`AAVE_V4_ETHEREUM_MARKET.collateralAsset`, always WBTC under this
 * codebase's single-collateral-asset scope), but the base drawn rate
 * genuinely varies per debt asset — USDC/USDT/DAI resolve to different
 * reserves, potentially on different Hubs. Mirrors `../v4-position/route.ts`'s
 * own required-query-param validation for the same reason.
 *
 * **Wrapped in `withUnexpectedErrorBoundary` — same R2-1 discipline as
 * every other Aave route.** Every failure mode above is already a typed
 * `{ok: false, error}` return, never a throw — this boundary only ever
 * catches something the classification layer itself didn't anticipate.
 *
 * **Response bigint-safe via `toJsonSafe`** — same discipline as every
 * other V4 route since the V4 bigint JSON serialization fix: `raw`
 * carries genuine on-chain `bigint`s (`blockNumber`, `drawnRateRay`,
 * etc.) that `NextResponse.json()` cannot serialize unconverted.
 */
export interface AaveV4BaseDrawnRateApiResponse {
  ok: boolean;
  /** Bigint-safe over the wire — see `../_shared/toJsonSafe.ts`'s own header comment. */
  data?: JsonSafe<AaveV4BaseDrawnRateSnapshot>;
  errors?: ApplicationError[];
}

/**
 * Error codes that represent a client input problem (missing/malformed
 * query param, or the adapter's own "this asset has no V4 support"
 * signal) rather than an upstream RPC failure — mapped to 400, the same
 * distinction `../v4-position/route.ts` draws.
 */
const CLIENT_INPUT_ERROR_CODES = new Set([
  'AAVE_V4_MISSING_QUERY_PARAMS',
  'AAVE_V4_UNSUPPORTED_DEBT_ASSET',
]);

/** Same retryable-error distinction as every other V4 route. */
const RETRYABLE_ERROR_CODES = new Set(['AAVE_V4_RPC_TIMEOUT', 'AAVE_V4_RPC_NETWORK_ERROR']);

function statusForErrors(errors: ApplicationError[]): number {
  const [first] = errors;
  if (first === undefined) return 502;
  if (first.category === 'validation' || CLIENT_INPUT_ERROR_CODES.has(first.code)) return 400;
  if (RETRYABLE_ERROR_CODES.has(first.code)) return 503;
  return 502;
}

function missingParamsResponse(): NextResponse<AaveV4BaseDrawnRateApiResponse> {
  return NextResponse.json(
    {
      ok: false,
      errors: [
        {
          category: 'validation',
          code: 'AAVE_V4_MISSING_QUERY_PARAMS',
          message: 'The debtAsset query parameter is required.',
        },
      ],
    },
    { status: 400 },
  );
}

const UNEXPECTED_ERROR_CODE = 'AAVE_V4_UNEXPECTED_ERROR';

function unexpectedErrorResponse(): NextResponse<AaveV4BaseDrawnRateApiResponse> {
  return NextResponse.json(
    {
      ok: false,
      errors: [
        createApplicationError(
          'unknown',
          UNEXPECTED_ERROR_CODE,
          'An unexpected error occurred. Please try again shortly.',
        ),
      ],
    },
    { status: 500 },
  );
}

export async function GET(request: Request): Promise<NextResponse<AaveV4BaseDrawnRateApiResponse>> {
  return withUnexpectedErrorBoundary<AaveV4BaseDrawnRateApiResponse>(
    'v4-base-drawn-rate',
    UNEXPECTED_ERROR_CODE,
    async () => {
      const searchParams = new URL(request.url).searchParams;
      const debtAsset = searchParams.get('debtAsset');

      if (debtAsset === null || debtAsset === '') {
        return missingParamsResponse();
      }

      const rpcUrl =
        env.AAVE_V4_RPC_URL !== '' && env.AAVE_V4_RPC_URL != null
          ? env.AAVE_V4_RPC_URL
          : AAVE_V4_DEFAULT_RPC_URL;
      const client = createAaveV4RpcClient(rpcUrl);

      const result = await fetchAaveV4BaseDrawnRate(client, debtAsset);

      if (!result.ok) {
        const error = mapAaveV4AdapterFailure(result.error);
        return NextResponse.json(
          { ok: false, errors: [error] },
          { status: statusForErrors([error]) },
        );
      }

      return NextResponse.json({ ok: true, data: toJsonSafe(result.data) });
    },
    unexpectedErrorResponse,
  );
}

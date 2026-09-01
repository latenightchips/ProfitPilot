import { NextResponse } from 'next/server';

import { fetchAaveV4ReservePrice } from '@/infrastructure/protocols/aave/v4';
import { AAVE_V4_DEFAULT_RPC_URL } from '@/infrastructure/protocols/aave/v4/addresses';
import { createAaveV4RpcClient } from '@/infrastructure/protocols/aave/v4/client';
import type { AaveV4ReservePriceSnapshot } from '@/infrastructure/protocols/aave/v4/types';
import { mapAaveV4AdapterFailure } from '@/services/aave/v4LivePosition';
import { createApplicationError } from '@/services/shared';
import type { ApplicationError } from '@/services/shared/errors';
import { env } from '@/utils/env';

import { type JsonSafe, toJsonSafe } from '../_shared/toJsonSafe';
import { withUnexpectedErrorBoundary } from '../_shared/unexpectedErrorBoundary';

/**
 * Read-only Aave V4 reserve-price snapshot — closes the "V4 new-portfolio
 * creation requires an on-chain address before BTC price can become
 * live" finding. Mirrors `../v4-collateral-risk/route.ts` exactly:
 * server-side only, RPC calls happen here directly against
 * `fetchAaveV4ReservePrice` (`infrastructure/protocols/aave/v4`) — never
 * in the browser, never inside `services/`
 * (`tests/unit/services/serviceFoundation.test.ts`'s M3-013 regression
 * test).
 *
 * **No query parameters at all** — unlike `../v4-collateral-risk/route.ts`
 * (`?userAddress`) or `../v4-position/route.ts` (`?userAddress`+
 * `?debtAsset`), this route's underlying fetch has no wallet-address or
 * debt-asset dimension: the collateral reserve's oracle price is a
 * property of the Spoke/reserve alone. The collateral asset itself is
 * resolved internally (always WBTC under this codebase's
 * single-collateral-asset scope), the same way
 * `../v4-collateral-risk/route.ts` already resolves it.
 *
 * **Wrapped in `withUnexpectedErrorBoundary` — same R2-1 discipline as
 * every other Aave route.** Every failure mode above is already a typed
 * `{ok: false, error}` return, never a throw — this boundary only ever
 * catches something the classification layer itself didn't anticipate.
 */
export interface AaveV4ReservePriceApiResponse {
  ok: boolean;
  /** Bigint-safe over the wire — see `../_shared/toJsonSafe.ts`'s own header comment. */
  data?: JsonSafe<AaveV4ReservePriceSnapshot>;
  errors?: ApplicationError[];
}

/** Same client-input/retryable distinctions as `../v4-collateral-risk/route.ts`, minus the address-validation codes this route never produces (no `?userAddress` to validate). */
const RETRYABLE_ERROR_CODES = new Set(['AAVE_V4_RPC_TIMEOUT', 'AAVE_V4_RPC_NETWORK_ERROR']);

function statusForErrors(errors: ApplicationError[]): number {
  const [first] = errors;
  if (first === undefined) return 502;
  if (first.category === 'validation') return 400;
  if (RETRYABLE_ERROR_CODES.has(first.code)) return 503;
  return 502;
}

const UNEXPECTED_ERROR_CODE = 'AAVE_V4_UNEXPECTED_ERROR';

function unexpectedErrorResponse(): NextResponse<AaveV4ReservePriceApiResponse> {
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

export async function GET(): Promise<NextResponse<AaveV4ReservePriceApiResponse>> {
  return withUnexpectedErrorBoundary<AaveV4ReservePriceApiResponse>(
    'v4-reserve-price',
    UNEXPECTED_ERROR_CODE,
    async () => {
      const rpcUrl =
        env.AAVE_V4_RPC_URL !== '' && env.AAVE_V4_RPC_URL != null
          ? env.AAVE_V4_RPC_URL
          : AAVE_V4_DEFAULT_RPC_URL;
      const client = createAaveV4RpcClient(rpcUrl);

      const result = await fetchAaveV4ReservePrice(client);

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

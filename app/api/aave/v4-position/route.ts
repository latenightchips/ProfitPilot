import { NextResponse } from 'next/server';

import { fetchAaveV4DebtSnapshot } from '@/infrastructure/protocols/aave/v4';
import { AAVE_V4_DEFAULT_RPC_URL } from '@/infrastructure/protocols/aave/v4/addresses';
import { createAaveV4RpcClient } from '@/infrastructure/protocols/aave/v4/client';
import type { AaveV4DebtSnapshot } from '@/infrastructure/protocols/aave/v4/types';
import {
  mapAaveV4AdapterFailure,
  validateAaveV4LivePositionRequest,
} from '@/services/aave/v4LivePosition';
import { createApplicationError } from '@/services/shared';
import type { ApplicationError } from '@/services/shared/errors';
import { env } from '@/utils/env';

import { withUnexpectedErrorBoundary } from '../_shared/unexpectedErrorBoundary';

/**
 * Read-only Aave V4 live position snapshot — V4 Readiness Audit §12 Stage
 * 4B. Server-side only, same discipline as `../reserve/route.ts`: RPC
 * calls happen here, directly against the Stage 3 read adapter — never in
 * the browser, never inside `services/` (`tests/unit/services/serviceFoundation.test.ts`'s
 * M3-013 regression test permanently forbids any `infrastructure/` import
 * under `services/`, so `services/aave/v4LivePosition.ts` stays
 * infrastructure-free; this route is the one place, alongside
 * `../reserve/route.ts` for V3, that RPC calls are allowed to happen). No
 * wallet, no transaction execution.
 *
 * **Query-param-driven**, mirroring `../reserve/route.ts`'s own
 * `?borrowAsset` convention: there is no server-side portfolio store in
 * this application (portfolios live client-side, per Manual Mode — see
 * `utils/env.ts`'s own header comment), so a stateless GET route has no
 * way to read `v4Position`/`debt.asset` except from the request itself.
 * `?userAddress` carries the value a caller would read from
 * `portfolio.v4Position.userAddress`; `?debtAsset` carries
 * `portfolio.debt.asset` — the route does not invent or store either
 * value, it only threads query-string input into
 * `validateAaveV4LivePositionRequest`'s identical-shaped parameters.
 * Wiring an actual caller (Store/hook) to send these is out of Stage 4B's
 * scope (V4 Readiness Audit §12 Stage 4C/4D).
 *
 * **Wrapped in `withUnexpectedErrorBoundary` — R2-1 ("Harden Aave API
 * Routes Against Unexpected Exceptions").** Every failure mode above
 * (missing params, validation, classified RPC/adapter errors) is
 * already a typed return, never a throw — this boundary only ever
 * catches something the classification layer itself didn't anticipate.
 * See that helper's own header comment for the full reasoning.
 */
export interface AaveV4PositionApiResponse {
  ok: boolean;
  data?: AaveV4DebtSnapshot;
  errors?: ApplicationError[];
}

/**
 * Error codes that represent a client input problem (missing/malformed
 * query params, or the adapter's own "this asset has no V4 support"
 * signal) rather than an upstream RPC failure — mapped to 400, the same
 * distinction `../reserve/route.ts` draws for `AAVE_UNSUPPORTED_BORROW_ASSET`.
 */
const CLIENT_INPUT_ERROR_CODES = new Set([
  'AAVE_V4_MISSING_QUERY_PARAMS',
  'AAVE_V4_MISSING_POSITION_IDENTITY',
  'AAVE_V4_INVALID_USER_ADDRESS',
  'AAVE_V4_UNSUPPORTED_DEBT_ASSET',
]);

/**
 * The only two adapter error codes `infrastructure/protocols/aave/v4/client.ts`'s
 * `classifyError` ever marks `retryable: true` for (timeouts, network
 * errors) — `ApplicationError` has no `retryable` field of its own (see
 * `services/aave/v4LivePosition.ts`'s own header comment for why that
 * flag isn't carried through), so this route re-derives the same
 * distinction from the adapter's still-preserved `code`.
 */
const RETRYABLE_ERROR_CODES = new Set(['AAVE_V4_RPC_TIMEOUT', 'AAVE_V4_RPC_NETWORK_ERROR']);

function statusForErrors(errors: ApplicationError[]): number {
  const [first] = errors;
  if (first === undefined) return 502;
  if (first.category === 'validation' || CLIENT_INPUT_ERROR_CODES.has(first.code)) return 400;
  if (RETRYABLE_ERROR_CODES.has(first.code)) return 503;
  return 502;
}

function missingParamsResponse(): NextResponse<AaveV4PositionApiResponse> {
  return NextResponse.json(
    {
      ok: false,
      errors: [
        {
          category: 'validation',
          code: 'AAVE_V4_MISSING_QUERY_PARAMS',
          message: 'Both userAddress and debtAsset query parameters are required.',
        },
      ],
    },
    { status: 400 },
  );
}

const UNEXPECTED_ERROR_CODE = 'AAVE_V4_UNEXPECTED_ERROR';

function unexpectedErrorResponse(): NextResponse<AaveV4PositionApiResponse> {
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

export async function GET(request: Request): Promise<NextResponse<AaveV4PositionApiResponse>> {
  return withUnexpectedErrorBoundary<AaveV4PositionApiResponse>(
    'v4-position',
    UNEXPECTED_ERROR_CODE,
    async () => {
      const searchParams = new URL(request.url).searchParams;
      const userAddress = searchParams.get('userAddress');
      const debtAsset = searchParams.get('debtAsset');

      if (userAddress === null || userAddress === '' || debtAsset === null || debtAsset === '') {
        return missingParamsResponse();
      }

      const validation = validateAaveV4LivePositionRequest({
        v4Position: { userAddress: userAddress as `0x${string}` },
        debtAssetSymbol: debtAsset,
      });

      if (!validation.ok) {
        return NextResponse.json(
          { ok: false, errors: validation.errors },
          { status: statusForErrors(validation.errors) },
        );
      }

      const rpcUrl =
        env.AAVE_V4_RPC_URL !== '' && env.AAVE_V4_RPC_URL != null
          ? env.AAVE_V4_RPC_URL
          : AAVE_V4_DEFAULT_RPC_URL;
      const client = createAaveV4RpcClient(rpcUrl);

      const result = await fetchAaveV4DebtSnapshot(
        client,
        validation.data.debtAssetSymbol,
        validation.data.userAddress,
      );

      if (!result.ok) {
        const error = mapAaveV4AdapterFailure(result.error);
        return NextResponse.json(
          { ok: false, errors: [error] },
          { status: statusForErrors([error]) },
        );
      }

      return NextResponse.json({ ok: true, data: result.data });
    },
    unexpectedErrorResponse,
  );
}

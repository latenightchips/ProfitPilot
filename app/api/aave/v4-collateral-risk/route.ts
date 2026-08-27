import { NextResponse } from 'next/server';

import { fetchAaveV4CollateralRiskSnapshot } from '@/infrastructure/protocols/aave/v4';
import { AAVE_V4_DEFAULT_RPC_URL } from '@/infrastructure/protocols/aave/v4/addresses';
import { createAaveV4RpcClient } from '@/infrastructure/protocols/aave/v4/client';
import type { AaveV4CollateralRiskSnapshot } from '@/infrastructure/protocols/aave/v4/types';
import { validateAaveV4CollateralRiskRequest } from '@/services/aave/v4CollateralRisk';
import { mapAaveV4AdapterFailure } from '@/services/aave/v4LivePosition';
import { createApplicationError } from '@/services/shared';
import type { ApplicationError } from '@/services/shared/errors';
import { env } from '@/utils/env';

import { withUnexpectedErrorBoundary } from '../_shared/unexpectedErrorBoundary';

/**
 * Read-only Aave V4 live collateral-risk snapshot — V4 Readiness Audit
 * §12 Stage 23F, mirroring `../v4-position/route.ts` exactly: server-side
 * only, RPC calls happen here directly against the Stage 23C read
 * adapter — never in the browser, never inside `services/`
 * (`tests/unit/services/serviceFoundation.test.ts`'s M3-013 regression
 * test).
 *
 * **Query-param-driven, `?userAddress` only** — no `?debtAsset`. Unlike
 * `../v4-position/route.ts`, `fetchAaveV4CollateralRiskSnapshot` resolves
 * the collateral asset internally (always WBTC under this codebase's
 * single-collateral-asset scope), so there is no second identity
 * parameter for a caller to supply.
 *
 * **Wrapped in `withUnexpectedErrorBoundary` — R2-1 ("Harden Aave API
 * Routes Against Unexpected Exceptions").** Mirrors `../v4-position/route.ts`'s
 * own identical boundary exactly — see that file, or the helper's own
 * header comment, for the full reasoning.
 */
export interface AaveV4CollateralRiskApiResponse {
  ok: boolean;
  data?: AaveV4CollateralRiskSnapshot;
  errors?: ApplicationError[];
}

/**
 * Error codes that represent a client input problem (missing/malformed
 * query param) rather than an upstream RPC failure — mapped to 400, the
 * same distinction `../v4-position/route.ts` draws.
 */
const CLIENT_INPUT_ERROR_CODES = new Set([
  'AAVE_V4_MISSING_QUERY_PARAMS',
  'AAVE_V4_MISSING_POSITION_IDENTITY',
  'AAVE_V4_INVALID_USER_ADDRESS',
]);

/** Same retryable-error distinction as `../v4-position/route.ts`. */
const RETRYABLE_ERROR_CODES = new Set(['AAVE_V4_RPC_TIMEOUT', 'AAVE_V4_RPC_NETWORK_ERROR']);

function statusForErrors(errors: ApplicationError[]): number {
  const [first] = errors;
  if (first === undefined) return 502;
  if (first.category === 'validation' || CLIENT_INPUT_ERROR_CODES.has(first.code)) return 400;
  if (RETRYABLE_ERROR_CODES.has(first.code)) return 503;
  return 502;
}

function missingParamsResponse(): NextResponse<AaveV4CollateralRiskApiResponse> {
  return NextResponse.json(
    {
      ok: false,
      errors: [
        {
          category: 'validation',
          code: 'AAVE_V4_MISSING_QUERY_PARAMS',
          message: 'The userAddress query parameter is required.',
        },
      ],
    },
    { status: 400 },
  );
}

const UNEXPECTED_ERROR_CODE = 'AAVE_V4_UNEXPECTED_ERROR';

function unexpectedErrorResponse(): NextResponse<AaveV4CollateralRiskApiResponse> {
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

export async function GET(
  request: Request,
): Promise<NextResponse<AaveV4CollateralRiskApiResponse>> {
  return withUnexpectedErrorBoundary<AaveV4CollateralRiskApiResponse>(
    'v4-collateral-risk',
    UNEXPECTED_ERROR_CODE,
    async () => {
      const searchParams = new URL(request.url).searchParams;
      const userAddress = searchParams.get('userAddress');

      if (userAddress === null || userAddress === '') {
        return missingParamsResponse();
      }

      const validation = validateAaveV4CollateralRiskRequest({
        v4Position: { userAddress: userAddress as `0x${string}` },
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

      const result = await fetchAaveV4CollateralRiskSnapshot(client, validation.data.userAddress);

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

/**
 * Aave V4 Live Collateral-Risk Service — V4 Readiness Audit §12 Stage
 * 23F, mirroring `./v4LivePosition.ts`'s own structure and discipline
 * exactly, one concern over.
 *
 * **No infrastructure import here — same M3-013 boundary
 * `./v4LivePosition.ts`'s own header comment documents.** The actual RPC
 * call (`infrastructure/protocols/aave/v4`'s `fetchAaveV4CollateralRiskSnapshot`,
 * Stage 23C) is made by `app/api/aave/v4-collateral-risk/route.ts`, never
 * here.
 *
 * **Deliberately simpler than `validateAaveV4LivePositionRequest` — no
 * `debtAssetSymbol` parameter at all.** `fetchAaveV4CollateralRiskSnapshot`
 * resolves the COLLATERAL asset internally
 * (`AAVE_V4_ETHEREUM_MARKET.collateralAsset`, fixed to WBTC under this
 * codebase's single-collateral-asset scope — 01_PRD.md REQ-003), unlike
 * the debt snapshot, which needs the caller's own debt asset symbol to
 * resolve a reserve. Only `v4Position` (the wallet identity) is required.
 *
 * `mapAaveV4AdapterFailure` (`./v4LivePosition.ts`) is reused directly by
 * the route rather than duplicated here — it is already a small, generic
 * function (any adapter failure shape maps to an `ApplicationError` the
 * same way), not a type whose cross-layer duplication convention would
 * apply.
 */
import { aaveV4PositionIdentitySchema } from '@/types/portfolio.schema';

import type { AaveV4PositionIdentity } from '../portfolio/models';
import { type ApplicationError, createApplicationError } from '../shared/errors';
import type { MappingResult } from '../shared/mappingResult';

export interface AaveV4CollateralRiskRequest {
  v4Position?: AaveV4PositionIdentity;
}

export interface ValidatedAaveV4CollateralRiskRequest {
  userAddress: `0x${string}`;
}

/**
 * Validates that a request carries a usable Aave V4 wallet identity
 * before the caller (the API route) spends an RPC round trip on it —
 * same role as `validateAaveV4LivePositionRequest`, minus the debt-asset
 * parameter that function needs and this one does not.
 */
export function validateAaveV4CollateralRiskRequest(
  request: AaveV4CollateralRiskRequest,
): MappingResult<ValidatedAaveV4CollateralRiskRequest> {
  if (request.v4Position === undefined) {
    const errors: ApplicationError[] = [
      createApplicationError(
        'validation',
        'AAVE_V4_MISSING_POSITION_IDENTITY',
        'This portfolio has no Aave V4 wallet address configured.',
      ),
    ];
    return { ok: false, errors };
  }

  const identity = aaveV4PositionIdentitySchema.safeParse(request.v4Position);
  if (!identity.success) {
    const errors: ApplicationError[] = [
      createApplicationError(
        'validation',
        'AAVE_V4_INVALID_USER_ADDRESS',
        'The configured Aave V4 wallet address is not valid.',
      ),
    ];
    return { ok: false, errors };
  }

  return {
    ok: true,
    // Schema-validated against `^0x[0-9a-fA-F]{40}$` above, so this is a
    // safe narrowing, not an unchecked cast — same convention as
    // `validateAaveV4LivePositionRequest`.
    data: { userAddress: identity.data.userAddress as `0x${string}` },
  };
}

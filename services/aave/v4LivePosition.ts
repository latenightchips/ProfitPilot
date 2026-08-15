/**
 * Aave V4 Live Position Service — V4 Readiness Audit §12 Stage 4B.
 *
 * **No infrastructure import here — by construction, not by omission.**
 * `tests/unit/services/serviceFoundation.test.ts`'s M3-013 regression
 * test permanently forbids any file under `services/` from referencing an
 * `infrastructure/` import path at all (`fetch`/`axios`/`process.env` are
 * forbidden the same way — "Avoid hardcoded infrastructure"). So, unlike
 * this file's first draft, the actual RPC call
 * (`infrastructure/protocols/aave/v4`'s `fetchAaveV4DebtSnapshot`) is not
 * made here — it is made directly by `app/api/aave/v4-position/route.ts`,
 * mirroring exactly how `app/api/aave/reserve/route.ts` already calls the
 * V3 adapter with no Service in between. This file supplies the two
 * pieces of pure, infrastructure-free logic Stage 4B's identity model
 * requires around that call: validating the identity/asset the route is
 * about to pass to the adapter, and converting the adapter's own error
 * shape into an `ApplicationError` the route can map to an HTTP status.
 *
 * **Identity sourcing (Stage 4B instruction).** `userAddress` comes from
 * Stage 4A's `AaveV4PositionIdentity` (`services/portfolio/models.ts`) —
 * `validateAaveV4LivePositionRequest`'s `v4Position` parameter is that
 * exact type, not a re-typed or renamed copy. `debtAssetSymbol` comes
 * from the same value `ApplicationPortfolio.debt.asset` already carries;
 * this file introduces no new field that duplicates it —
 * `debtAssetSymbol` here is only a parameter threading that existing
 * value through, the same way `fetchAaveV4DebtSnapshot` itself already
 * names its own parameter. A caller holding a full `ApplicationPortfolio`
 * calls this as `validateAaveV4LivePositionRequest({ v4Position:
 * portfolio.v4Position, debtAssetSymbol: portfolio.debt.asset })`.
 *
 * `v4Position` is optional for the same reason it's optional on
 * `ApplicationPortfolio` — most portfolios (every V3 portfolio, and every
 * portfolio created before a future V4 opt-in UI exists) have none.
 * Missing/invalid identity is reported as a distinct `ApplicationError`
 * rather than silently falling back to anything, matching the adapter's
 * own "fail closed, never a partial/placeholder result" discipline
 * (`infrastructure/protocols/aave/v4/index.ts`'s own header comment).
 * Address shape validation reuses `types/portfolio.schema.ts`'s own
 * `aaveV4PositionIdentitySchema` (built at Stage 4A specifically so a
 * real caller could validate against it once one existed) rather than
 * re-declaring the same regex here.
 *
 * **`MappingResult<T>`, not `ServiceResult<T>`.** Neither function here
 * calls an Engine formula — one validates already-available identity
 * data, the other reshapes an already-obtained error — so neither has a
 * real `engineVersion`/`formulaVersion` to report.
 * `services/portfolio/mapping.ts`'s own header comment establishes this
 * exact precedent (fabricating Engine metadata for a non-calculation
 * operation would be inventing a value with no real source); this file
 * follows it, the same way `services/protocol/quote.ts` and
 * `services/market/quote.ts` already do for their own non-Engine
 * normalization work.
 *
 * `mapAaveV4AdapterFailure`'s parameter is a small, locally-declared
 * structural type (`AaveV4AdapterFailureInput`), not an import of the
 * infrastructure layer's own `AaveV4AdapterError` — the same "duplicate
 * the shape, never cross-import between layers" convention
 * `services/portfolio/models.ts`'s own `AaveV4PositionIdentity` doc
 * comment already establishes for `AaveProtocolVersion`. The route passes
 * the real adapter error object in; it satisfies this shape structurally
 * without either file importing the other's types.
 */
import { aaveV4PositionIdentitySchema } from '@/types/portfolio.schema';

import type { AaveV4PositionIdentity } from '../portfolio/models';
import { type ApplicationError, createApplicationError } from '../shared/errors';
import type { MappingResult } from '../shared/mappingResult';

export interface AaveV4LivePositionRequest {
  v4Position?: AaveV4PositionIdentity;
  debtAssetSymbol: string;
}

export interface ValidatedAaveV4LivePositionRequest {
  userAddress: `0x${string}`;
  debtAssetSymbol: string;
}

/**
 * Validates that a request carries a usable Aave V4 position identity
 * before the caller (the API route) spends an RPC round trip on it.
 * Does NOT validate `debtAssetSymbol` against the supported-asset list —
 * that list is already owned by
 * `infrastructure/protocols/aave/v4/addresses.ts`, and the adapter itself
 * already fails closed with `AAVE_V4_UNSUPPORTED_DEBT_ASSET` for an
 * unsupported symbol; duplicating that check here would be a second,
 * driftable copy of the same rule.
 */
export function validateAaveV4LivePositionRequest(
  request: AaveV4LivePositionRequest,
): MappingResult<ValidatedAaveV4LivePositionRequest> {
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
    data: {
      // Schema-validated against `^0x[0-9a-fA-F]{40}$` above, so this is a
      // safe narrowing, not an unchecked cast — same convention as the
      // only other address cast in this codebase
      // (`scripts/verifyAaveV4Snapshot.ts`).
      userAddress: identity.data.userAddress as `0x${string}`,
      debtAssetSymbol: request.debtAssetSymbol,
    },
  };
}

export interface AaveV4AdapterFailureInput {
  code: string;
  userMessage: string;
}

/**
 * Converts an Aave V4 adapter failure into an `ApplicationError`,
 * category `'provider'` — preserving the adapter's own `code` unchanged
 * and using its `userMessage` (already a safe, display-ready string) as
 * the `ApplicationError.message` — never the adapter's internal
 * `message`, which may include contract/RPC detail not meant for
 * display. `app/api/aave/v4-position/route.ts` maps the preserved `code`
 * to an HTTP status.
 */
export function mapAaveV4AdapterFailure(error: AaveV4AdapterFailureInput): ApplicationError {
  return createApplicationError('provider', error.code, error.userMessage);
}

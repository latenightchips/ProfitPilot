import { createFailure, type FormulaResult } from '../shared/result';
import { projectVariableDebt as projectAaveV3Debt } from './aaveV3';
import { projectVariableDebt as projectAaveV4Debt } from './aaveV4';
import type { AaveProtocolVersion } from './types';

export type { AaveProtocolVersion } from './types';

/**
 * Centralized protocol/version dispatch for debt projection — V4
 * Readiness Audit §12 Stage 1. This is the one place that resolves "which
 * protocol-version's math to run" from an explicit `AaveProtocolVersion`.
 * `services/simulation/scenario.ts` previously imported
 * `projectVariableDebt` from `./aaveV3` directly, bypassing any version
 * boundary — the exact architectural gap this dispatcher closes. Adding a
 * protocol/version means adding one registry entry here; no existing
 * consumer changes.
 *
 * A `Record<AaveProtocolVersion, DebtProjector>` (not an `if`/`else if`
 * chain) makes it structurally impossible to silently fall through an
 * unhandled version into V3's entry — every key must be explicitly
 * populated, and TypeScript enforces that at the registry's own
 * declaration site, not at each call site.
 */
type DebtProjector = (
  currentDebt: number,
  borrowApr: number,
  elapsedDays: number,
) => FormulaResult<number>;

const AAVE_DEBT_PROJECTORS: Record<AaveProtocolVersion, DebtProjector> = {
  v3: projectAaveV3Debt,
  v4: projectAaveV4Debt,
};

/**
 * Projects debt forward under the given Aave protocol version's own
 * accrual semantics. For `'v3'`, this forwards to the exact, unmodified
 * `projectVariableDebt` (`./aaveV3`) — same inputs, same outputs, same
 * `FormulaResult` (including its `formulaId`/`formulaVersion`/
 * `inputsUsed`), untouched. For `'v4'`, this forwards to `./aaveV4`'s
 * explicit not-implemented failure — never V3's math, never a placeholder
 * number.
 *
 * A `protocolVersion` outside the known registry (reachable only from
 * unvalidated/legacy data bypassing the `AaveProtocolVersion` type, e.g.
 * `as unknown as AaveProtocolVersion` in a test) fails closed with its own
 * structured error rather than throwing.
 */
export function projectProtocolDebt(
  protocolVersion: AaveProtocolVersion,
  currentDebt: number,
  borrowApr: number,
  elapsedDays: number,
): FormulaResult<number> {
  const projector = AAVE_DEBT_PROJECTORS[protocolVersion];
  if (projector === undefined) {
    return createFailure(
      {
        code: 'PROTOCOL_VERSION_UNSUPPORTED',
        message: `No debt-projection implementation is registered for Aave protocol version "${String(protocolVersion)}".`,
      },
      {
        formulaId: 'AAVE-PROTOCOL-DISPATCH',
        formulaVersion: '1.0',
        inputsUsed: { protocolVersion, currentDebt, borrowApr, elapsedDays },
      },
    );
  }
  return projector(currentDebt, borrowApr, elapsedDays);
}

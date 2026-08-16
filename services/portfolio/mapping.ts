/**
 * Portfolio Mapping Utilities — 06_TASKS.md M3-004.
 *
 * Explicit mapping functions between the persistence-layer Portfolio
 * shape, the application-layer Portfolio shape, and the Formula Engine's
 * own `PortfolioInput` (`./models.ts` documents why both are currently
 * minimal). Satisfies M3-004's 4 Requirements directly:
 *   - "Keep mappings explicit": every field is read and assigned by name,
 *     never spread or bulk-copied.
 *   - "Validate required fields": enforced at the persistence →
 *     application boundary, where data may legitimately be missing.
 *   - "Avoid unsafe type casting": no `as` casts anywhere in this file —
 *     every value used in a constructed object comes from a helper
 *     function whose own return type already proves it's valid, not from
 *     asserting an unchecked value's type.
 *   - "Do not format values for display": every value here is a raw
 *     number/string, exactly as the Engine expects — no currency,
 *     percentage, or date formatting.
 *
 * `MappingResult<T>` (not `ServiceResult<T>` from M3-002) is used here
 * deliberately: `ServiceResult`'s metadata (`engineVersion`,
 * `formulaVersion`, a calculation timestamp) describes an Engine
 * *calculation*, and this file performs none — it only reshapes data.
 * Forcing an `engineVersion` onto a mapping operation that never calls
 * the Engine would mean fabricating a value with no real source, which
 * is its own kind of invention. `MappingResult` reuses `ApplicationError`
 * (M3-003) for its error shape, so a Service that calls this mapping
 * (M3-005 onward) can pass a mapping failure's `errors` straight into a
 * real `ServiceResult` failure at the point it actually does have Engine
 * metadata to report.
 *
 * `MappingResult<T>` itself now lives in `services/shared/mappingResult.ts`
 * (relocated at M3-007, Market Data Service — the second consumer that
 * needed the identical type, the promotion trigger this file originally
 * anticipated). Re-exported here unchanged so nothing importing it from
 * this module's public API needs to change.
 */
import type { PortfolioInput } from '@/engine';

import { type ApplicationError, createApplicationError } from '../shared/errors';
import type { MappingResult } from '../shared/mappingResult';
import type {
  ApplicationPortfolio,
  PersistenceCollateralPosition,
  PersistenceDebtPosition,
  PersistenceMarketPrices,
  PersistencePortfolio,
  PersistenceProtocolParameters,
} from './models';

export type { MappingFailure, MappingResult, MappingSuccess } from '../shared/mappingResult';

function readRequiredNumber(
  value: number | null | undefined,
  code: string,
  message: string,
  errors: ApplicationError[],
): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    errors.push(createApplicationError('validation', code, message));
    return undefined;
  }
  return value;
}

function readRequiredNonEmptyString(
  value: string | null | undefined,
  code: string,
  message: string,
  errors: ApplicationError[],
): string | undefined {
  if (typeof value !== 'string' || value.length === 0) {
    errors.push(createApplicationError('validation', code, message));
    return undefined;
  }
  return value;
}

function mapCollateralPosition(
  persistence: PersistenceCollateralPosition | null | undefined,
  errors: ApplicationError[],
): ApplicationPortfolio['collateral'] | undefined {
  const isBtc = persistence?.asset === 'BTC';
  if (!isBtc) {
    errors.push(
      createApplicationError(
        'validation',
        'PORTFOLIO_COLLATERAL_ASSET_INVALID',
        'Collateral asset must be BTC.',
      ),
    );
  }
  const quantity = readRequiredNumber(
    persistence?.quantity,
    'PORTFOLIO_COLLATERAL_QUANTITY_MISSING',
    'Collateral quantity is required.',
    errors,
  );

  if (!isBtc || quantity === undefined) return undefined;
  return { asset: 'BTC', quantity };
}

function mapDebtPosition(
  persistence: PersistenceDebtPosition | null | undefined,
  errors: ApplicationError[],
): ApplicationPortfolio['debt'] | undefined {
  const asset = readRequiredNonEmptyString(
    persistence?.asset,
    'PORTFOLIO_DEBT_ASSET_MISSING',
    'Debt asset is required.',
    errors,
  );
  const balance = readRequiredNumber(
    persistence?.balance,
    'PORTFOLIO_DEBT_BALANCE_MISSING',
    'Debt balance is required.',
    errors,
  );

  if (asset === undefined || balance === undefined) return undefined;
  return { asset, balance };
}

function mapMarketPrices(
  persistence: PersistenceMarketPrices | null | undefined,
  errors: ApplicationError[],
): ApplicationPortfolio['market'] | undefined {
  const btcPriceUsd = readRequiredNumber(
    persistence?.btcPriceUsd,
    'PORTFOLIO_MARKET_PRICE_MISSING',
    'Current BTC price is required.',
    errors,
  );

  if (btcPriceUsd === undefined) return undefined;
  return { btcPriceUsd };
}

function mapProtocolParameters(
  persistence: PersistenceProtocolParameters | null | undefined,
  errors: ApplicationError[],
): ApplicationPortfolio['protocol'] | undefined {
  const maxLoanToValue = readRequiredNumber(
    persistence?.maxLoanToValue,
    'PORTFOLIO_PROTOCOL_MAX_LTV_MISSING',
    'Protocol maximum LTV is required.',
    errors,
  );
  const liquidationThreshold = readRequiredNumber(
    persistence?.liquidationThreshold,
    'PORTFOLIO_PROTOCOL_LIQUIDATION_THRESHOLD_MISSING',
    'Protocol liquidation threshold is required.',
    errors,
  );
  const borrowApr = readRequiredNumber(
    persistence?.borrowApr,
    'PORTFOLIO_PROTOCOL_BORROW_APR_MISSING',
    'Protocol borrow APR is required.',
    errors,
  );
  const supplyApr = readRequiredNumber(
    persistence?.supplyApr,
    'PORTFOLIO_PROTOCOL_SUPPLY_APR_MISSING',
    'Protocol supply APR is required.',
    errors,
  );

  if (
    maxLoanToValue === undefined ||
    liquidationThreshold === undefined ||
    borrowApr === undefined ||
    supplyApr === undefined
  ) {
    return undefined;
  }
  return { maxLoanToValue, liquidationThreshold, borrowApr, supplyApr };
}

/**
 * Persistence → Application — 06_TASKS.md M3-004. The only mapping step
 * where "Validate required fields" applies: persisted data may
 * legitimately be missing or malformed, so this is where that gets
 * caught, aggregating every field-level problem into `errors` rather
 * than stopping at the first one (mirroring `ServiceFailure.errors`'
 * plural design from M3-002/M3-003).
 */
export function mapPersistencePortfolioToApplicationPortfolio(
  persistence: PersistencePortfolio,
): MappingResult<ApplicationPortfolio> {
  const errors: ApplicationError[] = [];

  const collateral = mapCollateralPosition(persistence.collateral, errors);
  const debt = mapDebtPosition(persistence.debt, errors);
  const market = mapMarketPrices(persistence.market, errors);
  const protocol = mapProtocolParameters(persistence.protocol, errors);

  if (
    collateral === undefined ||
    debt === undefined ||
    market === undefined ||
    protocol === undefined
  ) {
    return { ok: false, errors };
  }

  return { ok: true, data: { collateral, debt, market, protocol } };
}

/**
 * Application → Engine input — 06_TASKS.md M3-004. Infallible: by the
 * time a value is a valid `ApplicationPortfolio`, every field is already
 * an Engine-compatible type (reused directly from `@/engine`, see
 * `./models.ts`), so there is nothing left to validate here. The value
 * of this function is structural, not defensive: it is the one place
 * that reads only the 4 Engine-relevant fields and nothing else — once
 * M4-001 extends `ApplicationPortfolio` with identity/description/
 * currency/settings/timestamp fields, this is what keeps those fields
 * from leaking into the Engine (M3-004's own DoD), by construction.
 *
 * **Canonical V4 debt balance (V4 Readiness Audit §12 Stage 9).** Every
 * caller of this function (`calculatePortfolioSummary`, `simulateScenario`,
 * and every other Service that reads `PortfolioInput.debt.balance` —
 * `services/loop/strategy.ts`, `services/exit/plan.ts`,
 * `services/recommendation/*`, `services/portfolio/exposure.ts`,
 * `services/portfolio/interestBreakdown.ts`) was, before this stage,
 * silently reading the legacy `ApplicationPortfolio.debt.balance` field
 * even for a `protocolVersion: 'v4'` portfolio — a field Stage 6/7's live
 * sync never writes to, so it can freely disagree with the portfolio's
 * real on-chain V4 debt. When `protocolVersion === 'v4'` AND a real
 * `v4DebtState` (Stage 6/7) is present, `debt.balance` below is instead
 * `v4DebtState.drawnDebt + v4DebtState.premiumDebt` — the portfolio's
 * actual current total V4 debt. This is a plain sum of two already-known
 * current-state numbers, not a re-derivation of any accrual formula —
 * the same "not V4 math, just reading real inputs" discipline
 * `services/simulation/scenario.ts`'s own `currentTotalDebt` (Stage 8)
 * already established (that file's own duplicate of this same sum was
 * removed this stage now that it's centralized here).
 *
 * **Still infallible by design** — when `protocolVersion === 'v4'` but
 * `v4DebtState` is `undefined`, this function returns the legacy
 * `debt.balance` unchanged rather than failing. The explicit "fail
 * closed instead of silently using V3 debt semantics" requirement is
 * enforced by callers that have real `ServiceResult` failure metadata to
 * report from: `services/portfolio/summary.ts`'s `calculatePortfolioSummary`
 * gained that guard this stage (covering the Portfolio Store's own
 * displayed summary, and — since `simulateScenario` calls it first for
 * its baseline, for every scenario type — both Simulation branches too).
 * `services/loop/strategy.ts`/`services/exit/plan.ts`/
 * `services/recommendation/*` do not yet enforce it independently; see
 * PROJECT_STATUS.md's Stage 9 write-up for that explicitly-scoped gap.
 */
export function mapApplicationPortfolioToEngineInput(
  application: ApplicationPortfolio,
): PortfolioInput {
  const canonicalDebtBalance =
    application.protocolVersion === 'v4' && application.v4DebtState !== undefined
      ? application.v4DebtState.drawnDebt + application.v4DebtState.premiumDebt
      : application.debt.balance;

  return {
    collateral: application.collateral,
    debt: { asset: application.debt.asset, balance: canonicalDebtBalance },
    market: application.market,
    protocol: application.protocol,
  };
}

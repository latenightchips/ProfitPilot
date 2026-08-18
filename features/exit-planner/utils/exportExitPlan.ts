import {
  type ApplicationPortfolio,
  deriveAaveV4EffectiveBorrowRate,
  type ExitPlanResult,
  resolveCanonicalDebtBalance,
  resolveRiskCapacityDisplay,
  type ServiceMetadata,
  type UnavailableExitCost,
} from '@/services';
import type { ExitPlannerTargetInputs, ExitPlannerType } from '@/stores/exitPlannerStore';
import type { StrategyWarning } from '@/types/strategy';

/** No real Engine call precedes this export — the same "first call, no prior tracked version" case `services/export/CsvExporter.ts` already established for this same function. */
const EXPORT_SOURCE_STATUS = 'export';

/**
 * V4 Readiness Audit §12 Stage 22 — mirrors `services/export/CsvExporter.ts`'s
 * own `resolveBorrowAprForExport` exactly. `assumptions.protocolParameters`
 * below previously always carried raw `portfolio.protocol.borrowApr`, the
 * legacy V3 scalar, exported as-is regardless of protocol version. For a
 * V4 portfolio this can disagree with the real synced `v4DebtState` (no
 * defined relationship between the two — see
 * `services/portfolio/mapping.ts`'s `deriveAaveV4EffectiveBorrowRate` for
 * the full reasoning) and, since `hooks/useAaveLiveSync.ts` keeps
 * `portfolio.protocol` live-synced from the V3 pool regardless of
 * `protocolVersion`, is not even reliably stale — it can be a real,
 * currently-fetched, wrong-protocol rate. Never falls back to the legacy
 * scalar for V4: `null` (rendered as "Not available" in CSV, literal
 * `null` in JSON) when `v4DebtState` is absent or the derivation fails.
 */
function resolveBorrowAprForExport(portfolio: ApplicationPortfolio): number | null {
  if (portfolio.protocolVersion !== 'v4') return portfolio.protocol.borrowApr;
  if (portfolio.v4DebtState === undefined) return null;
  const rateStep = deriveAaveV4EffectiveBorrowRate(
    portfolio.v4DebtState,
    null,
    EXPORT_SOURCE_STATUS,
  );
  return rateStep.ok ? rateStep.value : null;
}

/**
 * V4 Readiness Audit §12 Stage 23E — `maxLoanToValue`/`liquidationThreshold`
 * previously always carried `portfolio.protocol.*` unconditionally, a
 * meaningless V3 pair for a V4 portfolio (Stage 23B: `collateralFactor`
 * alone governs both). `null` for whichever fields don't apply to the
 * portfolio's own protocol version, rather than a reinterpreted V3 field.
 */
function resolveProtocolParametersForExport(
  portfolio: ApplicationPortfolio,
): ExitPlanExportPayload['assumptions']['protocolParameters'] {
  const riskCapacityDisplay = resolveRiskCapacityDisplay(portfolio);
  return {
    maxLoanToValue: riskCapacityDisplay.kind === 'v3' ? riskCapacityDisplay.maxLoanToValue : null,
    liquidationThreshold:
      riskCapacityDisplay.kind === 'v3' ? riskCapacityDisplay.liquidationThreshold : null,
    collateralFactor:
      riskCapacityDisplay.kind === 'v4Available' ? riskCapacityDisplay.collateralFactor : null,
    supplyApr: portfolio.protocol.supplyApr,
    borrowApr: resolveBorrowAprForExport(portfolio),
  };
}

/**
 * Exit Plan Export — 06_TASKS.md M7-030 ("Implement Exit Plan Export").
 * Dependencies: M7-029. Priority P1, Effort M. Formats: "JSON, CSV,
 * Future PDF." Include: "Current portfolio state, Targets, Actions,
 * Expected result, Costs, Warnings, Assumptions, Versions." DoD:
 * "Exported plans contain all data required for review."
 *
 * **Mirrors `features/loop-builder/utils/exportLoopStrategy.ts` (M7-018)
 * closely** — same Blob + temporary-anchor download pattern, same
 * "Formats: JSON, CSV, Future PDF" deferral (no PDF library), same
 * "operates on the currently active plan, not a specific saved row"
 * scope (a saved plan can already be reopened via
 * `ExitPlanLibrary.tsx`'s own Load button first).
 *
 * **"Current portfolio state" → `portfolio.collateral`/`.debt`/
 * `.market` (the live prop, unmodified) — except `debtBalance`, which is
 * `resolveCanonicalDebtBalance(portfolio)` (V4 Readiness Audit §12 Stage
 * 16), not raw `debt.balance` directly: a successful `result` here always
 * implies `planExit` already resolved the real synced V4 debt (it fails
 * closed otherwise, per Stage 10), so exporting the possibly-stale legacy
 * field instead would make this snapshot disagree with the plan's own
 * `expectedResult.remainingDebt`, computed from that same canonical
 * total. "Targets" → `exitType` +
 * `targetInputs` (the exact values the user configured). "Actions" →
 * `expectedResult`'s own `btcSold`/`debtRepaid` — the concrete
 * transaction the Engine computed, not re-derived. "Expected result" →
 * the rest of `expectedResult` (`btcRetained`/`remainingDebt`/
 * `resultingEquity`/`resultingHealthFactor`), `null` when infeasible
 * (no outcome exists to report). "Costs" → the same itemized
 * `unavailableCosts` (conflict #8) `FullExitResult.tsx`/
 * `PartialExitResult.tsx` already display. "Warnings" → the Store's
 * own `warnings` (`StrategyWarning[]`), a frozen snapshot at export
 * time. "Assumptions" → Protocol Parameters plus the same documented
 * Fees & Slippage conflict #8 gap. "Versions" →
 * `metadata?.engineVersion`/`.formulaVersion`, `null` shown as "Not
 * captured."**
 *
 * **An infeasible plan is still exportable — the same real, reachable
 * path `exportLoopStrategy.ts`'s own header comment documents for a
 * non-viable Loop strategy.** `ExitPlanExport.tsx`'s own empty-state
 * guard only checks `exitType`/`currentResult` for `null`, not
 * `feasible` — a user who configures an infeasible target can still
 * export the resulting `warnings` even though `expectedResult` is
 * `null`.
 *
 * **`csvEscape`/`csvRow` are duplicated locally, not imported
 * cross-feature** — the same "each feature owns its own thin utility
 * layer" precedent `exportLoopStrategy.ts` already established.
 */
export const EXIT_EXPORT_SCHEMA_VERSION = '0.1.0';

export interface ExitPlanExportPayload {
  schemaVersion: string;
  exitType: ExitPlannerType;
  targetInputs: ExitPlannerTargetInputs;
  currentPortfolioState: {
    collateralQuantity: number;
    debtBalance: number;
    btcPriceUsd: number;
  };
  expectedResult: {
    btcSold: number;
    debtRepaid: number;
    btcRetained: number;
    remainingDebt: number;
    resultingEquity: number;
    resultingHealthFactor: number;
  } | null;
  infeasibleReason: string | null;
  costs: UnavailableExitCost[] | null;
  warnings: StrategyWarning[];
  assumptions: {
    protocolParameters: {
      /**
       * V4 Readiness Audit §12 Stage 23E — `null` for a V4 portfolio
       * (never the legacy `protocol.maxLoanToValue`/`.liquidationThreshold`
       * scalars, which have no defined relationship to V4's real
       * `collateralFactor` — Stage 23B: V4 has no separate max-LTV/
       * liquidation-threshold pair at all). Populated exactly as before
       * for V3.
       */
      maxLoanToValue: number | null;
      liquidationThreshold: number | null;
      /** V4 Readiness Audit §12 Stage 23E — the real V4 risk-capacity parameter; `null` for V3 or when unavailable for a V4 portfolio. */
      collateralFactor: number | null;
      supplyApr: number;
      /** V4 Readiness Audit §12 Stage 22 — `resolveBorrowAprForExport`'s canonical value, `null` (never the legacy V3 scalar) when unavailable for a V4 portfolio. */
      borrowApr: number | null;
    };
    feesAndSlippage: string;
  };
  versions: { engineVersion: string; formulaVersion: string } | null;
  timestamp: string | null;
}

const FEES_AND_SLIPPAGE_NOTE =
  'Not included — no Formula ID or equation for swap fees, slippage, or gas estimation exists in 02_Formulas.md.';

export function buildExitPlanExportPayload(
  exitType: ExitPlannerType,
  targetInputs: ExitPlannerTargetInputs,
  result: ExitPlanResult,
  warnings: StrategyWarning[],
  metadata: ServiceMetadata | null,
  portfolio: ApplicationPortfolio,
): ExitPlanExportPayload {
  return {
    schemaVersion: EXIT_EXPORT_SCHEMA_VERSION,
    exitType,
    targetInputs,
    currentPortfolioState: {
      collateralQuantity: portfolio.collateral.quantity,
      debtBalance: resolveCanonicalDebtBalance(portfolio),
      btcPriceUsd: portfolio.market.btcPriceUsd,
    },
    expectedResult:
      result.feasible && result.transaction !== null && result.after !== null
        ? {
            btcSold: result.transaction.btcSold,
            debtRepaid: result.transaction.repayment,
            btcRetained: result.transaction.btcRetained,
            remainingDebt: result.after.debtValue,
            resultingEquity: result.after.netEquity,
            resultingHealthFactor: result.after.healthFactor,
          }
        : null,
    infeasibleReason: result.infeasibleReason ?? null,
    costs: result.unavailableCosts,
    warnings,
    assumptions: {
      protocolParameters: resolveProtocolParametersForExport(portfolio),
      feesAndSlippage: FEES_AND_SLIPPAGE_NOTE,
    },
    versions:
      metadata === null
        ? null
        : { engineVersion: metadata.engineVersion, formulaVersion: metadata.formulaVersion },
    timestamp: metadata?.calculationTimestamp ?? null,
  };
}

export function buildExitPlanExportJson(payload: ExitPlanExportPayload): string {
  return JSON.stringify(payload, null, 2);
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function csvRow(field: string, value: string | number): string {
  return `${csvEscape(field)},${csvEscape(String(value))}`;
}

export function buildExitPlanExportCsv(payload: ExitPlanExportPayload): string {
  const rows: string[] = ['Field,Value'];

  rows.push(csvRow('Schema Version', payload.schemaVersion));
  rows.push(csvRow('Exit Type', payload.exitType));
  if (payload.targetInputs.repaymentAmount !== undefined) {
    rows.push(csvRow('Repayment Amount', payload.targetInputs.repaymentAmount));
  }
  if (payload.targetInputs.targetHealthFactor !== undefined) {
    rows.push(csvRow('Target Health Factor', payload.targetInputs.targetHealthFactor));
  }
  if (payload.targetInputs.targetRetainedBtc !== undefined) {
    rows.push(csvRow('Target Retained BTC', payload.targetInputs.targetRetainedBtc));
  }
  if (payload.targetInputs.targetDebtBalance !== undefined) {
    rows.push(csvRow('Target Debt Balance', payload.targetInputs.targetDebtBalance));
  }
  if (payload.targetInputs.scenarioBtcPriceUsd !== undefined) {
    rows.push(csvRow('Target BTC Price', payload.targetInputs.scenarioBtcPriceUsd));
  }

  rows.push(
    csvRow('Current Collateral Quantity', payload.currentPortfolioState.collateralQuantity),
  );
  rows.push(csvRow('Current Debt Balance', payload.currentPortfolioState.debtBalance));
  rows.push(csvRow('Current BTC Price', payload.currentPortfolioState.btcPriceUsd));

  if (payload.expectedResult !== null) {
    rows.push(csvRow('BTC Sold', payload.expectedResult.btcSold));
    rows.push(csvRow('Debt Repaid', payload.expectedResult.debtRepaid));
    rows.push(csvRow('BTC Retained', payload.expectedResult.btcRetained));
    rows.push(csvRow('Remaining Debt', payload.expectedResult.remainingDebt));
    rows.push(csvRow('Resulting Equity', payload.expectedResult.resultingEquity));
    rows.push(csvRow('Resulting Health Factor', payload.expectedResult.resultingHealthFactor));
  } else {
    rows.push(
      csvRow(
        'Expected Result',
        `Not available — ${payload.infeasibleReason ?? 'the target is not feasible.'}`,
      ),
    );
  }

  if (payload.costs !== null) {
    for (const cost of payload.costs) {
      rows.push(csvRow(`Cost — ${cost.item}`, cost.reason));
    }
  }

  payload.warnings.forEach((warning, index) => {
    rows.push(csvRow(`Warning ${index + 1}`, `${warning.severity}: ${warning.cause}`));
  });

  // V4 Readiness Audit §12 Stage 23E — V3's exact two rows unchanged; V4
  // has no separate max-LTV/liquidation-threshold pair (Stage 23B), so
  // its one "Collateral Factor" row replaces them rather than sitting
  // alongside two always-"Not available" rows.
  if (payload.assumptions.protocolParameters.maxLoanToValue !== null) {
    rows.push(csvRow('Max LTV', payload.assumptions.protocolParameters.maxLoanToValue));
    rows.push(
      csvRow('Liquidation Threshold', payload.assumptions.protocolParameters.liquidationThreshold!),
    );
  } else {
    rows.push(
      csvRow(
        'Collateral Factor',
        payload.assumptions.protocolParameters.collateralFactor ?? 'Not available',
      ),
    );
  }
  rows.push(
    csvRow(
      'Borrow APR (Protocol)',
      payload.assumptions.protocolParameters.borrowApr ?? 'Not available',
    ),
  );
  rows.push(csvRow('Supply APR', payload.assumptions.protocolParameters.supplyApr));
  rows.push(csvRow('Fees & Slippage', payload.assumptions.feesAndSlippage));

  rows.push(csvRow('Timestamp', payload.timestamp ?? 'Not captured'));
  rows.push(
    csvRow(
      'Engine Version',
      payload.versions !== null ? payload.versions.engineVersion : 'Not captured',
    ),
  );
  rows.push(
    csvRow(
      'Formula Version',
      payload.versions !== null ? payload.versions.formulaVersion : 'Not captured',
    ),
  );

  return rows.join('\n');
}

export function downloadExitPlanExport(
  exitType: ExitPlannerType,
  targetInputs: ExitPlannerTargetInputs,
  result: ExitPlanResult,
  warnings: StrategyWarning[],
  metadata: ServiceMetadata | null,
  portfolio: ApplicationPortfolio,
  format: 'json' | 'csv',
): void {
  const payload = buildExitPlanExportPayload(
    exitType,
    targetInputs,
    result,
    warnings,
    metadata,
    portfolio,
  );
  const content =
    format === 'json' ? buildExitPlanExportJson(payload) : buildExitPlanExportCsv(payload);
  const mimeType = format === 'json' ? 'application/json' : 'text/csv';

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `exit-plan-export.${format}`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

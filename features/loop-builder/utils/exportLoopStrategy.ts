import {
  type ApplicationPortfolio,
  deriveAaveV4EffectiveBorrowRate,
  type ExportProvenance,
  type LoopCostResult,
  type LoopStepRecord,
  type LoopStrategyPreview,
  type LoopStrategySettings,
  resolveExportProvenance,
  resolveRiskCapacityDisplay,
  resolveSupplyAprDisplay,
  type ServiceMetadata,
} from '@/services';
import type { ExecutionCostAssumptionsSettings } from '@/types/portfolio';
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
/**
 * "Supply APR" — V4 Readiness Audit §12 P1-1. Previously always the raw
 * `portfolio.protocol.supplyApr` scalar, exported as-is regardless of
 * protocol version. For a live V4 portfolio this can be a stale leftover
 * from before the portfolio became V4, never a real V4 value (no V4
 * boundary this codebase talks to exposes an authoritative supply rate at
 * all — see `resolveSupplyAprDisplay`'s own doc comment,
 * `services/portfolio/mapping.ts`). `null` (rendered as "Not available"
 * in CSV, literal `null` in JSON — this file's own existing convention)
 * rather than a stale/fabricated number.
 */
function resolveSupplyAprForExport(portfolio: ApplicationPortfolio): number | null {
  const display = resolveSupplyAprDisplay(portfolio);
  return display.kind === 'available' ? display.supplyApr : null;
}

function resolveProtocolParametersForExport(
  portfolio: ApplicationPortfolio,
): LoopStrategyExportPayload['assumptions']['protocolParameters'] {
  const riskCapacityDisplay = resolveRiskCapacityDisplay(portfolio);
  return {
    maxLoanToValue: riskCapacityDisplay.kind === 'v3' ? riskCapacityDisplay.maxLoanToValue : null,
    liquidationThreshold:
      riskCapacityDisplay.kind === 'v3' ? riskCapacityDisplay.liquidationThreshold : null,
    collateralFactor:
      riskCapacityDisplay.kind === 'v4Available' ? riskCapacityDisplay.collateralFactor : null,
    supplyApr: resolveSupplyAprForExport(portfolio),
    borrowApr: resolveBorrowAprForExport(portfolio),
  };
}

/**
 * Loop Strategy Export — 06_TASKS.md M7-018 ("Implement Loop Strategy
 * Export"). Dependencies: M7-010. Priority P2, Effort M. Description:
 * "Export loop strategy details." Formats: "JSON, CSV, Future PDF."
 * Include: "Inputs, Step-by-step outputs, Final outcome, Costs,
 * Warnings, Assumptions." DoD: "Exported strategies are reproducible."
 *
 * **Mirrors `features/simulation/utils/exportSimulation.ts` (M6-019)
 * closely** — same Blob + temporary-anchor download pattern, same
 * "Formats: JSON, CSV, Future PDF" deferral (no PDF library — 06_TASKS.md's
 * own explicit deferral marker), same "operates on the currently active
 * strategy, not a specific saved row" scope (a saved strategy can
 * already be reopened via `LoopStrategyLibrary.tsx`'s own Load button,
 * which restores it onto `currentResult` — from there it exports the
 * same way any freshly-computed strategy does).
 *
 * **"Inputs" → `settings` (the exact `LoopStrategySettings` the user
 * configured, unchanged). "Step-by-step outputs" → `strategy.steps`
 * (`LoopStepRecord[]`, already computed by `calculateLoopStrategy`,
 * M2-016) — never recalculated here. "Final outcome" → the strategy's
 * own `finalCollateral`/`finalDebt`/`finalEquity`/`finalLeverage`/
 * `finalHealthFactor`/`stopReason`, `null` when the strategy is not
 * viable (no final outcome exists to report). "Costs" → `costs`
 * (`LoopCostResult | null`) plus `monthlyInterestCost`/
 * `remainingBorrowCapacity`, the same three already-computed fields
 * `LoopCostAnalysis.tsx`/`LoopSafetyAnalysis.tsx` already display.
 * "Warnings" → the Store's own `warnings` (`StrategyWarning[]`,
 * `toStrategyWarning`, Batch 2) — a frozen snapshot at export time, the
 * same "export the display-ready values already computed, never a
 * second warning derivation" discipline this batch applies throughout.**
 *
 * **"Assumptions" → Protocol Parameters (read from the live `portfolio`
 * prop, the same source `SimulationExportPayload.assumptions` already
 * established) plus the portfolio's own configured
 * `executionCostAssumptions` (Conflict #8, resolved for real V4
 * Readiness Audit §12 P1-6 — each field independently `null` when not
 * configured; the real computed dollar figures live on `costs` above,
 * not duplicated here).**
 *
 * **"Timestamp"/"Formula version" → `metadata?.calculationTimestamp`/
 * `metadata`, the Store's own `lastMetadata` at export time** — `null`
 * shown as "Not captured," the same convention
 * `exportSimulation.ts` already established.
 *
 * **`csvEscape`/`csvRow` are duplicated locally, not imported
 * cross-feature from `features/simulation/`** — per the established
 * "each feature owns its own thin utility layer, isolated from
 * unrelated features" precedent (`components/strategy/format.ts`'s own
 * header comment already states this for formatting; the same
 * reasoning applies to this small a helper).
 *
 * **A non-viable strategy is still exportable — a real, reachable
 * path, not hypothetical.** `LoopStrategyExport.tsx`'s own empty-state
 * guard only checks `settings`/`currentResult` for `null`, not
 * `strategy`/`costs` — a user who configures an unsafe strategy (e.g.
 * one that fails `validateLoopStrategySafety`) can still reach the
 * Export section and export the resulting `findings`/`warnings` even
 * though `strategy`/`costs` are both `null`. Both builders below handle
 * this: `finalOutcome`/`costs` are `null`, steps are empty, and the CSV
 * builder shows "Not available" rather than omitting those rows
 * silently.
 */
/**
 * Bumped 0.1.0 → 0.2.0 for V4 Readiness Audit §12 P1-6: `assumptions.feesAndSlippage`
 * (a static "not included" note) is removed — `costs.items` now carries a
 * real computed dollar amount per item once configured, which made the
 * note actively misleading rather than merely incomplete — and
 * `assumptions.executionCostAssumptions` (the portfolio's own configured
 * values) is added.
 *
 * Bumped 0.2.0 → 0.3.0 for V4 Readiness Audit §12 P2-1: a new top-level
 * `provenance` field is added (`resolveExportProvenance`,
 * `services/shared/exportProvenance.ts`) — protocol version, manual/live
 * source, last successful live-refresh timestamp, and whether the
 * exported V4 data was stale/unknown at export time. Purely additive; no
 * existing field changed shape.
 */
export const LOOP_EXPORT_SCHEMA_VERSION = '0.3.0';

export interface LoopStrategyExportPayload {
  schemaVersion: string;
  inputs: LoopStrategySettings;
  stepResults: LoopStepRecord[];
  finalOutcome: {
    finalCollateral: number;
    finalDebt: number;
    finalEquity: number;
    finalLeverage: number;
    finalHealthFactor: number;
    stopReason: string;
  } | null;
  costs: LoopCostResult | null;
  monthlyInterestCost: number | null;
  remainingBorrowCapacity: number | null;
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
      /** V4 Readiness Audit §12 P1-1 — `resolveSupplyAprForExport`'s canonical value, `null` (never a stale/fabricated number) when unavailable for a V4 portfolio. */
      supplyApr: number | null;
      /** V4 Readiness Audit §12 Stage 22 — `resolveBorrowAprForExport`'s canonical value, `null` (never the legacy V3 scalar) when unavailable for a V4 portfolio. */
      borrowApr: number | null;
    };
    /**
     * V4 Readiness Audit §12 P1-6 — the portfolio's own CONFIGURED
     * assumptions (`Portfolio.settings.executionCostAssumptions`), each
     * independently `null` when not configured. Distinct from `costs`
     * above, which carries the COMPUTED dollar figures those assumptions
     * produce (or the explicit reason each stays unavailable).
     */
    executionCostAssumptions: {
      swapFeeRate: number | null;
      slippageRate: number | null;
      gasCostUsd: number | null;
    };
  };
  versions: { engineVersion: string; formulaVersion: string } | null;
  timestamp: string | null;
  /** V4 Readiness Audit §12 P2-1 — see `resolveExportProvenance`'s own header comment. */
  provenance: ExportProvenance;
}

export function buildLoopStrategyExportPayload(
  settings: LoopStrategySettings,
  result: LoopStrategyPreview,
  warnings: StrategyWarning[],
  metadata: ServiceMetadata | null,
  portfolio: ApplicationPortfolio,
  /** V4 Readiness Audit §12 P1-6 — the active portfolio's own `settings.executionCostAssumptions`; `ApplicationPortfolio` above carries no `settings`, so the caller (which holds the full `Portfolio`) supplies it separately. */
  executionCostAssumptions?: ExecutionCostAssumptionsSettings,
): LoopStrategyExportPayload {
  return {
    schemaVersion: LOOP_EXPORT_SCHEMA_VERSION,
    inputs: settings,
    stepResults: result.strategy?.steps ?? [],
    finalOutcome:
      result.strategy === null
        ? null
        : {
            finalCollateral: result.strategy.finalCollateral.quantity,
            finalDebt: result.strategy.finalDebt,
            finalEquity: result.strategy.finalEquity,
            finalLeverage: result.strategy.finalLeverage,
            finalHealthFactor: result.strategy.finalHealthFactor,
            stopReason: result.strategy.stopReason,
          },
    costs: result.costs,
    monthlyInterestCost: result.monthlyInterestCost,
    remainingBorrowCapacity: result.remainingBorrowCapacity,
    warnings,
    assumptions: {
      protocolParameters: resolveProtocolParametersForExport(portfolio),
      executionCostAssumptions: {
        swapFeeRate: executionCostAssumptions?.swapFeeRate ?? null,
        slippageRate: executionCostAssumptions?.slippageRate ?? null,
        gasCostUsd: executionCostAssumptions?.gasCostUsd ?? null,
      },
    },
    versions:
      metadata === null
        ? null
        : { engineVersion: metadata.engineVersion, formulaVersion: metadata.formulaVersion },
    timestamp: metadata?.calculationTimestamp ?? null,
    provenance: resolveExportProvenance(portfolio),
  };
}

export function buildLoopStrategyExportJson(payload: LoopStrategyExportPayload): string {
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

export function buildLoopStrategyExportCsv(payload: LoopStrategyExportPayload): string {
  const rows: string[] = ['Field,Value'];

  rows.push(csvRow('Schema Version', payload.schemaVersion));
  rows.push(csvRow('Target Borrow Percentage', payload.inputs.targetBorrowPercentage));
  rows.push(csvRow('Maximum Number of Loops', payload.inputs.maxLoops));
  rows.push(csvRow('Minimum Health Factor', payload.inputs.minHealthFactor));
  if (payload.inputs.maxLoanToValueOverride !== undefined) {
    // V4 semantic audit, Batch 2 (A1) — this override's own field name
    // (`maxLoanToValueOverride`) is a version-dispatched input for both
    // V3's Maximum LTV and V4's Collateral Factor (see
    // `resolveMaxLoanToValueAssumption`'s own doc comment); the exported
    // row label must say which one this portfolio's protocol version
    // actually means, not always "Max LTV." Deliberately not
    // `riskCapacityLabel` here — this CSV already has its own
    // abbreviation convention for V3 ("Max LTV", not "Maximum LTV",
    // matching the always-present "Max LTV" row a few lines below), so
    // this row matches that existing convention exactly rather than the
    // on-screen UI's longer form.
    const overrideLabel =
      payload.provenance.protocolVersion === 'v4' ? 'Collateral Factor' : 'Max LTV';
    rows.push(csvRow(`${overrideLabel} Override`, payload.inputs.maxLoanToValueOverride));
  }
  if (payload.inputs.borrowAprOverride !== undefined) {
    rows.push(csvRow('Borrow APR Override', payload.inputs.borrowAprOverride));
  }

  for (const step of payload.stepResults) {
    rows.push(csvRow(`Step ${step.stepNumber} Borrowed Amount`, step.borrowedAmount));
    rows.push(csvRow(`Step ${step.stepNumber} BTC Purchased`, step.btcPurchased));
    rows.push(csvRow(`Step ${step.stepNumber} Collateral After`, step.collateralAfter.quantity));
  }

  if (payload.finalOutcome !== null) {
    rows.push(csvRow('Final Collateral', payload.finalOutcome.finalCollateral));
    rows.push(csvRow('Final Debt', payload.finalOutcome.finalDebt));
    rows.push(csvRow('Final Equity', payload.finalOutcome.finalEquity));
    rows.push(csvRow('Final Leverage', payload.finalOutcome.finalLeverage));
    rows.push(csvRow('Final Health Factor', payload.finalOutcome.finalHealthFactor));
    rows.push(csvRow('Stop Reason', payload.finalOutcome.stopReason));
  } else {
    rows.push(csvRow('Final Outcome', 'Not available — the strategy is not viable.'));
  }

  if (payload.costs !== null) {
    rows.push(csvRow('Annual Interest Cost', payload.costs.borrowingInterest));
    rows.push(csvRow('Break-Even BTC Appreciation', payload.costs.breakEvenAppreciation));
    for (const item of payload.costs.items) {
      rows.push(
        csvRow(
          `Cost — ${item.item}`,
          item.amountUsd !== null ? item.amountUsd : (item.reason ?? ''),
        ),
      );
    }
  } else {
    rows.push(csvRow('Costs', 'Not available — the strategy is not viable.'));
  }
  rows.push(
    csvRow(
      'Monthly Interest Cost',
      payload.monthlyInterestCost !== null ? payload.monthlyInterestCost : 'Not available',
    ),
  );
  rows.push(
    csvRow(
      'Remaining Borrowing Capacity',
      payload.remainingBorrowCapacity !== null ? payload.remainingBorrowCapacity : 'Not available',
    ),
  );

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
      csvRow(
        'Liquidation Threshold',
        // Guaranteed non-null alongside maxLoanToValue — both are set
        // together for V3 by resolveProtocolParametersForExport above.
        payload.assumptions.protocolParameters.liquidationThreshold!,
      ),
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
  rows.push(
    csvRow('Supply APR', payload.assumptions.protocolParameters.supplyApr ?? 'Not available'),
  );
  rows.push(
    csvRow(
      'Swap Fee Assumption',
      payload.assumptions.executionCostAssumptions.swapFeeRate ?? 'Not configured',
    ),
  );
  rows.push(
    csvRow(
      'Slippage Assumption',
      payload.assumptions.executionCostAssumptions.slippageRate ?? 'Not configured',
    ),
  );
  rows.push(
    csvRow(
      'Gas Cost Assumption',
      payload.assumptions.executionCostAssumptions.gasCostUsd ?? 'Not configured',
    ),
  );

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

  rows.push(csvRow('Protocol Version', payload.provenance.protocolVersion));
  rows.push(
    csvRow('V4 Debt State Source', payload.provenance.v4DebtStateSource ?? 'Not available'),
  );
  rows.push(
    csvRow('V4 Debt State Updated At', payload.provenance.v4DebtStateUpdatedAt ?? 'Not available'),
  );
  rows.push(
    csvRow(
      'V4 Collateral Risk Source',
      payload.provenance.v4CollateralRiskSource ?? 'Not available',
    ),
  );
  rows.push(
    csvRow(
      'V4 Collateral Risk Updated At',
      payload.provenance.v4CollateralRiskUpdatedAt ?? 'Not available',
    ),
  );
  rows.push(
    csvRow(
      'V4 Data Stale At Export',
      payload.provenance.v4DataStaleAtExport === null
        ? 'Not available'
        : String(payload.provenance.v4DataStaleAtExport),
    ),
  );

  return rows.join('\n');
}

export function downloadLoopStrategyExport(
  settings: LoopStrategySettings,
  result: LoopStrategyPreview,
  warnings: StrategyWarning[],
  metadata: ServiceMetadata | null,
  portfolio: ApplicationPortfolio,
  format: 'json' | 'csv',
  /** V4 Readiness Audit §12 P1-6 — see `buildLoopStrategyExportPayload`'s identical trailing parameter. */
  executionCostAssumptions?: ExecutionCostAssumptionsSettings,
): void {
  const payload = buildLoopStrategyExportPayload(
    settings,
    result,
    warnings,
    metadata,
    portfolio,
    executionCostAssumptions,
  );
  const content =
    format === 'json' ? buildLoopStrategyExportJson(payload) : buildLoopStrategyExportCsv(payload);
  const mimeType = format === 'json' ? 'application/json' : 'text/csv';

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `loop-strategy-export.${format}`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

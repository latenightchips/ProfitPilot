import type {
  ApplicationPortfolio,
  LoopCostResult,
  LoopStepRecord,
  LoopStrategyPreview,
  LoopStrategySettings,
  ServiceMetadata,
} from '@/services';
import type { StrategyWarning } from '@/types/strategy';

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
 * established) plus the same documented Fees & Slippage Conflict #8
 * gap `LoopStrategySummary.tsx`'s own "Estimated Implementation Cost"
 * row already states — not fabricated here a second, differently-worded
 * way.**
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
export const LOOP_EXPORT_SCHEMA_VERSION = '0.1.0';

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
    protocolParameters: ApplicationPortfolio['protocol'];
    feesAndSlippage: string;
  };
  versions: { engineVersion: string; formulaVersion: string } | null;
  timestamp: string | null;
}

const FEES_AND_SLIPPAGE_NOTE =
  'Not included — no Formula ID or equation for swap fees, slippage, or gas estimation exists in 02_Formulas.md.';

export function buildLoopStrategyExportPayload(
  settings: LoopStrategySettings,
  result: LoopStrategyPreview,
  warnings: StrategyWarning[],
  metadata: ServiceMetadata | null,
  portfolio: ApplicationPortfolio,
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
      protocolParameters: portfolio.protocol,
      feesAndSlippage: FEES_AND_SLIPPAGE_NOTE,
    },
    versions:
      metadata === null
        ? null
        : { engineVersion: metadata.engineVersion, formulaVersion: metadata.formulaVersion },
    timestamp: metadata?.calculationTimestamp ?? null,
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
    rows.push(csvRow('Max LTV Override', payload.inputs.maxLoanToValueOverride));
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

  rows.push(csvRow('Max LTV', payload.assumptions.protocolParameters.maxLoanToValue));
  rows.push(
    csvRow('Liquidation Threshold', payload.assumptions.protocolParameters.liquidationThreshold),
  );
  rows.push(csvRow('Borrow APR (Protocol)', payload.assumptions.protocolParameters.borrowApr));
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

export function downloadLoopStrategyExport(
  settings: LoopStrategySettings,
  result: LoopStrategyPreview,
  warnings: StrategyWarning[],
  metadata: ServiceMetadata | null,
  portfolio: ApplicationPortfolio,
  format: 'json' | 'csv',
): void {
  const payload = buildLoopStrategyExportPayload(settings, result, warnings, metadata, portfolio);
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

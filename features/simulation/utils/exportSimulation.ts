import type {
  ApplicationPortfolio,
  PriceScenarioInput,
  ScenarioComparisonResult,
  ScenarioSummary,
  ServiceMetadata,
  SimulationResult,
  SimulationScenario,
} from '@/services';

/**
 * Simulation Export — 06_TASKS.md M6-019 ("Export Simulation").
 * Dependencies: M6-016. Priority P1, Effort M. Description: "Export
 * simulation results." Formats: "JSON, CSV, Future PDF." Include:
 * "Inputs, Outputs, Assumptions, Timestamp, Formula version." DoD:
 * "Exported simulations are reproducible." `03_UI.md`'s own "EXPORT"
 * section confirms the same shape: "Users may export Scenario Summary
 * — CSV, JSON, Future PDF. Exports include all simulation assumptions."
 *
 * **A genuinely different concept from `services/export/` (M3-001's own
 * scaffold), not a duplicate or a pre-empted task.** That directory's
 * own header comment names its eventual contents explicitly —
 * `ExportService.ts`/`JsonExporter.ts`/`CsvExporter.ts`/`PdfExporter.ts`
 * — and states its implementation is "a separate, dependent,
 * later-milestone task." Grepping `06_TASKS.md` confirms exactly which:
 * Milestone 8 owns "Create Export Service," "Implement Full JSON
 * Export," "Implement Single-Record JSON Export," "Implement CSV
 * Export," and "Implement Export File Naming" as their own dedicated,
 * later tasks — a full-application backup/restore system for every
 * persisted record. M6-019 is narrower and unrelated to that system: it
 * exports one Simulation's own already-computed result, the same
 * distinction `utils/portfolioRecoveryExport.ts` (M4-017) already drew
 * for its own narrower portfolio-recovery export ("This is not the
 * fuller Export Portfolio feature... a separate, unassigned task").
 * Building this inside `services/export/` now would be inventing
 * Milestone 8's own scope ahead of time; this file lives in the
 * Simulation feature instead, the same place `utils/
 * portfolioRecoveryExport.ts` lives at the top level for its own
 * narrower portfolio concern.
 *
 * **Reuses `utils/portfolioRecoveryExport.ts`'s own already-approved
 * Blob + temporary-anchor download pattern verbatim** — no new
 * dependency, no network request (Conflict B). `schemaVersion` is
 * included for the same reason that file's own header comment cites:
 * `01_PRD.md`'s "BACKUP & RECOVERY" section states "Every export should
 * include schema versioning," a cross-cutting rule, not specific to
 * recovery copies.
 *
 * **"Formats: JSON, CSV, Future PDF"** — only JSON/CSV are built here;
 * "Future" is 06_TASKS.md's own explicit deferral marker (the same
 * word `01_PRD.md`'s "BACKUP & RECOVERY" section uses for "Cloud
 * backup"/"Encrypted snapshots," never built either). No PDF library is
 * added.
 *
 * **"Inputs" → `scenario` (the exact `SimulationScenario` the user
 * configured); "Outputs" → `result.baseline`/`result.scenario`/
 * `result.comparison` (already-computed, never recalculated here,
 * matching `ScenarioComparison.tsx`'s own "without recalculation"
 * precedent).**
 *
 * **"Assumptions" → price/rate assumptions (from `result.assumptions`,
 * the same field `SimulationAssumptions.tsx` already reads) plus
 * Protocol Parameters, read from the live `portfolio` prop — the exact
 * same source and reasoning `SimulationAssumptions.tsx` (M6-013, Batch
 * 12) already established ("always shown, reading directly from the
 * portfolio.protocol prop... real, already-validated values, no Engine
 * call needed").** Whether the live portfolio has drifted from what was
 * true when a *saved* simulation was originally calculated is exactly
 * what `ScenarioComparison.tsx`'s own `driftNotice` (M6-016) already
 * surfaces before a user ever reaches Load — Export does not duplicate
 * that concern a second time. "Fees & Slippage" repeats the same
 * documented Conflict #8 gap those two components already state
 * verbatim, rather than fabricating a value.
 *
 * **"Timestamp"/"Formula version" → `metadata?.calculationTimestamp`/
 * `metadata`, the Store's own `lastMetadata` at export time.** For a
 * freshly-run scenario this is real and current; for a Loaded saved
 * scenario, `stores/simulationStore.ts`'s own `loadSavedScenario`
 * (Batch 18 change, see that file's header comment) restores the exact
 * metadata captured at the original save time, so a Load-then-Export
 * round trip reports the *original* Formula version honestly, not a
 * fabricated current one. `null` is shown as "not captured" rather than
 * a fabricated version string, for the one theoretical path where no
 * calculation metadata exists yet.
 *
 * **Export applies only to `currentScenario`/`currentResult` (price/
 * interest scenarios), not `portfolioActionPreview`** — the same scope
 * boundary `SaveSimulationForm.tsx` (M6-015) already drew for the exact
 * same reason: portfolio actions were never part of the
 * saved-scenario/comparison system this task's own Dependency
 * (M6-016, Load) builds on.
 *
 * **No formal file-naming convention is invented** — `06_TASKS.md`
 * names "Implement Export File Naming" as Milestone 8's own separate,
 * later task. Filenames here are simple and functional
 * (`simulation-export-<scenario-type>.<ext>`), not a designed scheme.
 *
 * **CSV shape**: a flat two-column `Field,Value` table — CSV cannot
 * represent the JSON export's nested structure, and 06_TASKS.md/
 * 03_UI.md do not specify a CSV layout, so this is a documented design
 * decision, not a specification conflict. Every leaf value from the
 * JSON payload appears as its own row, standard CSV quoting/escaping
 * applied to any value containing a comma, quote, or newline.
 */
export const SIMULATION_EXPORT_SCHEMA_VERSION = '0.1.0';

export interface SimulationExportPayload {
  schemaVersion: string;
  inputs: SimulationScenario;
  outputs: {
    baseline: ScenarioSummary;
    scenario: ScenarioSummary;
    comparison: ScenarioComparisonResult;
  };
  assumptions: {
    priceScenario: PriceScenarioInput;
    rateAssumption: { borrowApr: number; timeHorizonDays: number } | null;
    protocolParameters: ApplicationPortfolio['protocol'];
    feesAndSlippage: string;
  };
  timestamp: string | null;
  formulaVersion: { engineVersion: string; formulaVersion: string } | null;
}

const FEES_AND_SLIPPAGE_NOTE =
  'Not included — no Formula ID or equation for swap fees or slippage exists in 02_Formulas.md.';

export function buildSimulationExportPayload(
  scenario: SimulationScenario,
  result: SimulationResult,
  metadata: ServiceMetadata | null,
  portfolio: ApplicationPortfolio,
): SimulationExportPayload {
  return {
    schemaVersion: SIMULATION_EXPORT_SCHEMA_VERSION,
    inputs: scenario,
    outputs: {
      baseline: result.baseline,
      scenario: result.scenario,
      comparison: result.comparison,
    },
    assumptions: {
      priceScenario: result.assumptions.priceScenario,
      rateAssumption:
        result.assumptions.type === 'interest'
          ? {
              borrowApr: result.assumptions.borrowApr,
              timeHorizonDays: result.assumptions.timeHorizonDays,
            }
          : null,
      protocolParameters: portfolio.protocol,
      feesAndSlippage: FEES_AND_SLIPPAGE_NOTE,
    },
    timestamp: metadata?.calculationTimestamp ?? null,
    formulaVersion:
      metadata === null
        ? null
        : { engineVersion: metadata.engineVersion, formulaVersion: metadata.formulaVersion },
  };
}

export function buildSimulationExportJson(payload: SimulationExportPayload): string {
  return JSON.stringify(payload, null, 2);
}

export function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function csvRow(field: string, value: string | number): string {
  return `${csvEscape(field)},${csvEscape(String(value))}`;
}

export function buildSimulationExportCsv(payload: SimulationExportPayload): string {
  const rows: string[] = ['Field,Value'];

  rows.push(csvRow('Schema Version', payload.schemaVersion));
  rows.push(csvRow('Scenario Type', payload.inputs.type));
  rows.push(csvRow('Price Scenario Type', payload.assumptions.priceScenario.type));
  rows.push(
    payload.assumptions.priceScenario.type === 'absolute'
      ? csvRow('BTC Price (USD)', payload.assumptions.priceScenario.btcPriceUsd)
      : csvRow('Percentage Change', payload.assumptions.priceScenario.percentageChange),
  );
  if (payload.assumptions.rateAssumption !== null) {
    rows.push(csvRow('Rate Assumption Borrow APR', payload.assumptions.rateAssumption.borrowApr));
    rows.push(
      csvRow(
        'Rate Assumption Time Horizon (days)',
        payload.assumptions.rateAssumption.timeHorizonDays,
      ),
    );
  }

  for (const [label, summary] of [
    ['Baseline', payload.outputs.baseline],
    ['Scenario', payload.outputs.scenario],
  ] as const) {
    rows.push(csvRow(`${label} Equity`, summary.equity));
    rows.push(csvRow(`${label} Health Factor`, summary.healthFactor));
    rows.push(csvRow(`${label} Liquidation Distance`, summary.liquidationDistance));
    rows.push(csvRow(`${label} Debt Cost`, summary.debtCost));
    rows.push(csvRow(`${label} Leverage`, summary.leverage));
    rows.push(csvRow(`${label} Profit/Loss`, summary.profitOrLoss));
  }

  for (const difference of payload.outputs.comparison.differences) {
    rows.push(csvRow(`Difference (${difference.metric})`, difference.difference));
  }

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
      payload.formulaVersion !== null ? payload.formulaVersion.engineVersion : 'Not captured',
    ),
  );
  rows.push(
    csvRow(
      'Formula Version',
      payload.formulaVersion !== null ? payload.formulaVersion.formulaVersion : 'Not captured',
    ),
  );

  return rows.join('\n');
}

/**
 * Triggers a browser download of a simulation export — the exact
 * Blob + temporary-anchor pattern `utils/portfolioRecoveryExport.ts`'s
 * own `downloadPortfolioRecoveryCopy` (M4-017) already established.
 */
export function downloadSimulationExport(
  scenario: SimulationScenario,
  result: SimulationResult,
  metadata: ServiceMetadata | null,
  portfolio: ApplicationPortfolio,
  format: 'json' | 'csv',
): void {
  const payload = buildSimulationExportPayload(scenario, result, metadata, portfolio);
  const content =
    format === 'json' ? buildSimulationExportJson(payload) : buildSimulationExportCsv(payload);
  const mimeType = format === 'json' ? 'application/json' : 'text/csv';

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `simulation-export-${scenario.type}.${format}`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

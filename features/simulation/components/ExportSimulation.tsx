'use client';

import type { ApplicationPortfolio } from '@/services';
import { useSimulationStore } from '@/stores/simulationStore';

import { downloadSimulationExport } from '../utils/exportSimulation';

/**
 * Export Simulation — 06_TASKS.md M6-019 ("Export Simulation"). See
 * `../utils/exportSimulation.ts`'s own header comment for the full
 * scope reasoning (why this is not `services/export/`, format/field
 * mapping, CSV shape). This component only wires that file's pure
 * builder/download functions to two buttons.
 *
 * **Operates on `currentScenario`/`currentResult` (the currently active
 * price/interest scenario), not a specific saved row in
 * `ScenarioComparison.tsx`.** `03_UI.md`'s own "EXPORT" section names
 * "Scenario Summary" as what gets exported — the same result
 * `ScenarioSummary.tsx` (M6-009) already renders for whichever scenario
 * is currently active, saved or not. This also explains M6-019's own
 * Dependency on M6-016 ("Load Saved Simulation") without requiring a
 * second, saved-row-specific export implementation: a user exporting an
 * *old* saved simulation first clicks "Load" (M6-016, already real)
 * to bring it back into `currentScenario`/`currentResult`, then uses
 * these same Export controls — `loadSavedScenario` restoring the exact
 * original `metadata` (Batch 18 Store change) means that round trip
 * still exports the *original* Formula version/timestamp, not a
 * fabricated current one.
 */
export function ExportSimulation({ portfolio }: { portfolio: ApplicationPortfolio }) {
  const currentScenario = useSimulationStore((state) => state.currentScenario);
  const currentResult = useSimulationStore((state) => state.currentResult);
  const lastMetadata = useSimulationStore((state) => state.lastMetadata);

  if (currentScenario === null || currentResult === null) {
    return (
      <p className="text-sm text-muted-foreground">
        Run a price or interest scenario to export it.
      </p>
    );
  }

  function handleExport(format: 'json' | 'csv') {
    if (currentScenario === null || currentResult === null) return;
    downloadSimulationExport(currentScenario, currentResult, lastMetadata, portfolio, format);
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => handleExport('json')}
        className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/40"
      >
        Export JSON
      </button>
      <button
        type="button"
        onClick={() => handleExport('csv')}
        className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/40"
      >
        Export CSV
      </button>
    </div>
  );
}

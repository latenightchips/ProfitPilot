'use client';

import type { ApplicationPortfolio } from '@/services';
import { useExitPlannerStore } from '@/stores/exitPlannerStore';
import type { ExecutionCostAssumptionsSettings } from '@/types/portfolio';

import { downloadExitPlanExport } from '../utils/exportExitPlan';

/**
 * Exit Plan Export — 06_TASKS.md M7-030. See
 * `../utils/exportExitPlan.ts`'s own header comment for the full scope
 * reasoning (why this is not `services/export/`, format/field mapping,
 * CSV shape, the reachable infeasible-plan export path). This
 * component only wires that file's pure builder/download functions to
 * two buttons.
 *
 * **Operates on `exitType`/`targetInputs`/`currentResult` (the
 * currently active plan), not a specific saved row in
 * `ExitPlanLibrary.tsx`** — the same "Load first, then Export the
 * now-current plan" relationship `LoopStrategyExport.tsx` (M7-018)
 * already established for its own equivalent Load dependency:
 * `loadExitPlan` (M7-029) restores the exact original
 * `warnings`/`metadata`, so a Load-then-Export round trip still
 * reports the original Formula version/timestamp.
 */
export function ExitPlanExport({
  portfolio,
  executionCostAssumptions,
}: {
  portfolio: ApplicationPortfolio;
  /** The active portfolio's own `settings.executionCostAssumptions` (V4 Readiness Audit §12 P1-6). */
  executionCostAssumptions?: ExecutionCostAssumptionsSettings;
}) {
  const exitType = useExitPlannerStore((state) => state.exitType);
  const targetInputs = useExitPlannerStore((state) => state.targetInputs);
  const currentResult = useExitPlannerStore((state) => state.currentResult);
  const warnings = useExitPlannerStore((state) => state.warnings);
  const lastMetadata = useExitPlannerStore((state) => state.lastMetadata);

  if (exitType === null || currentResult === null) {
    return <p className="text-sm text-muted-foreground">Configure an exit plan to export it.</p>;
  }

  function handleExport(format: 'json' | 'csv') {
    if (exitType === null || currentResult === null) return;
    downloadExitPlanExport(
      exitType,
      targetInputs ?? {},
      currentResult,
      warnings,
      lastMetadata,
      portfolio,
      format,
      executionCostAssumptions,
    );
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

'use client';

import type { ApplicationPortfolio } from '@/services';
import { useLoopBuilderStore } from '@/stores/loopBuilderStore';
import type { ExecutionCostAssumptionsSettings } from '@/types/portfolio';

import { downloadLoopStrategyExport } from '../utils/exportLoopStrategy';

/**
 * Loop Strategy Export — 06_TASKS.md M7-018 ("Implement Loop Strategy
 * Export"). See `../utils/exportLoopStrategy.ts`'s own header comment
 * for the full scope reasoning (why this is not `services/export/`,
 * format/field mapping, CSV shape, the reachable non-viable-strategy
 * export path). This component only wires that file's pure
 * builder/download functions to two buttons.
 *
 * **Operates on `settings`/`currentResult` (the currently active
 * strategy), not a specific saved row in `LoopStrategyLibrary.tsx`** —
 * the same "Load first, then Export the now-current strategy"
 * relationship `ExportSimulation.tsx` (M6-019) already established for
 * its own equivalent Load dependency: `loadStrategy` (M7-017, this same
 * batch) restores the exact original `warnings`/`metadata`, so a
 * Load-then-Export round trip still reports the original Formula
 * version/timestamp, not a fabricated current one.
 *
 * **Deliberately does not additionally guard on `strategy`/`costs`
 * being non-null** — a configured-but-non-viable strategy is a real,
 * exportable state (see `exportLoopStrategy.ts`'s own header comment),
 * not an error condition this component should hide behind its own
 * empty-state message.
 */
export function LoopStrategyExport({
  portfolio,
  executionCostAssumptions,
}: {
  portfolio: ApplicationPortfolio;
  /** The active portfolio's own `settings.executionCostAssumptions` (V4 Readiness Audit §12 P1-6). */
  executionCostAssumptions?: ExecutionCostAssumptionsSettings;
}) {
  const settings = useLoopBuilderStore((state) => state.settings);
  const currentResult = useLoopBuilderStore((state) => state.currentResult);
  const warnings = useLoopBuilderStore((state) => state.warnings);
  const lastMetadata = useLoopBuilderStore((state) => state.lastMetadata);

  if (settings === null || currentResult === null) {
    return <p className="text-sm text-muted-foreground">Configure a strategy to export it.</p>;
  }

  function handleExport(format: 'json' | 'csv') {
    if (settings === null || currentResult === null) return;
    downloadLoopStrategyExport(
      settings,
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

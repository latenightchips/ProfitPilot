'use client';

import type { ApplicationPortfolio } from '@/services';
import type { LoopStrategySettings } from '@/services/loop/strategy';
import { useLoopBuilderStore } from '@/stores/loopBuilderStore';

/**
 * Loop Presets — 06_TASKS.md M7-009 ("Implement Loop Presets").
 * Dependencies: M7-008. Priority P2, Effort S. Requirements: "Presets
 * must expose their assumptions. Presets must not be described as
 * guaranteed-safe strategies." DoD: "Selecting a preset updates
 * editable controls without hiding any input."
 *
 * **3 fixed presets, values chosen as reasonable, clearly-labeled
 * starting points — not derived from any documented formula**, since
 * no task or spec document names concrete preset values (the same
 * "no documented preset values exist" gap Conflict #24 already found
 * for Portfolio's own protocol presets, Milestone 4). Each button's own
 * visible text states its exact loop count and minimum Health Factor,
 * satisfying "expose their assumptions" directly rather than requiring
 * a user to guess or open a details panel.
 *
 * **"Custom" is not a 4th preset button** — a preset that sets specific
 * values is definitionally not custom. It is an implicit label, shown
 * whenever the Store's current `settings` don't exactly match any of
 * the 3 real presets (including on initial load, before any preset or
 * manual edit).
 *
 * **DoD ("updates editable controls without hiding any input") — a
 * real bug found via mandatory manual browser verification, not a
 * hypothetical.** See `LoopStrategyControls.tsx`'s own header comment
 * for the fix (a resync `useEffect` there, driven by this component
 * calling `setSettings` directly).
 *
 * **`borrowRateAssumption` — V4 Readiness Audit §12 Stage 17 audit
 * finding, no code change needed in this file itself.** This component
 * never reads `portfolio.protocol.borrowApr` directly — `presetSettings`
 * bakes whatever `borrowRateAssumption` its caller supplies straight into
 * `borrowAprOverride`, unconditionally (correct for a preset: unlike
 * `LoopStrategyControls.tsx`'s own incremental field edits, a preset
 * click always sets a complete, concrete `LoopStrategySettings`, so there
 * is no partial-edit "was this ever established" question to preserve
 * here). The actual fix — using the canonical V4 effective borrow rate
 * instead of the raw legacy scalar for a V4 portfolio — lives entirely at
 * the one place that computes this prop's value:
 * `app/loop-builder/LoopBuilderPageClient.tsx`'s own `resolveBorrowRateAssumption`
 * call.
 */
export interface LoopPreset {
  name: string;
  maxLoops: number;
  minHealthFactor: number;
  borrowPercentagePerStep: number;
}

const PRESETS: LoopPreset[] = [
  { name: 'Conservative', maxLoops: 2, minHealthFactor: 2.2, borrowPercentagePerStep: 0.3 },
  { name: 'Balanced', maxLoops: 3, minHealthFactor: 1.8, borrowPercentagePerStep: 0.5 },
  { name: 'Aggressive', maxLoops: 5, minHealthFactor: 1.5, borrowPercentagePerStep: 0.7 },
];

function presetSettings(
  preset: LoopPreset,
  maxLoanToValue: number,
  borrowRateAssumption: number,
): LoopStrategySettings {
  return {
    targetBorrowPercentage: preset.borrowPercentagePerStep,
    maxLoops: preset.maxLoops,
    minHealthFactor: preset.minHealthFactor,
    maxLoanToValueOverride: maxLoanToValue,
    borrowAprOverride: borrowRateAssumption,
  };
}

function matchesPreset(
  settings: LoopStrategySettings | null,
  preset: LoopPreset,
  maxLoanToValue: number,
  borrowRateAssumption: number,
): boolean {
  if (settings === null) return false;
  const expected = presetSettings(preset, maxLoanToValue, borrowRateAssumption);
  return (
    settings.targetBorrowPercentage === expected.targetBorrowPercentage &&
    settings.maxLoops === expected.maxLoops &&
    settings.minHealthFactor === expected.minHealthFactor &&
    settings.maxLoanToValueOverride === expected.maxLoanToValueOverride &&
    settings.borrowAprOverride === expected.borrowAprOverride
  );
}

export function LoopPresets({
  portfolio,
  maxLoanToValue,
  borrowRateAssumption,
}: {
  portfolio: ApplicationPortfolio;
  maxLoanToValue: number;
  borrowRateAssumption: number;
}) {
  const settings = useLoopBuilderStore((state) => state.settings);
  const setSettings = useLoopBuilderStore((state) => state.setSettings);
  const runLoopStrategy = useLoopBuilderStore((state) => state.runLoopStrategy);

  const activePreset = PRESETS.find((preset) =>
    matchesPreset(settings, preset, maxLoanToValue, borrowRateAssumption),
  );

  function applyPreset(preset: LoopPreset) {
    setSettings(presetSettings(preset, maxLoanToValue, borrowRateAssumption));
    runLoopStrategy(portfolio);
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-foreground">
        Strategy Presets —{' '}
        <span className="text-xs text-muted-foreground">{activePreset?.name ?? 'Custom'}</span>
      </h3>
      <div className="flex flex-col gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.name}
            type="button"
            onClick={() => applyPreset(preset)}
            className="flex flex-col items-start gap-0.5 rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-accent/40"
          >
            <span className="font-medium text-foreground">{preset.name}</span>
            <span className="text-xs text-muted-foreground">
              {preset.maxLoops} loops · min HF {preset.minHealthFactor.toFixed(2)}
            </span>
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Presets are starting points, not guaranteed-safe strategies — review the Safety Analysis
        before committing to a strategy.
      </p>
    </div>
  );
}

'use client';

import {
  type AaveV4DebtState,
  deriveAaveV4EffectiveBorrowRate,
  type SimulationResult,
} from '@/services';
import { useSimulationStore } from '@/stores/simulationStore';
import type { Portfolio } from '@/types/portfolio';

import { buildSimulationWarnings } from '../utils/buildSimulationWarnings';
import { resolveEffectiveBorrowRate } from '../utils/resolveEffectiveBorrowRate';

/**
 * Simulation Warnings — 06_TASKS.md M6-014 ("Implement Simulation
 * Warnings"). Dependencies: M6-009. DoD: "Warnings explain both the
 * cause and potential impact." Names no `Requirements` section, the
 * same as M6-012/M6-013.
 *
 * **Takes `portfolio: Portfolio`, not `ApplicationPortfolio`** — unlike
 * every other Simulation component, this one needs
 * `settings.safetyTargets?.targetHealthFactor` and `marketUpdatedAt`,
 * both fields `Portfolio` (`@/types/portfolio`, M4-001) adds on top of
 * `ApplicationPortfolio`. `app/simulation/page.tsx` already holds the
 * full `Portfolio` record (`record.portfolio`); every other Simulation
 * component simply never needed the extra fields.
 *
 * **Renders whenever either simulation result exists** — the same gate
 * `SimulationAssumptions.tsx` (Batch 12) uses — computing whichever
 * simulated Health Factor/equity/leverage is active (`currentResult.scenario`
 * or `portfolioActionPreview.after`) and handing them to
 * `buildSimulationWarnings`, which does the real work. See that file's
 * own header comment, and `../types/simulationWarnings.ts`, for the
 * full "7 built, 1 blocked" reasoning.
 *
 * **Borrow APR/Holding Period are read from `currentResult.assumptions`
 * only when it is an active `type: 'interest'` scenario** — the only
 * case with either concept at all (a `type: 'price'` scenario's own
 * `SimulationScenario` variant has no `timeHorizonDays`/`borrowApr`
 * field; neither does a Portfolio Action). Borrow APR still falls back
 * to the portfolio's own real, currently configured rate otherwise, so
 * "High borrowing cost" stays checkable for every simulation kind; a
 * long Holding Period has no meaning outside an interest scenario, so
 * that check is simply skipped (`timeHorizonDays: null`) for every other
 * kind.
 *
 * **`resolveSimulatedBorrowApr` — V4 Readiness Audit §12 Stage 20.**
 * Previously fell back to `portfolio.protocol.borrowApr` unconditionally
 * for a non-interest result — a legacy V3 scalar wrong for V4 — and, for
 * an active V4 interest scenario, echoed `currentResult.assumptions.borrowApr`,
 * a field V4's own accrual model never reads at all (`resolveScenarioInputs.ts`'s
 * own header comment). Now protocol-version-dispatched: V3 keeps both
 * cases exactly as before. V4 with no active interest scenario uses the
 * real, canonical effective rate (`resolveEffectiveBorrowRate`). V4 with
 * an active interest scenario recomputes the canonical BLENDED effective
 * rate from whichever rates the scenario actually used —
 * `currentResult.assumptions.v4RateStress`, when the user genuinely
 * established one (`ScenarioBuilder.tsx`'s own established-field
 * tracking), else the portfolio's real unstressed rates — never the raw
 * `v4RateStress.baseDrawnApr` directly, which is a different quantity
 * from "the effective rate" this warning check needs (see
 * `resolveEffectiveBorrowRate.ts`'s own header comment for why the two
 * must never be conflated: `riskPremium` is applied on top of
 * `baseDrawnApr` by the Engine, not already blended into it).
 *
 * **A zero-warnings result is shown as positive confirmation text, not
 * rendered as nothing** — the same "always-visible section" convention
 * every other Simulation component already follows (`ScenarioSummary`,
 * `ScenarioComparison`, `ScenarioCharts`, `ScenarioTimeline`,
 * `SimulationAssumptions`), unlike `RiskWarningBanner.tsx`
 * (`features/dashboard/`, M5-010), which renders `null` on zero
 * warnings since it is a floating banner, not a fixed page section.
 */
function resolveSimulatedBorrowApr(
  portfolio: Portfolio,
  currentResult: SimulationResult | null,
): number | null {
  if (currentResult?.assumptions.type !== 'interest') {
    return resolveEffectiveBorrowRate(portfolio);
  }
  if (portfolio.protocolVersion !== 'v4') {
    return currentResult.assumptions.borrowApr;
  }
  if (portfolio.v4DebtState === undefined) return null;

  const stressedV4DebtState: AaveV4DebtState = {
    drawnDebt: portfolio.v4DebtState.drawnDebt,
    premiumDebt: portfolio.v4DebtState.premiumDebt,
    baseDrawnApr:
      currentResult.assumptions.v4RateStress?.baseDrawnApr ?? portfolio.v4DebtState.baseDrawnApr,
    riskPremium:
      currentResult.assumptions.v4RateStress?.riskPremium ?? portfolio.v4DebtState.riskPremium,
  };
  const rateStep = deriveAaveV4EffectiveBorrowRate(stressedV4DebtState, null, 'manual');
  return rateStep.ok ? rateStep.value : null;
}

export function SimulationWarnings({ portfolio }: { portfolio: Portfolio }) {
  const currentResult = useSimulationStore((state) => state.currentResult);
  const portfolioActionPreview = useSimulationStore((state) => state.portfolioActionPreview);

  if (currentResult === null && portfolioActionPreview === null) {
    return <p className="text-sm text-muted-foreground">Run a simulation to see any warnings.</p>;
  }

  const simulatedHealthFactor =
    currentResult?.scenario.healthFactor ?? portfolioActionPreview?.after.healthFactor ?? null;
  const simulatedEquity =
    currentResult?.scenario.equity ?? portfolioActionPreview?.after.netEquity ?? null;
  const simulatedLeverage =
    currentResult?.scenario.leverage ?? portfolioActionPreview?.after.leverage ?? null;
  const simulatedBorrowApr = resolveSimulatedBorrowApr(portfolio, currentResult);
  const simulatedTimeHorizonDays =
    currentResult?.assumptions.type === 'interest'
      ? currentResult.assumptions.timeHorizonDays
      : null;
  const warnings = buildSimulationWarnings(portfolio, {
    healthFactor: simulatedHealthFactor,
    equity: simulatedEquity,
    leverage: simulatedLeverage,
    borrowApr: simulatedBorrowApr,
    timeHorizonDays: simulatedTimeHorizonDays,
  });

  return (
    <div className="flex flex-col gap-3 text-sm">
      {warnings.length === 0 ? (
        <p className="text-muted-foreground">No warnings for this simulation.</p>
      ) : (
        warnings.map((warning) => (
          <div
            key={warning.code}
            role="alert"
            className="flex flex-col gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 p-3"
          >
            <p className="text-foreground">{warning.reason}</p>
            <p className="text-muted-foreground">{warning.potentialImpact}</p>
          </div>
        ))
      )}
      <p className="text-xs text-muted-foreground">
        Invalid assumptions aren&rsquo;t checked here — the Scenario Builder&rsquo;s own validation
        already rejects invalid input before a simulation runs.
      </p>
    </div>
  );
}

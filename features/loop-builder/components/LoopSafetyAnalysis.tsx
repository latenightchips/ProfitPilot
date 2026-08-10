'use client';

import { formatCurrency, formatHealthFactor, formatPercent } from '@/components/strategy/format';
import {
  type ApplicationPortfolio,
  buildFinalLoopPortfolio,
  calculatePortfolioSummary,
} from '@/services';
import { useLoopBuilderStore } from '@/stores/loopBuilderStore';

import { stopReasonLabel } from '../utils/stopReasonLabel';

/**
 * Loop Safety Analysis — 06_TASKS.md M7-013 ("Implement Loop Safety
 * Analysis"). Dependencies: M7-010, M7-005. Priority P0, Effort L.
 * Description: "Create a dedicated safety section." Display: "Minimum
 * Health Factor reached, Distance to liquidation, Maximum LTV reached,
 * Remaining borrowing capacity, Configured safety limits, Stop
 * condition, Risk classification." DoD: "Unsafe or constrained
 * strategies are clearly explained."
 *
 * **6 of the 7 named Display items map directly to already-real,
 * already-computed data — zero new Formula Engine logic.**
 * "Minimum Health Factor reached"/"Maximum LTV reached" read directly
 * from `currentResult.findings` (`LoopSafetyFinding[]`,
 * `validateLoopStrategySafety`, M2-018) for the matching `check` value —
 * the same array `stores/loopBuilderStore.ts`'s own `toStrategyWarning`
 * already maps into `warnings`, read here a second, more specific way
 * for a per-check yes/no rather than a generic warning list.
 * "Remaining borrowing capacity" reads `currentResult.remainingBorrowCapacity`
 * (added this same batch — see `services/loop/strategy.ts`'s own header
 * comment). "Configured safety limits" is a direct, no-calculation
 * display of the Store's own `settings` (the exact values the user
 * configured via `LoopStrategyControls.tsx`, M7-008). "Stop condition"
 * reuses the shared `stopReasonLabel` util (extracted this batch from
 * `LoopStrategySummary.tsx`).
 *
 * **"Distance to liquidation" reuses `buildFinalLoopPortfolio` +
 * `calculatePortfolioSummary` (M3-005)** — the exact same "snapshot,
 * apply the computed change, calculate again" call `LoopStrategySummary.tsx`
 * already makes for its own "after" column, called here a second time for
 * this component's own narrower need (`PortfolioLiquidationSummary.distance`
 * only, not a full comparison table). This is not a duplicated
 * calculation: the calculation itself lives in exactly one place
 * (`calculatePortfolioSummary`/`calculateLiquidationPrice`,
 * `engine/health`); two call sites invoking the same pure Service
 * function with the same derived input is the same reuse pattern
 * `calculatePortfolioSummary` already has multiple call sites for
 * elsewhere in this codebase (`app/portfolio/page.tsx`,
 * `services/simulation/scenario.ts`, `services/exit/plan.ts`).
 *
 * **"Risk classification" is deliberately left unbuilt, not
 * fabricated.** This is the exact same specification conflict already
 * documented as Conflict #1 in `PROJECT_STATUS.md` ("Health Factor
 * risk-band thresholds disagree across four documents"), which already
 * formally blocks M5-008 in Milestone 5 — inventing a discrete Safe/
 * Moderate/High/Critical banding here would resolve, for Loop Builder
 * only, a conflict this engagement has consistently left open
 * everywhere else. Rendered as an explicit, labeled "Not available"
 * note citing the conflict, the same honest-gap convention M5-008's own
 * Dashboard card already established, not a silently missing row.
 */
function findingActive(
  findings: { check: string }[],
  check: 'MINIMUM_HEALTH_FACTOR' | 'MAXIMUM_LTV',
): boolean {
  return findings.some((finding) => finding.check === check);
}

export function LoopSafetyAnalysis({ portfolio }: { portfolio: ApplicationPortfolio }) {
  const currentResult = useLoopBuilderStore((state) => state.currentResult);
  const settings = useLoopBuilderStore((state) => state.settings);

  if (currentResult === null || settings === null) {
    return (
      <p className="text-sm text-muted-foreground">
        Configure a strategy to see its safety analysis.
      </p>
    );
  }

  let liquidationDistance: number | null = null;
  if (currentResult.strategy !== null) {
    const finalPortfolio = buildFinalLoopPortfolio(portfolio, currentResult.strategy);
    const afterSummary = calculatePortfolioSummary(finalPortfolio, 'manual');
    if (afterSummary.ok) {
      liquidationDistance = afterSummary.data.liquidation?.distance ?? null;
    }
  }

  const minHealthFactorReached = findingActive(currentResult.findings, 'MINIMUM_HEALTH_FACTOR');
  const maximumLtvReached = findingActive(currentResult.findings, 'MAXIMUM_LTV');

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Minimum Health Factor Reached</span>
        <span
          className={`font-medium ${minHealthFactorReached ? 'text-destructive' : 'text-foreground'}`}
        >
          {minHealthFactorReached ? 'Yes' : 'No'}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Maximum LTV Reached</span>
        <span
          className={`font-medium ${maximumLtvReached ? 'text-destructive' : 'text-foreground'}`}
        >
          {maximumLtvReached ? 'Yes' : 'No'}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Distance to Liquidation</span>
        <span className="font-medium text-foreground">
          {liquidationDistance !== null ? formatPercent(liquidationDistance) : '—'}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Remaining Borrowing Capacity</span>
        <span className="font-medium text-foreground">
          {currentResult.remainingBorrowCapacity !== null
            ? formatCurrency(currentResult.remainingBorrowCapacity)
            : '—'}
        </span>
      </div>

      <div className="flex flex-col gap-1 border-t border-border pt-2">
        <span className="text-muted-foreground">Configured Safety Limits</span>
        <dl className="flex flex-col gap-0.5 text-xs">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Borrow Percentage Per Step</dt>
            <dd className="text-foreground">{formatPercent(settings.targetBorrowPercentage)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Maximum Number of Loops</dt>
            <dd className="text-foreground">{settings.maxLoops}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Minimum Health Factor</dt>
            <dd className="text-foreground">{formatHealthFactor(settings.minHealthFactor)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Maximum LTV</dt>
            <dd className="text-foreground">
              {formatPercent(settings.maxLoanToValueOverride ?? portfolio.protocol.maxLoanToValue)}
            </dd>
          </div>
        </dl>
      </div>

      {currentResult.strategy !== null && (
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Stop Condition</span>
          <span className="font-medium text-foreground">
            {stopReasonLabel(currentResult.strategy.stopReason)}
          </span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Risk Classification</span>
        <span className="text-xs text-muted-foreground">
          Not shown — there&apos;s no single agreed-upon set of Health Factor risk bands (e.g.
          &ldquo;Safe&rdquo;/&ldquo;Moderate&rdquo;/&ldquo;High risk&rdquo;) to classify against.
          Use the Health Factor number itself and the Minimum Health Factor you set above.
        </span>
      </div>
    </div>
  );
}

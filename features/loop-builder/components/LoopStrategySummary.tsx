'use client';

import { formatCurrency } from '@/components/strategy/format';
import { StrategyComparison } from '@/components/strategy/StrategyComparison';
import {
  type ApplicationPortfolio,
  buildFinalLoopPortfolio,
  calculatePortfolioExposure,
  calculatePortfolioSummary,
  loopIntroducesAmbiguousV4Borrow,
  V4_LOOP_BORROW_RISK_PREMIUM_UNKNOWN_MESSAGE,
} from '@/services';
import { useLoopBuilderStore } from '@/stores/loopBuilderStore';
import type { StrategyComparisonResult } from '@/types/strategy';

import { stopReasonLabel } from '../utils/stopReasonLabel';

/**
 * Loop Strategy Summary — 06_TASKS.md M7-011 ("Implement Loop Strategy
 * Summary"). Dependencies: M7-010. Priority P0, Effort M. Include:
 * "Final collateral, Final debt, Net equity, Health Factor, LTV,
 * Leverage, BTC exposure, Annual interest cost, Estimated
 * implementation cost, Stop reason." DoD: "The summary clearly
 * distinguishes current and proposed portfolio states."
 *
 * **7 of the 10 named Include items are satisfied by the shared
 * `StrategyComparison` (M7-003, Batch 1) — the exact component that
 * task's own DoD says must "support Loop Builder and Exit Planner
 * results."** Final collateral/debt/Net equity/Health Factor/LTV/
 * Leverage/BTC exposure map directly to 7 of that component's own 9
 * metrics; its DoD ("clearly distinguishes current and proposed
 * portfolio states" via explicit "Current"/"Proposed" columns)
 * satisfies M7-011's own DoD verbatim, not coincidentally — reusing it
 * here is exactly why it was built shared in Batch 1.
 *
 * **The "before" (current) baseline is computed here, not by
 * `planLoopStrategy` (M3-010)** — that Service never computes a
 * starting-state summary (`services/loop/strategy.ts`'s own
 * `LoopStrategyPreview` has no `before` field, unlike
 * `ExitPlanResult`). `calculatePortfolioSummary`/`calculatePortfolioExposure`
 * (both Services, not Engine functions) are called directly on the
 * unmodified active portfolio — the same direct-Service-call-from-a-
 * route precedent `app/portfolio/page.tsx` already established, not a
 * new pattern.
 *
 * **The "after" (proposed) baseline is also computed here, via a second
 * `calculatePortfolioSummary` call on a constructed final-state
 * portfolio** — `LoopStrategyResult` itself only returns
 * `finalCollateral`/`finalDebt`/`finalEquity`/`finalHealthFactor`/
 * `finalLeverage`, not a full `PortfolioSummary` (no liquidation price,
 * no re-derived collateral/debt *value*). Recomputing collateral value
 * from `finalCollateral.quantity × market.btcPriceUsd` here in the UI
 * layer would be re-deriving F-002 a second time (forbidden — the same
 * "duplicated calculation" `ScenarioBuilder.tsx`'s own header comment
 * already avoids for F-051). Instead, a plain `ApplicationPortfolio`
 * representing the strategy's own final collateral/debt is constructed
 * and passed through `calculatePortfolioSummary` again — the exact same
 * "snapshot, apply the computed change, calculate again" pattern
 * `services/exit/plan.ts`'s own internal `before`/`after` computation
 * already uses for Exit Planner, just performed one layer up since
 * Loop's own Service does not do this internally.
 *
 * **"Annual interest cost" and "Estimated implementation cost" are two
 * separate rows, not one** — `currentResult.costs.borrowingInterest`
 * (F-032, a real computed number) satisfies "Annual interest cost";
 * "Estimated implementation cost" reads `costs.items`'s own
 * `totalImplementationCost` entry (conflict #8, resolved for real V4
 * Readiness Audit §12 P1-6) — a real computed dollar figure once the
 * portfolio has swap fee/slippage/gas all configured, and honestly
 * itemized as unavailable (with the Engine's own reason) otherwise,
 * never fabricated either way.
 *
 * **"Stop reason" is a human-readable label for
 * `LoopStrategyResult.stopReason`** (`LoopStopReason`,
 * `engine/loop/calculateLoopStrategy.ts`'s own 3-value union) — no new
 * classification invented, just labeled for display.
 *
 * **Three branches are left genuinely untested, not silently
 * uncovered** (found while reviewing this batch's own coverage
 * output): `calculatePortfolioSummary`/`calculatePortfolioExposure`
 * failing on the *current* portfolio, and `calculatePortfolioSummary`
 * failing on the constructed *final* portfolio, are both defensive —
 * unreachable in practice, since `currentResult` only exists here at
 * all once `planLoopStrategy` (M3-010) has already run the same or a
 * stricter validation (`validateLoopStrategySafety` →
 * `validateProtocolParameters`) successfully against this exact
 * portfolio. `STOP_REASON_LABELS`'s own `??` fallback is stronger still
 * — `LoopStopReason` is an exhaustive 3-value union and all 3 are
 * mapped, so the fallback is not just unlikely but type-system-provably
 * unreachable. None are force-tested just to move a coverage
 * percentage, the same discipline this engagement has applied
 * consistently since Milestone 6 Batch 22's own audit.
 *
 * **Final-portfolio construction and the Stop Reason label are now
 * shared utilities (`services/loop/finalPortfolio.ts`,
 * `features/loop-builder/utils/stopReasonLabel.ts`), extracted at
 * Milestone 7 Batch 3 once `LoopSafetyAnalysis.tsx` (M7-013) became a
 * second consumer of both** — no behavior change, purely removing what
 * would otherwise become duplicated code between the two components.
 *
 * **BLOCKER #3 fix — a real new V4 borrow skips the "after" comparison
 * entirely and shows `V4_LOOP_BORROW_RISK_PREMIUM_UNKNOWN_MESSAGE`
 * instead**, rather than letting `buildFinalLoopPortfolio`'s own
 * (separately fixed) fail-closed `v4DebtState: undefined` silently
 * degrade the "Proposed" column to a row of unexplained "—" dashes. See
 * `services/loop/finalPortfolio.ts`'s own header comment for the full
 * protocol-audited reasoning.
 */
export function LoopStrategySummary({ portfolio }: { portfolio: ApplicationPortfolio }) {
  const currentResult = useLoopBuilderStore((state) => state.currentResult);

  if (currentResult === null) {
    return (
      <p className="text-sm text-muted-foreground">Configure a strategy to see results here.</p>
    );
  }

  const beforeSummary = calculatePortfolioSummary(portfolio, 'manual');
  const beforeExposure = calculatePortfolioExposure(portfolio, 'manual');

  if (!beforeSummary.ok || !beforeExposure.ok) {
    return (
      <p role="alert" className="text-sm text-destructive">
        Unable to calculate the current portfolio baseline.
      </p>
    );
  }

  const ambiguousV4Borrow =
    currentResult.strategy !== null &&
    loopIntroducesAmbiguousV4Borrow(portfolio, currentResult.strategy);

  let after: StrategyComparisonResult['after'] = null;
  if (!ambiguousV4Borrow && currentResult.strategy !== null && currentResult.btcExposure !== null) {
    const finalPortfolio = buildFinalLoopPortfolio(portfolio, currentResult.strategy);
    const afterSummary = calculatePortfolioSummary(finalPortfolio, 'manual');
    if (afterSummary.ok) {
      after = { summary: afterSummary.data, btcExposure: currentResult.btcExposure };
    }
  }

  const comparison: StrategyComparisonResult = {
    feasible: currentResult.viable && after !== null,
    before: { summary: beforeSummary.data, btcExposure: beforeExposure.data },
    after,
  };

  return (
    <div className="flex flex-col gap-4">
      {ambiguousV4Borrow && (
        <p className="text-xs text-muted-foreground">
          {V4_LOOP_BORROW_RISK_PREMIUM_UNKNOWN_MESSAGE}
        </p>
      )}
      <StrategyComparison result={comparison} />

      <div className="flex flex-col gap-2 border-t border-border pt-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Annual Interest Cost</span>
          <span className="font-medium text-foreground">
            {currentResult.costs !== null
              ? formatCurrency(currentResult.costs.borrowingInterest)
              : '—'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Estimated Implementation Cost</span>
          <span className="font-medium text-foreground">
            {(() => {
              const totalItem = currentResult.costs?.items.find(
                (item) => item.item === 'totalImplementationCost',
              );
              return totalItem?.amountUsd !== null && totalItem?.amountUsd !== undefined ? (
                formatCurrency(totalItem.amountUsd)
              ) : (
                <span className="text-xs text-muted-foreground">
                  {totalItem?.reason ?? 'Not available.'}
                </span>
              );
            })()}
          </span>
        </div>
        {currentResult.strategy !== null && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Stop Reason</span>
            <span className="font-medium text-foreground">
              {stopReasonLabel(currentResult.strategy.stopReason)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';

import { ApplyToPortfolioReview } from '@/features/portfolioApply';
import {
  buildLoopApplyProposal,
  loopIntroducesAmbiguousV4Borrow,
  type PortfolioApplyProposal,
  V4_LOOP_BORROW_RISK_PREMIUM_UNKNOWN_MESSAGE,
} from '@/services';
import { useLoopBuilderStore } from '@/stores/loopBuilderStore';
import type { Portfolio } from '@/types/portfolio';

/**
 * Apply Loop to Portfolio — V1.1 Batch 3, Section 5. Sibling to the
 * existing `ApplyLoopAsSimulation.tsx` (M7-016), which bridges a loop
 * result into the Simulation Workspace for further exploration; this
 * bridges the same result into the REAL tracked portfolio via
 * `services/portfolioApply`'s `buildLoopApplyProposal` +
 * `stores/portfolioStore.ts`'s `applyPortfolioState`. Uses the exact same
 * `loopIntroducesAmbiguousV4Borrow` proactive gate
 * `ApplyLoopAsSimulation.tsx` already established (Section 5: "Do not
 * rerun or reinterpret loop math in the UI" — the check itself lives in
 * one place, `services/loop`, reused here unchanged).
 */
export function ApplyLoopToPortfolio({ portfolio }: { portfolio: Portfolio }) {
  const currentResult = useLoopBuilderStore((state) => state.currentResult);
  const [proposal, setProposal] = useState<PortfolioApplyProposal | null>(null);
  const [applied, setApplied] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);

  const strategy = currentResult?.strategy ?? null;

  // A previously-shown confirmation/applied state must never survive
  // referring to a strategy that is no longer what's on screen — the same
  // "clear on the underlying result changing" discipline
  // `ApplyLoopAsSimulation.tsx` already establishes.
  useEffect(() => {
    setProposal(null);
    setApplied(false);
    setBuildError(null);
  }, [strategy?.finalCollateral.quantity, strategy?.finalDebt, strategy?.stopReason]);

  if (currentResult === null || currentResult.strategy === null) {
    return (
      <p className="text-sm text-muted-foreground">
        Configure a viable strategy to apply it to your portfolio.
      </p>
    );
  }

  const ambiguousV4Borrow = loopIntroducesAmbiguousV4Borrow(portfolio, currentResult.strategy);

  if (applied) {
    return (
      <p role="status" className="text-xs text-muted-foreground">
        Applied to portfolio.
      </p>
    );
  }

  if (proposal !== null) {
    return (
      <ApplyToPortfolioReview
        portfolio={portfolio}
        proposal={proposal}
        onApplied={() => {
          setProposal(null);
          setApplied(true);
        }}
        onCancel={() => setProposal(null)}
      />
    );
  }

  function handleReview() {
    if (currentResult === null || currentResult.strategy === null || ambiguousV4Borrow) return;
    const result = buildLoopApplyProposal(
      portfolio.id,
      portfolio.updatedAt,
      portfolio,
      currentResult.strategy,
    );
    if (!result.ok) {
      setBuildError(result.errors[0]?.message ?? 'This strategy cannot be applied right now.');
      return;
    }
    setBuildError(null);
    setProposal(result.data);
  }

  return (
    <div className="flex flex-col gap-2 text-sm">
      <p className="text-muted-foreground">
        Apply this loop&apos;s final collateral and debt to your tracked portfolio.
      </p>
      <button
        type="button"
        onClick={handleReview}
        disabled={ambiguousV4Borrow}
        aria-disabled={ambiguousV4Borrow}
        title={ambiguousV4Borrow ? V4_LOOP_BORROW_RISK_PREMIUM_UNKNOWN_MESSAGE : undefined}
        className="w-fit rounded border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
      >
        Review Apply to Portfolio
      </button>
      {ambiguousV4Borrow && (
        <p className="text-xs text-muted-foreground">
          {V4_LOOP_BORROW_RISK_PREMIUM_UNKNOWN_MESSAGE}
        </p>
      )}
      {buildError !== null && (
        <p role="alert" className="text-xs text-destructive">
          {buildError}
        </p>
      )}
    </div>
  );
}

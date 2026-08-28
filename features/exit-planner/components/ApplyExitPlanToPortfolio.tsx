'use client';

import { useEffect, useState } from 'react';

import { ApplyToPortfolioReview } from '@/features/portfolioApply';
import { buildPortfolioActionApplyProposal, type PortfolioApplyProposal } from '@/services';
import { useExitPlannerStore } from '@/stores/exitPlannerStore';
import type { Portfolio } from '@/types/portfolio';

/**
 * Apply Exit Plan to Portfolio — V1.1 Batch 3, Section 6. Sibling to the
 * existing `ApplyExitPlanAsSimulation.tsx` (M7-044), which bridges an
 * exit plan into the Simulation Workspace; this bridges the same
 * transaction into the REAL tracked portfolio via
 * `services/portfolioApply`'s `buildPortfolioActionApplyProposal`.
 *
 * **Reuses the exact same delta `ApplyExitPlanAsSimulation.tsx` already
 * computes** — `-transaction.btcSold`/`-transaction.repayment` — fed
 * through the same shared builder Simulation's own Apply uses (see
 * `services/portfolioApply/buildPortfolioActionApplyProposal.ts`'s own
 * header comment). An exit only ever sells collateral/repays debt
 * (`btcSold`/`repayment` are never negative), so `debtDelta` here can
 * never be positive — the genuinely-ambiguous-V4-borrow case Loop
 * Builder's own Apply must gate against structurally cannot occur for an
 * exit, so no proactive check is needed here.
 *
 * **Zero-debt / full-exit (Section 6)**: a full exit's `remainingDebt`/
 * proposed `debt.balance` is `0`, which `calculatePortfolioSummary`
 * (inside the shared proposal builder) already resolves to
 * `healthFactor: Infinity` — the review panel's own
 * `formatHealthFactor` renders that as "∞" (`Intl.NumberFormat`'s native
 * behavior, the same convention `PortfolioHistoryPanel` already
 * established in V1.1 Batch 2), never a fabricated finite number.
 */
export function ApplyExitPlanToPortfolio({ portfolio }: { portfolio: Portfolio }) {
  const currentResult = useExitPlannerStore((state) => state.currentResult);
  const [proposal, setProposal] = useState<PortfolioApplyProposal | null>(null);
  const [applied, setApplied] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);

  const transactionBtcSold = currentResult?.transaction?.btcSold;
  const transactionRepayment = currentResult?.transaction?.repayment;

  useEffect(() => {
    setProposal(null);
    setApplied(false);
    setBuildError(null);
  }, [transactionBtcSold, transactionRepayment]);

  if (currentResult === null || !currentResult.feasible || currentResult.transaction === null) {
    return (
      <p className="text-sm text-muted-foreground">
        Configure a feasible exit target to apply it to your portfolio.
      </p>
    );
  }

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
    if (currentResult === null || currentResult.transaction === null) return;
    const { btcSold, repayment } = currentResult.transaction;
    const result = buildPortfolioActionApplyProposal(
      'exitPlanner',
      portfolio.id,
      portfolio.updatedAt,
      portfolio,
      { collateralDelta: -btcSold, debtDelta: -repayment },
    );
    if (!result.ok) {
      setBuildError(result.errors[0]?.message ?? 'This exit plan cannot be applied right now.');
      return;
    }
    setBuildError(null);
    setProposal(result.data);
  }

  return (
    <div className="flex flex-col gap-2 text-sm">
      <p className="text-muted-foreground">
        Apply this exit plan&apos;s resulting collateral and debt to your tracked portfolio.
      </p>
      <button
        type="button"
        onClick={handleReview}
        className="w-fit rounded border border-border px-3 py-1.5 text-sm hover:bg-muted"
      >
        Review Apply to Portfolio
      </button>
      {buildError !== null && (
        <p role="alert" className="text-xs text-destructive">
          {buildError}
        </p>
      )}
    </div>
  );
}

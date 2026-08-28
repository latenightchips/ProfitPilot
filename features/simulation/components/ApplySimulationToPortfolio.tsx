'use client';

import { useEffect, useState } from 'react';

import { ApplyToPortfolioReview } from '@/features/portfolioApply';
import { buildPortfolioActionApplyProposal, type PortfolioApplyProposal } from '@/services';
import { useSimulationStore } from '@/stores/simulationStore';
import type { Portfolio } from '@/types/portfolio';

/**
 * Apply Simulation to Portfolio — V1.1 Batch 3, Section 4.
 *
 * **Gated on `portfolioActionInput`, never `portfolioActionPreview`
 * alone.** A price/interest `SimulationScenario` has no resulting
 * collateral/debt state at all — see `services/portfolioApply`'s own
 * audit note — so this only ever renders for a genuine Portfolio Action /
 * Combined Actions scenario built directly in the Scenario Builder.
 * `portfolioActionInput` is specifically the DELTA that PRODUCED the
 * currently-displayed preview (`stores/simulationStore.ts`), which is
 * what `buildPortfolioActionApplyProposal` needs — `portfolioActionPreview`
 * itself is summary-only (`PortfolioActionSimulationResult`, no raw
 * collateral quantity or debt balance), never a usable Apply input on its
 * own. A Loop/Exit "Apply as Simulation" transition
 * (`runPortfolioTransitionSimulation`) leaves `portfolioActionInput`
 * `null` even though `portfolioActionPreview` is set — correctly hiding
 * this section for that case too, since Loop/Exit already have their own
 * dedicated "Apply to Portfolio" sections that apply the real underlying
 * result directly, not a re-derived delta.
 */
export function ApplySimulationToPortfolio({ portfolio }: { portfolio: Portfolio }) {
  const portfolioActionInput = useSimulationStore((state) => state.portfolioActionInput);
  const portfolioActionPreview = useSimulationStore((state) => state.portfolioActionPreview);
  const [proposal, setProposal] = useState<PortfolioApplyProposal | null>(null);
  const [applied, setApplied] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);

  useEffect(() => {
    setProposal(null);
    setApplied(false);
    setBuildError(null);
  }, [portfolioActionInput?.collateralDelta, portfolioActionInput?.debtDelta]);

  if (portfolioActionInput === null || portfolioActionPreview === null) {
    return (
      <p className="text-sm text-muted-foreground">
        Run a Portfolio Action (Add/Withdraw Collateral, Borrow/Repay, or Combined Actions) to apply
        it to your portfolio.
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
    if (portfolioActionInput === null) return;
    const result = buildPortfolioActionApplyProposal(
      'simulation',
      portfolio.id,
      portfolio.updatedAt,
      portfolio,
      portfolioActionInput,
    );
    if (!result.ok) {
      setBuildError(result.errors[0]?.message ?? 'This action cannot be applied right now.');
      return;
    }
    setBuildError(null);
    setProposal(result.data);
  }

  return (
    <div className="flex flex-col gap-2 text-sm">
      <p className="text-muted-foreground">
        Apply this Portfolio Action&apos;s resulting collateral and debt to your tracked portfolio.
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

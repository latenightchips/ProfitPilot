'use client';

import { useState } from 'react';

import {
  formatCurrency,
  formatHealthFactor,
  formatLeverage,
  formatPercent,
} from '@/components/strategy/format';
import type { PortfolioApplyProposal } from '@/services';
import { usePortfolioStore } from '@/stores/portfolioStore';
import type { Portfolio } from '@/types/portfolio';

/**
 * Shared "Apply to Portfolio" confirmation review — V1.1 Batch 3,
 * Section 3 ("Confirmation UX"). Every apply action across Simulation,
 * Loop Builder, and Exit Planner renders this SAME component around
 * their own already-built `PortfolioApplyProposal`
 * (`services/portfolioApply`) — no per-feature copy of the review UI, no
 * per-feature copy of the "This updates ProfitPilot's tracked portfolio
 * only" disclaimer text.
 *
 * **Deliberately an inline panel, not a modal dialog.** Nothing in this
 * codebase uses a modal/portal/focus-trap library anywhere (confirmed by
 * reading every existing feature component before writing this one) —
 * introducing one here for a single confirmation step would be new UI
 * infrastructure this batch's own scope guard ("Do not implement...
 * automation") argues against. Every trigger component
 * (`ApplyLoopToPortfolio.tsx` etc.) renders this in place of its own
 * "Apply to Portfolio" button once a proposal exists, the same
 * "click a button, an inline panel with its own Confirm/Cancel replaces
 * it" pattern `DebtPositionForm`'s own preview-then-apply flow already
 * establishes elsewhere in this codebase.
 *
 * **Never calls `applyPortfolioState` on mount, only on the user's own
 * explicit click — Section 3's "Do not silently apply results."** Cancel
 * never touches the Store at all (not even a no-op call), which is what
 * guarantees Section 7's "no history snapshot on Cancel" — there is
 * nothing to dedupe or suppress, the mutating action is simply never
 * invoked.
 */
export function ApplyToPortfolioReview({
  portfolio,
  proposal,
  onApplied,
  onCancel,
}: {
  portfolio: Portfolio;
  proposal: PortfolioApplyProposal;
  onApplied: () => void;
  onCancel: () => void;
}) {
  const applyPortfolioState = usePortfolioStore((state) => state.applyPortfolioState);
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    const result = applyPortfolioState(proposal);
    if (!result.ok) {
      setError(result.errors[0]?.message ?? 'Applying to the portfolio failed.');
      return;
    }
    setError(null);
    onApplied();
  }

  const collateralChanged =
    portfolio.collateral.quantity !== proposal.proposedPortfolio.collateral.quantity;
  const debtChanged = portfolio.debt.balance !== proposal.proposedPortfolio.debt.balance;

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-muted/30 p-4 text-sm">
      <p className="font-medium text-foreground">Review Apply to Portfolio</p>
      <p className="text-xs text-muted-foreground">
        This updates ProfitPilot&apos;s tracked portfolio only. It does not execute transactions on
        Aave.
      </p>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
        <ApplyMetricRow
          label="Collateral"
          before={`${portfolio.collateral.quantity} ${portfolio.collateral.asset}`}
          after={`${proposal.proposedPortfolio.collateral.quantity} ${proposal.proposedPortfolio.collateral.asset}`}
          changed={collateralChanged}
        />
        <ApplyMetricRow
          label="Debt"
          before={`${portfolio.debt.balance} ${portfolio.debt.asset}`}
          after={`${proposal.proposedPortfolio.debt.balance} ${proposal.proposedPortfolio.debt.asset}`}
          changed={debtChanged}
        />
        <ApplyMetricRow
          label="Health Factor"
          before={formatHealthFactor(proposal.before.healthFactor)}
          after={formatHealthFactor(proposal.after.healthFactor)}
          changed={proposal.before.healthFactor !== proposal.after.healthFactor}
        />
        <ApplyMetricRow
          label="Leverage"
          before={formatLeverage(proposal.before.leverage)}
          after={formatLeverage(proposal.after.leverage)}
          changed={proposal.before.leverage !== proposal.after.leverage}
        />
        <ApplyMetricRow
          label="Loan-to-Value"
          before={formatPercent(proposal.before.loanToValue)}
          after={formatPercent(proposal.after.loanToValue)}
          changed={proposal.before.loanToValue !== proposal.after.loanToValue}
        />
        <ApplyMetricRow
          label="Liquidation Price"
          before={
            proposal.before.liquidation !== null
              ? formatCurrency(proposal.before.liquidation.price)
              : 'No liquidation risk'
          }
          after={
            proposal.after.liquidation !== null
              ? formatCurrency(proposal.after.liquidation.price)
              : 'No liquidation risk'
          }
          changed={proposal.before.liquidation?.price !== proposal.after.liquidation?.price}
        />
        <ApplyMetricRow
          label="Annual Borrowing Cost"
          before={formatCurrency(proposal.before.interestCost)}
          after={formatCurrency(proposal.after.interestCost)}
          changed={proposal.before.interestCost !== proposal.after.interestCost}
        />
      </dl>

      <div>
        <p className="text-xs font-medium text-muted-foreground">Unchanged:</p>
        <ul className="list-inside list-disc text-xs text-muted-foreground">
          {proposal.unchangedAssumptions.map((assumption) => (
            <li key={assumption}>{assumption}</li>
          ))}
        </ul>
      </div>

      {error !== null && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleConfirm}
          className="rounded border border-border bg-foreground px-3 py-1.5 text-sm text-background hover:opacity-90"
        >
          Apply to Portfolio
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-border px-3 py-1.5 text-sm hover:bg-muted"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function ApplyMetricRow({
  label,
  before,
  after,
  changed,
}: {
  label: string;
  before: string;
  after: string;
  changed: boolean;
}) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground">
        {changed ? (
          <>
            {before} <span aria-hidden="true">→</span>
            <span className="sr-only"> to </span> {after}
          </>
        ) : (
          after
        )}
      </dd>
    </div>
  );
}

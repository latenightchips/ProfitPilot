'use client';

import { usePortfolioStore } from '@/stores/portfolioStore';
import type { Portfolio } from '@/types/portfolio';

/**
 * Manual/live conflict confirmation — V4 Readiness Audit §12 P0-1.
 * Closes the P0-1 audit finding: before this component existed, a live
 * fetch that differed from an existing MANUAL `v4DebtState`/
 * `v4CollateralRisk` silently overwrote it (`hooks/useAaveV4LiveSync.ts`/
 * `useAaveV4CollateralRiskLiveSync.ts`'s own "always transition to live"
 * rule, unqualified). Those two hooks now withhold that overwrite
 * specifically when an existing MANUAL value genuinely differs from the
 * fetch, and register the fetched value as a pending candidate instead
 * (`stores/portfolioStore.ts`'s `v4DebtStateCandidates`/
 * `v4CollateralRiskCandidates`) — this component is the "explicit inline
 * confirmation UI" that makes that pending candidate actionable.
 *
 * **Reuses the repository's established inline-confirmation-panel
 * pattern** (`app/portfolios/PortfoliosPageClient.tsx`'s own delete
 * confirmation panel — "no new global Dialog/Modal component... an
 * inline expand-to-confirm panel satisfies 'Require confirmation'") —
 * no modal/dialog/toast framework introduced. Each panel below is
 * gated purely on whether its own dimension currently has a pending
 * candidate (`state.v4DebtStateCandidates[portfolioId]`/
 * `v4CollateralRiskCandidates[portfolioId]`), reading directly from the
 * Store rather than any local component state.
 *
 * **Debt and collateral-risk conflicts are two independent panels**,
 * matching the two hooks' own independent candidate maps — accepting or
 * dismissing one never touches the other, and both can be visible
 * simultaneously if both dimensions happen to be in conflict at once.
 *
 * **"Use Live Data"** calls `acceptAaveV4DebtStateCandidate`/
 * `acceptAaveV4CollateralRiskCandidate`, which writes the pending
 * candidate as the new canonical `'live'` value and clears the
 * candidate as part of that same write (`setAaveV4DebtState`/
 * `setAaveV4CollateralRisk`'s own centralized candidate-clear — see
 * their comments in `stores/portfolioStore.ts`). **"Keep Manual"** calls
 * `dismissAaveV4DebtStateCandidate`/`dismissAaveV4CollateralRiskCandidate`,
 * which discards the candidate without writing anything — canonical
 * state (manual) is left completely untouched, and future live syncs
 * are not disabled: the next genuinely new fetch (a fresh
 * `engineInputs`/`canonical` object) is free to surface a new candidate
 * on its own schedule, per each hook's own `lastAppliedEngineInputs`/
 * `lastAppliedCanonical` one-shot-per-fetch guard.
 */
function formatDebtStateValue(debtState: Portfolio['v4DebtState']): string {
  if (debtState === undefined) return '—';
  return [
    `Drawn debt ${debtState.drawnDebt}`,
    `Premium debt ${debtState.premiumDebt}`,
    `Base APR ${(debtState.baseDrawnApr * 100).toFixed(2)}%`,
    `Risk premium ${(debtState.riskPremium * 100).toFixed(2)}%`,
  ].join(' · ');
}

function formatCollateralRiskValue(risk: Portfolio['v4CollateralRisk']): string {
  if (risk === undefined) return '—';
  return `Collateral factor ${(risk.collateralFactor * 100).toFixed(2)}%`;
}

function AaveV4DebtStateConflictPanel({
  portfolioId,
  portfolio,
}: {
  portfolioId: string;
  portfolio: Portfolio;
}) {
  const candidate = usePortfolioStore((state) => state.v4DebtStateCandidates[portfolioId]);
  const acceptCandidate = usePortfolioStore((state) => state.acceptAaveV4DebtStateCandidate);
  const dismissCandidate = usePortfolioStore((state) => state.dismissAaveV4DebtStateCandidate);

  if (candidate === undefined) return null;

  return (
    <div
      role="alert"
      className="flex flex-col gap-2 rounded-md border border-border bg-accent/20 p-3 text-xs"
    >
      <p className="font-medium text-foreground">
        Debt State: live Aave data differs from your manual assumption
      </p>
      <dl className="flex flex-col gap-1">
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground">Manual (current)</dt>
          <dd>{formatDebtStateValue(portfolio.v4DebtState)}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground">Live (fetched)</dt>
          <dd>{formatDebtStateValue(candidate)}</dd>
        </div>
      </dl>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => acceptCandidate(portfolioId)}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/40"
        >
          Use Live Data
        </button>
        <button
          type="button"
          onClick={() => dismissCandidate(portfolioId)}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/40"
        >
          Keep Manual
        </button>
      </div>
    </div>
  );
}

function AaveV4CollateralRiskConflictPanel({
  portfolioId,
  portfolio,
}: {
  portfolioId: string;
  portfolio: Portfolio;
}) {
  const candidate = usePortfolioStore((state) => state.v4CollateralRiskCandidates[portfolioId]);
  const acceptCandidate = usePortfolioStore((state) => state.acceptAaveV4CollateralRiskCandidate);
  const dismissCandidate = usePortfolioStore((state) => state.dismissAaveV4CollateralRiskCandidate);

  if (candidate === undefined) return null;

  return (
    <div
      role="alert"
      className="flex flex-col gap-2 rounded-md border border-border bg-accent/20 p-3 text-xs"
    >
      <p className="font-medium text-foreground">
        Collateral Risk: live Aave data differs from your manual assumption
      </p>
      <dl className="flex flex-col gap-1">
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground">Manual (current)</dt>
          <dd>{formatCollateralRiskValue(portfolio.v4CollateralRisk)}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground">Live (fetched)</dt>
          <dd>{formatCollateralRiskValue(candidate)}</dd>
        </div>
      </dl>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => acceptCandidate(portfolioId)}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/40"
        >
          Use Live Data
        </button>
        <button
          type="button"
          onClick={() => dismissCandidate(portfolioId)}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/40"
        >
          Keep Manual
        </button>
      </div>
    </div>
  );
}

export function AaveV4ConflictConfirmation({
  portfolioId,
  portfolio,
}: {
  portfolioId: string;
  portfolio: Portfolio;
}) {
  return (
    <>
      <AaveV4DebtStateConflictPanel portfolioId={portfolioId} portfolio={portfolio} />
      <AaveV4CollateralRiskConflictPanel portfolioId={portfolioId} portfolio={portfolio} />
    </>
  );
}

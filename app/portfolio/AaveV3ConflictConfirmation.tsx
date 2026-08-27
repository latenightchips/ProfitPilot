'use client';

import { usePortfolioStore } from '@/stores/portfolioStore';
import type { Portfolio } from '@/types/portfolio';

/**
 * Manual/live conflict confirmation for Aave V3 — V1.1 Batch 1
 * (Live-Data Trust Parity). The V3 equivalent of
 * `app/portfolio/AaveV4ConflictConfirmation.tsx`, closing the one
 * asymmetry the V1 post-release assessment found between the two
 * protocol versions' live-sync trust models: before this batch, a live
 * V3 fetch that differed from an existing MANUAL `market`/`protocol`
 * value silently overwrote it (`hooks/useAaveLiveSync.ts`'s own
 * previous "always sync when different" rule, unqualified). That hook
 * now withholds the overwrite specifically when an existing MANUAL
 * value genuinely differs from the fetch, and registers the fetched
 * value as a pending candidate instead (`stores/portfolioStore.ts`'s
 * `marketCandidates`/`protocolCandidates`) — this component is the
 * explicit inline confirmation UI that makes that pending candidate
 * actionable, structurally identical to `AaveV4ConflictConfirmation`'s
 * own panel/`aria-describedby`/button pattern (see that file's own
 * header comment for the full reasoning behind this shared pattern —
 * not repeated here).
 *
 * **Market Price and Protocol Parameters are two independent panels**,
 * matching the hook's own independent candidate maps — accepting or
 * dismissing one never touches the other, and both can be visible
 * simultaneously if both dimensions happen to be in conflict at once.
 *
 * **"Use Live Data"** calls `acceptMarketCandidate`/
 * `acceptProtocolCandidate`, which writes the pending candidate as the
 * new canonical `'live'` value and clears the candidate as part of that
 * same write (`setMarket`/`setProtocol`'s own centralized
 * candidate-clear — see their comments in `stores/portfolioStore.ts`).
 * **"Keep Manual"** calls `dismissMarketCandidate`/
 * `dismissProtocolCandidate`, which discards the candidate without
 * writing anything — canonical state (manual) is left completely
 * untouched, and future live syncs are not disabled: the next
 * genuinely different fetch is free to surface a new candidate on its
 * own schedule.
 *
 * Only ever renders a panel for a V3 (or protocol-version-unset)
 * portfolio — `hooks/useAaveLiveSync.ts`'s own `syncsMarketPrice`/
 * `syncsProtocolParameters` gates mean a V4 portfolio's
 * `marketCandidates`/`protocolCandidates` entry can never become
 * defined in the first place, so no separate guard is needed here,
 * exactly the same trust-the-hook discipline
 * `AaveV4ConflictConfirmation` itself relies on for its own dimensions.
 */
function formatMarketValue(market: Portfolio['market']): string {
  return `BTC price $${market.btcPriceUsd.toLocaleString('en-US')}`;
}

function formatProtocolValue(protocol: Portfolio['protocol']): string {
  return [
    `Max LTV ${(protocol.maxLoanToValue * 100).toFixed(2)}%`,
    `Liquidation threshold ${(protocol.liquidationThreshold * 100).toFixed(2)}%`,
    `Borrow APR ${(protocol.borrowApr * 100).toFixed(2)}%`,
    `Supply APR ${(protocol.supplyApr * 100).toFixed(2)}%`,
  ].join(' · ');
}

function MarketConflictPanel({
  portfolioId,
  portfolio,
}: {
  portfolioId: string;
  portfolio: Portfolio;
}) {
  const candidate = usePortfolioStore((state) => state.marketCandidates[portfolioId]);
  const acceptCandidate = usePortfolioStore((state) => state.acceptMarketCandidate);
  const dismissCandidate = usePortfolioStore((state) => state.dismissMarketCandidate);

  if (candidate === undefined) return null;

  return (
    <div
      role="alert"
      className="flex flex-col gap-2 rounded-md border border-border bg-accent/20 p-3 text-xs"
    >
      <p id={`v3-market-conflict-heading-${portfolioId}`} className="font-medium text-foreground">
        Market Price: live Aave data differs from your manual assumption
      </p>
      <dl className="flex flex-col gap-1">
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground">Manual (current)</dt>
          <dd>{formatMarketValue(portfolio.market)}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground">Live (fetched)</dt>
          <dd>{formatMarketValue(candidate)}</dd>
        </div>
      </dl>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => acceptCandidate(portfolioId)}
          aria-describedby={`v3-market-conflict-heading-${portfolioId}`}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/40"
        >
          Use Live Data
        </button>
        <button
          type="button"
          onClick={() => dismissCandidate(portfolioId)}
          aria-describedby={`v3-market-conflict-heading-${portfolioId}`}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/40"
        >
          Keep Manual
        </button>
      </div>
    </div>
  );
}

function ProtocolConflictPanel({
  portfolioId,
  portfolio,
}: {
  portfolioId: string;
  portfolio: Portfolio;
}) {
  const candidate = usePortfolioStore((state) => state.protocolCandidates[portfolioId]);
  const acceptCandidate = usePortfolioStore((state) => state.acceptProtocolCandidate);
  const dismissCandidate = usePortfolioStore((state) => state.dismissProtocolCandidate);

  if (candidate === undefined) return null;

  return (
    <div
      role="alert"
      className="flex flex-col gap-2 rounded-md border border-border bg-accent/20 p-3 text-xs"
    >
      <p id={`v3-protocol-conflict-heading-${portfolioId}`} className="font-medium text-foreground">
        Protocol Parameters: live Aave data differs from your manual assumption
      </p>
      <dl className="flex flex-col gap-1">
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground">Manual (current)</dt>
          <dd>{formatProtocolValue(portfolio.protocol)}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground">Live (fetched)</dt>
          <dd>{formatProtocolValue(candidate)}</dd>
        </div>
      </dl>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => acceptCandidate(portfolioId)}
          aria-describedby={`v3-protocol-conflict-heading-${portfolioId}`}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/40"
        >
          Use Live Data
        </button>
        <button
          type="button"
          onClick={() => dismissCandidate(portfolioId)}
          aria-describedby={`v3-protocol-conflict-heading-${portfolioId}`}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/40"
        >
          Keep Manual
        </button>
      </div>
    </div>
  );
}

export function AaveV3ConflictConfirmation({
  portfolioId,
  portfolio,
}: {
  portfolioId: string;
  portfolio: Portfolio;
}) {
  return (
    <>
      <MarketConflictPanel portfolioId={portfolioId} portfolio={portfolio} />
      <ProtocolConflictPanel portfolioId={portfolioId} portfolio={portfolio} />
    </>
  );
}

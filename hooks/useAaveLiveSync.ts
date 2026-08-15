'use client';

import { useEffect } from 'react';

import { useAaveLiveDataStore } from '@/stores/aaveLiveDataStore';
import {
  marketPricesEqual,
  protocolParametersEqual,
  usePortfolioStore,
} from '@/stores/portfolioStore';

/**
 * Portfolio Live-State Cleanup batch — syncs live Aave V3 data into the
 * active portfolio's `market`/`protocol` fields, so "Portfolio" reflects
 * current on-chain state rather than a manually-entered snapshot.
 * Mounted from both `PortfolioPageClient` and `DashboardPageClient` so
 * either page, opened directly, fetches and syncs independently — neither
 * depends on the other having run first.
 *
 * **Never touches `collateral`/`debt`.** The `update()` payload below
 * only ever contains `market`/`protocol` — quantity, debt asset, and
 * debt amount remain exclusively user-editable, structurally (not just
 * by omission of matching UI): even if this hook's dependencies were
 * wrong, it has no code path capable of writing those fields.
 *
 * **Equality-gated, not unconditional.** `usePortfolioStore().update()`
 * always bumps `updatedAt` (and, transitively, clears any open Preview on
 * the Portfolio page's Collateral/Debt forms — see `PortfolioPageClient`'s
 * own `useEffect` keyed on `portfolio.updatedAt`). Calling `update()` on
 * every successful-but-identical refresh would silently discard an
 * in-progress Preview the moment a background refresh happened to land.
 * `marketPricesEqual`/`protocolParametersEqual` (exported from
 * `stores/portfolioStore.ts` for exactly this reuse) skip the call
 * entirely when the fetched values already match what's stored.
 *
 * **On RPC failure, does nothing** — `useAaveLiveDataStore`'s error paths
 * already preserve the last successful `marketQuote`/`protocolQuote`
 * (or leave them `null` if none ever succeeded); either way, this hook's
 * sync effect only ever reads `status === 'ready'` data, so a failed
 * fetch simply leaves the portfolio's currently-stored values — live or
 * still-manual/never-synced — exactly as they were. Nothing is ever
 * blanked or zeroed.
 */
export function useAaveLiveSync(portfolioId: string | null): void {
  const status = useAaveLiveDataStore((state) => state.status);
  const marketQuote = useAaveLiveDataStore((state) => state.marketQuote);
  const protocolQuote = useAaveLiveDataStore((state) => state.protocolQuote);
  const fetchLiveAaveData = useAaveLiveDataStore((state) => state.fetchLiveAaveData);
  const update = usePortfolioStore((state) => state.update);
  const portfolio = usePortfolioStore((state) =>
    portfolioId !== null ? state.portfolios[portfolioId]?.portfolio : undefined,
  );

  useEffect(() => {
    void fetchLiveAaveData();
  }, [fetchLiveAaveData]);

  useEffect(() => {
    if (portfolioId === null || portfolio === undefined) return;
    if (status !== 'ready') return;
    if (marketQuote === null || marketQuote.freshness === 'unavailable') return;
    if (protocolQuote === null || !protocolQuote.available) return;

    const nextMarket = { btcPriceUsd: marketQuote.price };
    const nextProtocol = protocolQuote.parameters;

    const marketChanged = !marketPricesEqual(nextMarket, portfolio.market);
    const protocolChanged = !protocolParametersEqual(nextProtocol, portfolio.protocol);
    if (!marketChanged && !protocolChanged) return;

    update(portfolioId, { market: nextMarket, protocol: nextProtocol });
  }, [portfolioId, portfolio, status, marketQuote, protocolQuote, update]);
}

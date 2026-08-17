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
 *
 * **V4 Readiness Audit §12 Stage 23A — never writes `protocol` for a V4
 * portfolio.** `market` (BTC price) is genuinely protocol-agnostic and
 * keeps syncing for V3 and V4 alike, unchanged. `protocol`
 * (`maxLoanToValue`/`liquidationThreshold`/`borrowApr`/`supplyApr`) is
 * the V3 Aave pool's own risk parameters — Stage 23's own audit found
 * this hook previously wrote them into a V4 portfolio's shared
 * `protocol` field unconditionally, with no relationship to that
 * portfolio's real V4 risk configuration (V4's Collateral Factor/
 * Liquidation Bonus/Liquidation Fee live in a versioned dynamic-config
 * mapping this codebase does not yet read at all — see Stage 23's own
 * audit for why building that read is explicitly deferred to Stage 23B,
 * pending primary-source verification of the exact contract interface).
 * `syncsProtocolParameters` below reads `portfolio.protocolVersion`
 * fresh from the same store-subscribed `portfolio` value the rest of
 * this effect already depends on — never a cached/memoized flag — so a
 * mid-flight V3→V4 (or V4→V3) switch is reflected the moment the switch
 * lands, not the value that was true when the in-flight fetch started;
 * `portfolio` is already a required dependency of this effect for
 * exactly this reason (`portfolioId`/`status`/`marketQuote`/
 * `protocolQuote` are the fetch-completion signals, `portfolio` is the
 * up-to-date target to gate and merge against). **This does not clear,
 * migrate, or fabricate anything** — a V4 portfolio's `protocol` field
 * simply stops being written by this hook; whatever it already held
 * (manually entered, or a V3 snapshot from before switching to V4) stays
 * exactly as-is until a real V4 risk-parameter source exists (Stage
 * 23B). `protocol.liquidationThreshold`/`maxLoanToValue` remain
 * V3-shaped and are not reinterpreted as V4 semantics anywhere by this
 * change.
 */
const DEFAULT_BORROW_ASSET = 'USDC';

export function useAaveLiveSync(portfolioId: string | null): void {
  const status = useAaveLiveDataStore((state) => state.status);
  const marketQuote = useAaveLiveDataStore((state) => state.marketQuote);
  const protocolQuote = useAaveLiveDataStore((state) => state.protocolQuote);
  const fetchLiveAaveData = useAaveLiveDataStore((state) => state.fetchLiveAaveData);
  const update = usePortfolioStore((state) => state.update);
  const portfolio = usePortfolioStore((state) =>
    portfolioId !== null ? state.portfolios[portfolioId]?.portfolio : undefined,
  );

  const borrowAsset = portfolio?.debt.asset ?? DEFAULT_BORROW_ASSET;

  useEffect(() => {
    void fetchLiveAaveData(borrowAsset);
  }, [fetchLiveAaveData, borrowAsset]);

  useEffect(() => {
    if (portfolioId === null || portfolio === undefined) return;
    if (status !== 'ready') return;
    if (marketQuote === null || marketQuote.freshness === 'unavailable') return;
    if (protocolQuote === null || !protocolQuote.available) return;
    // Mismatch guard (USDT Support milestone) — a live quote fetched for a
    // different asset than this portfolio's own `debt.asset` must never be
    // synced in, even if it happens to arrive while this portfolio is
    // active (e.g. right after an asset switch, before the new fetch
    // lands). See `stores/aaveLiveDataStore.ts`'s own request-id guard for
    // the complementary protection against a stale in-flight response.
    if (protocolQuote.borrowAsset !== portfolio.debt.asset) return;

    const nextMarket = { btcPriceUsd: marketQuote.price };
    const nextProtocol = protocolQuote.parameters;

    // V4 Readiness Audit §12 Stage 23A — read fresh off `portfolio` (an
    // effect dependency below), never cached, so a version switch that
    // lands mid-flight is honored on this very effect run.
    const syncsProtocolParameters = portfolio.protocolVersion !== 'v4';

    const marketChanged = !marketPricesEqual(nextMarket, portfolio.market);
    const protocolChanged =
      syncsProtocolParameters && !protocolParametersEqual(nextProtocol, portfolio.protocol);
    if (!marketChanged && !protocolChanged) return;

    update(portfolioId, {
      market: nextMarket,
      ...(syncsProtocolParameters && { protocol: nextProtocol }),
    });
  }, [portfolioId, portfolio, status, marketQuote, protocolQuote, update]);
}

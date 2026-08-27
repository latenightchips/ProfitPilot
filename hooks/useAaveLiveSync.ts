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
 * **Equality-gated, not unconditional.** A write (whether direct or via
 * candidate-acceptance) always bumps `updatedAt` (and, transitively,
 * clears any open Preview on the Portfolio page's Collateral/Debt forms
 * — see `PortfolioPageClient`'s own `useEffect` keyed on
 * `portfolio.updatedAt`). Calling it on every successful-but-identical
 * refresh would silently discard an in-progress Preview the moment a
 * background refresh happened to land. `marketPricesEqual`/
 * `protocolParametersEqual` (exported from `stores/portfolioStore.ts` for
 * exactly this reuse) skip the write entirely when the fetched values
 * already match what's stored — for either an already-`'live'` field
 * (plain refresh) or a `'manual'` one (no pointless conflict manufactured
 * merely because a manual guess happens to match reality).
 *
 * **V1.1 Batch 1 (Live-Data Trust Parity) — manual → live conflict
 * confirmation, the V3 equivalent of `hooks/useAaveV4LiveSync.ts`'s own
 * P0-1 model.** Before this batch, a live fetch that differed from an
 * existing MANUAL `market`/`protocol` value silently overwrote it — the
 * one asymmetry between V3 and V4's otherwise-parallel live-sync designs
 * this batch closes. The rule, independently per field (`market`/BTC
 * price, `protocol`/LTV+liquidation-threshold+borrow-APR+supply-APR — the
 * same two atomic objects this hook has always fetched/compared as
 * units, not four separate scalar conflicts):
 *
 * - `marketSource`/`protocolSource === 'live'` (an established live
 *   field): any newly-fetched value auto-applies directly via
 *   `setMarket`/`setProtocol` — the ordinary live→live refresh model,
 *   unchanged, no confirmation. Equal to what's already stored: no-op,
 *   exactly as before.
 * - `marketSource`/`protocolSource !== 'live'` (still `'manual'` —
 *   every portfolio's starting state, since `market`/`protocol` are
 *   never optional and always come from the New Portfolio form's own
 *   manual entry) and the fetched value is numerically EQUAL to what's
 *   stored: a genuine no-op, exactly like the already-`'live'`
 *   equal case above — no write, no candidate, source stays `'manual'`.
 *   Nothing visibly changes, so no confirmation is warranted, and there
 *   is nothing to promote: a coincidental match is not the user
 *   accepting live data, only the two happening to agree right now — the
 *   next genuinely different fetch still correctly asks first.
 * - `marketSource`/`protocolSource !== 'live'` and the fetched value
 *   GENUINELY DIFFERS: canonical state is left completely untouched
 *   (still the user's manual value) and the fetched value is instead
 *   registered as a pending candidate via `setMarketCandidate`/
 *   `setProtocolCandidate` — actionable only through
 *   `app/portfolio/AaveV3ConflictConfirmation.tsx`'s "Use Live Data"
 *   (`acceptMarketCandidate`/`acceptProtocolCandidate`) or "Keep Manual"
 *   (`dismissMarketCandidate`/`dismissProtocolCandidate`), never
 *   automatically. Accepting is the only way a field ever transitions
 *   from `'manual'` to `'live'` — see `setMarket`/`setProtocol`'s own
 *   comment (`stores/portfolioStore.ts`) for why `'live'` is the correct
 *   default `source` for that action generally, and `'manual'` is the
 *   one deliberate exception (`create`).
 *
 * Deliberately NOT identical to V4's own rule in one respect: V4 also
 * auto-adopts (no confirmation) when the canonical value is `undefined`
 * — "nothing to protect." V3's `market`/`protocol` are never `undefined`
 * (every portfolio has a real value from creation onward), so that case
 * cannot occur here; there is always something to protect, which is
 * exactly why every portfolio's first live fetch either matches (silent
 * no-op) or conflicts (confirmation) — never a bare adopt.
 *
 * `marketCandidates`/`protocolCandidates` are portfolio-scoped, ephemeral
 * Store state (`stores/portfolioStore.ts`), exactly like V4's
 * `v4DebtStateCandidates`/`v4CollateralRiskCandidates` — switching the
 * active portfolio, or a portfolio's `protocolVersion` moving to `'v4'`,
 * cannot leak a pending V3 candidate into another portfolio or into any
 * V4 field: candidates live in their own map keyed by portfolio id, and
 * this hook's own `syncsMarketPrice`/`syncsProtocolParameters` gates
 * below (unchanged from before this batch) mean it never even evaluates
 * a conflict for a V4 portfolio in the first place.
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
 * portfolio.** `protocol`
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
 *
 * **V4 Readiness Audit §12 P1-C — never writes `market` (BTC price) for
 * a V4 portfolio either, as of this stage.** This header comment
 * previously called `market` "genuinely protocol-agnostic" — that was
 * inaccurate, not a deliberate design: this hook's V3 Aave-oracle price
 * was silently being reused for V4 portfolios too, with no verification
 * V3 and V4 oracle prices are equivalent (they are architecturally
 * independent — V4 Readiness Audit §12 P1-A). `syncsMarketPrice` below
 * mirrors `syncsProtocolParameters` exactly, same live re-evaluation
 * against the current `portfolio.protocolVersion`: a V4 portfolio's
 * `market` field now stops being written by this hook, exactly the same
 * "does not clear/migrate/fabricate" discipline as `protocol` above —
 * whatever `market.btcPriceUsd` already held stays as-is until
 * `hooks/useAaveV4CollateralRiskLiveSync.ts`'s own V4-oracle-sourced
 * write (added the same stage) lands. That hook is now the sole writer
 * of `market` for a V4 portfolio, exactly as this hook is the sole
 * writer for a V3 one — ownership is protocol-aware by construction, not
 * by execution order, so a V3 refresh can never race a V4 oracle write.
 */
const DEFAULT_BORROW_ASSET = 'USDC';

export function useAaveLiveSync(portfolioId: string | null): void {
  const status = useAaveLiveDataStore((state) => state.status);
  const marketQuote = useAaveLiveDataStore((state) => state.marketQuote);
  const protocolQuote = useAaveLiveDataStore((state) => state.protocolQuote);
  const fetchLiveAaveData = useAaveLiveDataStore((state) => state.fetchLiveAaveData);
  const setMarket = usePortfolioStore((state) => state.setMarket);
  const setProtocol = usePortfolioStore((state) => state.setProtocol);
  const setMarketCandidate = usePortfolioStore((state) => state.setMarketCandidate);
  const setProtocolCandidate = usePortfolioStore((state) => state.setProtocolCandidate);
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

    // V4 Readiness Audit §12 Stage 23A / P1-C — read fresh off
    // `portfolio` (an effect dependency below), never cached, so a
    // version switch that lands mid-flight is honored on this very
    // effect run. Both gates share the identical condition today
    // (neither `protocol` nor `market` is V3-sourced-appropriate for a
    // V4 portfolio) but are named separately since they answer distinct
    // ownership questions.
    const syncsProtocolParameters = portfolio.protocolVersion !== 'v4';
    const syncsMarketPrice = portfolio.protocolVersion !== 'v4';

    // V1.1 Batch 1 (Live-Data Trust Parity) — see this file's own header
    // comment for the full manual/live conflict rule. Each field is
    // resolved independently: an already-`'live'` field refreshes
    // directly on a genuine change (equal-skip preserved); a `'manual'`
    // field either stays a no-op (fetched value matches — nothing to
    // promote) or becomes a pending candidate (fetched value genuinely
    // differs) — never a silent overwrite of a manual value.
    if (syncsMarketPrice) {
      if (portfolio.marketSource === 'live') {
        if (!marketPricesEqual(nextMarket, portfolio.market)) {
          setMarket(portfolioId, nextMarket, 'live');
        }
      } else if (!marketPricesEqual(nextMarket, portfolio.market)) {
        setMarketCandidate(portfolioId, nextMarket);
      }
    }

    if (syncsProtocolParameters) {
      if (portfolio.protocolSource === 'live') {
        if (!protocolParametersEqual(nextProtocol, portfolio.protocol)) {
          setProtocol(portfolioId, nextProtocol, 'live');
        }
      } else if (!protocolParametersEqual(nextProtocol, portfolio.protocol)) {
        setProtocolCandidate(portfolioId, nextProtocol);
      }
    }
  }, [
    portfolioId,
    portfolio,
    status,
    marketQuote,
    protocolQuote,
    setMarket,
    setProtocol,
    setMarketCandidate,
    setProtocolCandidate,
  ]);
}

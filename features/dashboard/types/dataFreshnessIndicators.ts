/**
 * Data Freshness Indicators types — 06_TASKS.md M5-017 ("Implement Data
 * Freshness Indicators"). Dependencies: M3-007, M3-008, M5-004. DoD:
 * "Users always know whether calculations rely on current, stale, or
 * manual inputs." Show: "Source, Last updated time, Fresh or stale
 * classification, Manual-data status, Refresh status."
 *
 * **This is a dedicated, fuller section — not a replacement for the
 * compact freshness line `DashboardSummaryHeader` (M5-004) already
 * renders.** M5-004's line shows only the market price's origin/staleness
 * inline; M5-017's own "Show" list is longer (adds Protocol Parameters
 * entirely, plus an explicit "Manual-data status" and "Refresh status"),
 * matching how `LiquidationRiskPanel` (M5-009) added a fuller dedicated
 * section without removing the KPI grid's own liquidation cards.
 *
 * **Every field is read directly off `DashboardFreshness`
 * (`../types/viewModel.ts`, M5-003/M5-004)** — `origin`,
 * `formattedUpdatedAt`, and (market only) `freshness` are already
 * Service-derived values (`normalizeMarketQuote`/`normalizeProtocolQuote`,
 * M3-007/M3-008); this module only reshapes them for display, the same
 * "view model, not a calculator" boundary every other Dashboard type file
 * in this milestone observes.
 *
 * **"Fresh or stale classification" is market-only, by design, not an
 * omission.** `services/protocol/quote.ts`'s own header comment already
 * establishes why: `04_BUILD_GUIDE.md` defines a concrete 5-minute
 * Fresh/Stale/Unavailable rule for prices specifically, with no
 * equivalent "PROTOCOL FRESHNESS" rule documented anywhere. Inventing a
 * staleness threshold for protocol data here would be exactly the kind of
 * undocumented business rule this engagement does not invent — carrying
 * that already-established M3-008 finding forward, not re-litigating it.
 * `FreshnessIndicator.freshnessLabel` is `null` for the protocol row for
 * this reason.
 *
 * **"Manual-data status" is `isManual: boolean`**, surfaced as its own
 * field distinct from `source` — M5-017's own Show list names it as a
 * separate item from "Source," so it is rendered as its own visible
 * callout rather than folded silently into the source label.
 *
 * **"Refresh status" resolves to `refreshNote`, a fixed explanatory
 * string, not a transient state.** `01_PRD.md` REQ-010 ("Version 0.1 uses
 * Manual Mode") and `services/market/quote.ts`'s own header comment
 * (no `PriceProvider`/CoinGecko adapter exists anywhere in this codebase)
 * already establish that no live data source exists to report a
 * request/response cycle for. `stores/portfolioStore.ts`'s own
 * `recomputeSummary` (the mechanism behind `DashboardSummaryHeader`'s
 * "Refresh" button, M4-017/M5-004) is a synchronous, in-memory
 * recalculation against already-entered values — there is no observable
 * "refreshing" transient state to render (the same "instant transition,
 * not fabricated latency" reasoning `app/page.tsx`'s own `loadStatus`
 * comment already applies to `'loading'`). `refreshNote` states this
 * honestly instead of inventing a progress indicator for a network
 * request that never happens.
 *
 * **This also resolves M5-018 ("Implement Dashboard Refresh Workflow")
 * without new workflow code.** M5-018's own Workflow list — "Request new
 * market data. Request updated protocol parameters. Validate responses.
 * Recalculate portfolio summary. Retain previous valid values if refresh
 * fails." — splits into two halves: the first three steps require a live
 * data provider, which does not exist in this Manual-Mode version (same
 * structural gap this file's own `refreshNote` documents, not a new
 * conflict); the last two are already true today, for free, with zero new
 * code — `recomputeSummary` only re-derives from the portfolio's already-
 * validated, already-stored fields (it does not fetch, so there is
 * nothing external to fail and nothing valid to lose — see that action's
 * own header comment in `stores/portfolioStore.ts`). M5-018's DoD
 * ("Refresh failures do not erase valid existing data") is therefore
 * already satisfied structurally: there is no failure mode in which
 * `recomputeSummary` can erase or replace `portfolio.market`/
 * `portfolio.protocol`. No new component or action was added for M5-018;
 * `refreshNote` below is the one visible artifact explaining why.
 */
export interface FreshnessIndicator {
  label: string;
  /** Raw origin value (e.g. `'manual'`, `'cache'`, `'provider'`/`'live'`) — same unformatted wording `DashboardSummaryHeader` already uses, not a newly invented label set. */
  source: string;
  isManual: boolean;
  formattedUpdatedAt: string;
  /** `'Fresh'` / `'Stale'`, or `null` when no classification is documented for this data type (protocol parameters — see this file's own header comment). */
  freshnessLabel: 'Fresh' | 'Stale' | null;
}

export interface DataFreshnessIndicators {
  /** `null` only in the practically-unreachable case `DashboardFreshness.market` itself documents. */
  market: FreshnessIndicator | null;
  /** `null` only in the practically-unreachable case `DashboardFreshness.protocol` itself documents. */
  protocol: FreshnessIndicator | null;
  refreshNote: string;
}

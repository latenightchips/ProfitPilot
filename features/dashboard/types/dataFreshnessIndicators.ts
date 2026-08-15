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
 * string, not a transient progress indicator.** Originally (M5-017/M5-018,
 * before the Aave V3 integration existed) this documented that "Refresh"
 * had nothing to request — pure Manual Mode, `recomputeSummary` only
 * re-derived from already-entered values. **Dashboard Live-State Cleanup
 * batch: no longer true.** "Refresh" (`DashboardSummaryHeader`) now also
 * calls `useAaveLiveDataStore.fetchLiveAaveData`, a real request this
 * module's own `refreshNote` must describe honestly, matching M5-018's
 * original "Request new market data / Request updated protocol
 * parameters" Workflow items it once explained away as N/A. `refreshNote`
 * remains a fixed string rather than a transient "refreshing…" state
 * because the fetch itself is handled by `useAaveLiveDataStore.status`
 * (surfaced elsewhere, via `utils/aaveDataStatus.ts`'s Live/Stale/
 * Unavailable badge) — this section's own job is the static explanation
 * of what the button does, not a live progress indicator.
 *
 * **M5-018's DoD ("Refresh failures do not erase valid existing data")
 * remains satisfied, now for a different, still-structural reason.**
 * `hooks/useAaveLiveSync.ts`'s equality-gated `update()` call — the same
 * path `fetchLiveAaveData` feeds — only ever writes `market`/`protocol`,
 * never `collateral`/`debt`, and on fetch failure leaves the portfolio's
 * currently-stored values untouched entirely (see that hook's own header
 * comment). There is still no failure mode in which "Refresh" can erase
 * or replace a user's entered position data.
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

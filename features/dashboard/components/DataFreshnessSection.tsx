import type { DataFreshnessIndicators, FreshnessIndicator } from '../types/dataFreshnessIndicators';

/**
 * Data Freshness Indicators section — 06_TASKS.md M5-017. DoD: "Users
 * always know whether calculations rely on current, stale, or manual
 * inputs." Placed above the ok/error branch in `app/page.tsx`, alongside
 * `DashboardSummaryHeader` — freshness is derived from `Portfolio` alone
 * (see `../types/viewModel.ts`'s own `DashboardViewModelBase` comment),
 * so it stays visible even when the deeper calculation has failed, which
 * is exactly when knowing "was this stale/manual data?" matters most.
 */
function Row({ indicator }: { indicator: FreshnessIndicator }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs">
      <span className="font-medium text-foreground">{indicator.label}:</span>
      <span className="text-muted-foreground">source {indicator.source}</span>
      {indicator.isManual && <span className="text-muted-foreground">(manual entry)</span>}
      <span className="text-muted-foreground">&middot; updated {indicator.formattedUpdatedAt}</span>
      {indicator.freshnessLabel !== null && (
        <span className="text-muted-foreground">&middot; {indicator.freshnessLabel}</span>
      )}
    </div>
  );
}

export function DataFreshnessSection({ indicators }: { indicators: DataFreshnessIndicators }) {
  if (indicators.market === null && indicators.protocol === null) return null;

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border p-3">
      <h3 className="text-xs font-medium text-foreground">Data Freshness</h3>
      {indicators.market !== null && <Row indicator={indicators.market} />}
      {indicators.protocol !== null && <Row indicator={indicators.protocol} />}
      <p className="text-xs text-muted-foreground">{indicators.refreshNote}</p>
    </div>
  );
}

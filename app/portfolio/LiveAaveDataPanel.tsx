'use client';

import { useEffect } from 'react';

import { useAaveLiveDataStore } from '@/stores/aaveLiveDataStore';

/**
 * Live Aave Data panel — Phase 1 read-only live-data integration.
 * Purely additive/informational: never writes to the portfolio and
 * never touches the manual Collateral/Debt forms below it. Deliberately
 * plain language throughout — no GraphQL/subgraph/contract-address
 * jargon, no Formula IDs, no implementation/debug text (per this
 * batch's own UI direction).
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function formatFreshness(timestamp: string): string {
  const ageMs = Date.now() - Date.parse(timestamp);
  const ageMinutes = Math.floor(ageMs / 60000);
  if (ageMinutes < 1) return 'just now';
  if (ageMinutes === 1) return '1 minute ago';
  if (ageMinutes < 60) return `${ageMinutes} minutes ago`;
  const ageHours = Math.floor(ageMinutes / 60);
  if (ageHours === 1) return '1 hour ago';
  return `${ageHours} hours ago`;
}

export function LiveAaveDataPanel() {
  const status = useAaveLiveDataStore((state) => state.status);
  const marketQuote = useAaveLiveDataStore((state) => state.marketQuote);
  const protocolQuote = useAaveLiveDataStore((state) => state.protocolQuote);
  const errorMessage = useAaveLiveDataStore((state) => state.errorMessage);
  const fetchLiveAaveData = useAaveLiveDataStore((state) => state.fetchLiveAaveData);

  useEffect(() => {
    void fetchLiveAaveData();
  }, [fetchLiveAaveData]);

  const hasPrice = marketQuote !== null && marketQuote.freshness !== 'unavailable';
  const hasProtocol = protocolQuote !== null && protocolQuote.available;
  const hasAnyData = hasPrice || hasProtocol;
  const isLoading = status === 'loading';
  const isErrorWithNoData = status === 'error' && !hasAnyData;

  return (
    <section aria-label="Live Aave data" className="rounded-md border border-border p-4 text-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="text-sm font-semibold text-foreground">Live Aave data</span>
          {hasPrice && marketQuote !== null && (
            <p className="text-xs text-muted-foreground">
              Updated: {formatFreshness(marketQuote.timestamp)}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => void fetchLiveAaveData()}
          disabled={isLoading}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/40 disabled:opacity-50"
        >
          {isLoading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {isLoading && !hasAnyData && (
        <p className="mt-2 text-muted-foreground">Loading live Aave data…</p>
      )}

      {isErrorWithNoData && (
        <p className="mt-2 text-muted-foreground">
          {errorMessage ?? 'Live Aave data is temporarily unavailable.'} You can still enter values
          manually below.
        </p>
      )}

      {status === 'error' && hasAnyData && (
        <p className="mt-2 text-xs text-muted-foreground">
          Couldn&rsquo;t refresh just now — showing the last known values.
        </p>
      )}

      {hasAnyData && (
        <>
          <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {hasPrice && marketQuote !== null && (
              <div>
                <dt className="text-xs text-muted-foreground">BTC price</dt>
                <dd className="text-sm font-medium text-foreground">
                  {formatCurrency(marketQuote.price)}
                </dd>
              </div>
            )}
            {hasProtocol && protocolQuote !== null && protocolQuote.available && (
              <>
                <div>
                  <dt className="text-xs text-muted-foreground">Maximum LTV</dt>
                  <dd className="text-sm font-medium text-foreground">
                    {formatPercent(protocolQuote.parameters.maxLoanToValue)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Liquidation threshold</dt>
                  <dd className="text-sm font-medium text-foreground">
                    {formatPercent(protocolQuote.parameters.liquidationThreshold)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Borrow rate</dt>
                  <dd className="text-sm font-medium text-foreground">
                    {formatPercent(protocolQuote.parameters.borrowApr)}
                  </dd>
                </div>
              </>
            )}
          </dl>

          <p className="mt-3 text-xs text-muted-foreground">
            These values are for reference only. Your portfolio still uses the manual entries below
            until you update them yourself.
          </p>
        </>
      )}
    </section>
  );
}

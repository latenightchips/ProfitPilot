'use client';

import { useAaveLiveDataStore } from '@/stores/aaveLiveDataStore';
import { useDeveloperModeStore } from '@/stores/developerModeStore';
import { deriveAaveDataStatus, formatAaveDataStatus } from '@/utils/aaveDataStatus';

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}

/**
 * Technical details — Portfolio Live-State Cleanup batch. One shared
 * block, gated behind Developer Mode (`useDeveloperModeStore`, M5-022),
 * rather than per-field disclosures — replaces the old reference-only
 * `LiveAaveDataPanel`. Shows verification data (protocol/version,
 * network, block number, method, fetch timestamp) sourced directly from
 * `useAaveLiveDataStore` — never shown to a user with Developer Mode off.
 */
export function AaveTechnicalDetails() {
  const developerMode = useDeveloperModeStore((state) => state.enabled);
  const status = useAaveLiveDataStore((state) => state.status);
  const marketQuote = useAaveLiveDataStore((state) => state.marketQuote);
  const source = useAaveLiveDataStore((state) => state.source);
  const errorMessage = useAaveLiveDataStore((state) => state.errorMessage);

  if (!developerMode) return null;

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-4 text-sm">
      <h2 className="font-medium text-foreground">Technical details</h2>
      <p className="text-xs text-muted-foreground">
        {formatAaveDataStatus(deriveAaveDataStatus(marketQuote))}
      </p>

      {source === null ? (
        <p className="text-xs text-muted-foreground">No live Aave data fetched yet.</p>
      ) : (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <dt className="text-muted-foreground">Protocol/version</dt>
          <dd className="text-foreground">
            {source.protocol} {source.version}
          </dd>
          <dt className="text-muted-foreground">Network</dt>
          <dd className="text-foreground">{source.network}</dd>
          <dt className="text-muted-foreground">Method</dt>
          <dd className="text-foreground">{source.method}</dd>
          <dt className="text-muted-foreground">Block number</dt>
          <dd className="text-foreground">{source.blockNumber}</dd>
          {marketQuote !== null && marketQuote.freshness !== 'unavailable' && (
            <>
              <dt className="text-muted-foreground">Fetched at</dt>
              <dd className="text-foreground">{formatDateTime(marketQuote.timestamp)}</dd>
            </>
          )}
        </dl>
      )}

      {status === 'error' && errorMessage !== null && (
        <p className="text-xs text-destructive">Last refresh failed: {errorMessage}</p>
      )}
    </div>
  );
}

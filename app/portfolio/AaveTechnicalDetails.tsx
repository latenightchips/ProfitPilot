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
 *
 * **`protocolVersion`-aware (v1.23.0 pre-release bugfix).** `useAaveLiveDataStore`
 * is a single global, portfolio-agnostic store — it keeps fetching/holding
 * Aave V3 protocol/network/block metadata regardless of which portfolio is
 * active or what that portfolio's own `protocolVersion` is. Before this
 * fix, this component rendered that V3 metadata unconditionally, so a
 * portfolio configured for Aave V4 could show "Aave V3 · Live" technical
 * details that describe nothing about its own real (V4) position — the
 * confirmed root cause from the v1.23.0 diagnostic pass.
 *
 * **V3 behavior is completely unchanged** for `protocolVersion === 'v3'`
 * or `undefined` (the existing "undefined reads as V3" convention,
 * `utils/protocolStatus.ts`'s own `ProtocolStatusInput.protocolVersion`
 * doc comment) — same store, same fields, same rendering.
 *
 * **No V4 equivalent is fabricated.** There is no canonical V4 source for
 * "network"/"block number"/"method" today — `stores/aaveV4LiveDataStore.ts`'s
 * own `AaveV4LiveDataState` has no such fields at all (confirmed by direct
 * inspection before this fix). Per the diagnostic report's own explicit
 * instruction ("do NOT fabricate equivalent metadata from unrelated
 * sources... render an explicit honest V4/not-applicable/unavailable
 * state"), a V4-configured portfolio instead sees an honest one-line
 * statement that this panel's V3-specific detail is not applicable to it
 * — never a repurposed V3 value, never an invented V4 one.
 */
export function AaveTechnicalDetails({
  protocolVersion,
}: {
  protocolVersion: 'v3' | 'v4' | undefined;
}) {
  const developerMode = useDeveloperModeStore((state) => state.enabled);
  const status = useAaveLiveDataStore((state) => state.status);
  const marketQuote = useAaveLiveDataStore((state) => state.marketQuote);
  const source = useAaveLiveDataStore((state) => state.source);
  const errorMessage = useAaveLiveDataStore((state) => state.errorMessage);

  if (!developerMode) return null;

  if (protocolVersion === 'v4') {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-border p-4 text-sm">
        <h2 className="font-medium text-foreground">Technical details</h2>
        <p className="text-xs text-muted-foreground">
          Not applicable for Aave V4 — this portfolio is configured for Aave V4, which has no live
          protocol/network/block verification data to show here yet.
        </p>
      </div>
    );
  }

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

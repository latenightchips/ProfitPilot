'use client';

import { useAaveV4CollateralRiskLiveSync } from '@/hooks/useAaveV4CollateralRiskLiveSync';
import { useAaveV4LiveSync } from '@/hooks/useAaveV4LiveSync';

/**
 * V4 Readiness Audit §12 Stage 23F — shared V4 sync orchestration boundary.
 * Every page that needs live V4 data mounts both the debt-state sync
 * (`useAaveV4LiveSync`, Stage 7) and the collateral-risk sync
 * (`useAaveV4CollateralRiskLiveSync`, Stage 23F) together, in the same
 * fixed order, every time — this hook exists purely to stop that pairing
 * from being duplicated across five page components and to make it
 * impossible for a future page to wire up one without the other.
 *
 * **Deliberately V4-only — does not touch `useAaveLiveSync` (V3).** V3 and
 * V4 live-sync semantics stay on separate hooks with separate mount call
 * sites, per this stage's own architectural rule ("do not merge V4
 * collateral-risk sync into the V3 protocol-parameter sync path"). Folding
 * `useAaveLiveSync` in here too would blur that boundary for no benefit —
 * V3's sync has no V4-shaped identity to share, and every existing call
 * site already calls it separately, immediately before this hook.
 *
 * **No aggregate return value.** Each underlying hook already exposes its
 * own status via its own store (`useAaveV4LiveDataStore`,
 * `useAaveV4CollateralRiskLiveDataStore`); callers that need to render
 * status (e.g. `deriveProtocolStatus`) read those stores directly, the
 * same way they already do today. This hook's only job is mounting the
 * two sync effects together.
 */
export function useAaveV4Sync(portfolioId: string | null): void {
  useAaveV4LiveSync(portfolioId);
  useAaveV4CollateralRiskLiveSync(portfolioId);
}

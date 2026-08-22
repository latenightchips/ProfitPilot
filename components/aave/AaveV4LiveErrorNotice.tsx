'use client';

import { usePortfolioStore } from '@/stores/portfolioStore';

/**
 * V4 live-fetch error notice — V4 Readiness Audit §12 P0-4. Closes the
 * audit finding: `stores/aaveV4LiveDataStore.ts`/
 * `stores/aaveV4CollateralRiskLiveDataStore.ts` already capture a real,
 * classified `AAVE_V4_*` failure (see those stores' own header comments
 * — `mapAaveV4AdapterFailure`, `services/aave/v4LivePosition.ts`,
 * already converts every adapter error into a safe, display-ready
 * `userMessage` before it ever reaches the Store — "never the adapter's
 * internal message, which may include contract/RPC detail not meant for
 * display"), but no UI surface ever rendered it — users only ever saw a
 * generic status word. This component is the one shared place that does.
 *
 * **No second error-classification system.** This component renders
 * exactly the `code`/`message` `hooks/useAaveV4LiveSync.ts`/
 * `useAaveV4CollateralRiskLiveSync.ts` already recorded into
 * `usePortfolioStore`'s `v4DebtStateErrors`/`v4CollateralRiskErrors`
 * (portfolio-scoped, identity-guarded — see those hooks' own header
 * comments for why a stale/foreign identity's error can never reach
 * here). No parsing, no second mapping table, no fabricated detail —
 * every `AAVE_V4_*` code's `userMessage` was already written to be safe
 * and specific at the adapter layer (timeouts, network errors,
 * unsupported assets, missing positions, contract errors, etc. each get
 * their own distinct, non-technical sentence there); this component only
 * displays it, mirroring `features/dashboard/components/DashboardErrorBanner.tsx`'s
 * own established "message + small 'Error code' line" convention
 * (`role="alert"`, `border-destructive/40 bg-destructive/10`) rather than
 * inventing a new visual style.
 *
 * **One shared component, six mount points** (V4 Readiness Audit §12
 * P0-4's own scope: Portfolio, Dashboard, Simulation, Loop Builder, Exit
 * Planner, Recommendations) — every page that already mounts
 * `hooks/useAaveV4Sync.ts` mounts this too, passing only `portfolioId`.
 * Deliberately NOT folded into `components/strategy/StrategyAssumptionsPanel.tsx`
 * (used by three of the six) — that component's own header comment
 * documents a deliberate "stays free of Zustand... panel is a pure view,
 * caller supplies already-computed state" boundary; this component reads
 * the Store directly (the same way `app/portfolio/AaveV4ConflictConfirmation.tsx`
 * already does for the adjacent P0-1 concern), so it is mounted as a
 * sibling next to that panel at each of the three call sites instead of
 * being merged into it.
 *
 * **Debt and collateral-risk errors are two fully independent notices**,
 * mirroring `AaveV4ConflictConfirmation.tsx`'s own "two independent
 * panels" structure — if only one dimension is failing, only that
 * dimension's notice renders; if both are, both render, neither hidden
 * behind the other.
 *
 * **Preserves the existing protocol-status badge** — this component adds
 * detail alongside `formatProtocolStatus`, it does not replace or
 * recompute it; every existing status badge call site is unchanged.
 *
 * **No retry action here.** Unlike `DashboardErrorBanner`'s own
 * calculation-error case, there is no local `recomputeSummary`-style
 * action to offer — a live V4 fetch retries on its own the next time its
 * mount effect re-runs (address re-save, page remount), the same
 * established behavior this audit was told to preserve, not extend with
 * new polling/retry machinery.
 */
function formatErrorLine(error: { code: string | null; message: string }): {
  message: string;
  code: string | null;
} {
  return { message: error.message, code: error.code };
}

export function AaveV4LiveErrorNotice({ portfolioId }: { portfolioId: string }) {
  const debtError = usePortfolioStore((state) => state.v4DebtStateErrors[portfolioId]);
  const collateralRiskError = usePortfolioStore(
    (state) => state.v4CollateralRiskErrors[portfolioId],
  );

  if (debtError === undefined && collateralRiskError === undefined) return null;

  return (
    <>
      {debtError !== undefined && (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs"
        >
          <p className="font-medium text-destructive">Debt State: live sync failed</p>
          <p className="mt-1 text-destructive">{formatErrorLine(debtError).message}</p>
          {formatErrorLine(debtError).code !== null && (
            <p className="mt-1 text-muted-foreground">
              Error code: {formatErrorLine(debtError).code}
            </p>
          )}
        </div>
      )}
      {collateralRiskError !== undefined && (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs"
        >
          <p className="font-medium text-destructive">Collateral Risk: live sync failed</p>
          <p className="mt-1 text-destructive">{formatErrorLine(collateralRiskError).message}</p>
          {formatErrorLine(collateralRiskError).code !== null && (
            <p className="mt-1 text-muted-foreground">
              Error code: {formatErrorLine(collateralRiskError).code}
            </p>
          )}
        </div>
      )}
    </>
  );
}

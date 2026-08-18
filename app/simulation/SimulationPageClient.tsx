'use client';

import Link from 'next/link';
import { useMemo } from 'react';

import {
  ExportSimulation,
  SaveSimulationForm,
  ScenarioBuilder,
  ScenarioCharts,
  ScenarioComparison,
  ScenarioSummary,
  ScenarioTimeline,
  SimulationAssumptions,
  SimulationWarnings,
} from '@/features/simulation';
import { useAaveV4Sync } from '@/hooks/useAaveV4Sync';
import { useAaveV4CollateralRiskLiveDataStore } from '@/stores/aaveV4CollateralRiskLiveDataStore';
import { useAaveV4LiveDataStore } from '@/stores/aaveV4LiveDataStore';
import { usePortfolioStore } from '@/stores/portfolioStore';
import { deriveProtocolStatus, formatProtocolStatus } from '@/utils/protocolStatus';

/**
 * Simulation Workspace Route — 06_TASKS.md M6-001 ("Create Simulation
 * Workspace") + M6-004 ("Create Scenario Builder") + M6-009 ("Implement
 * Scenario Summary") + M6-010 ("Implement Scenario Comparison") +
 * M6-011 ("Implement Scenario Charts", Batch 10).
 *
 * **Now a client component** — the Scenario Builder (M6-004, Batch 3)
 * needs the active portfolio from `usePortfolioStore` to validate and
 * simulate against, the first Simulation-route content with real data
 * dependencies. `AppSidebar`'s own "Simulation" link (M1-006) still
 * satisfies M6-001's own DoD ("Users can access the Simulation
 * Workspace from the Dashboard") unchanged.
 *
 * **"Simulation sidebar" and "Scenario editor" remain read as the same
 * region** (M6-001's own header comment) — the `<aside>` below is that
 * one consolidated landmark; `ScenarioBuilder` renders inside it without
 * its own duplicate `aria-label`.
 *
 * **No active portfolio → the Scenario Builder cannot render.** A
 * scenario is meaningless without a real portfolio to validate deltas
 * against (collateral/debt withdrawal limits, the protocol's own
 * `maxLoanToValue`) or simulate a price change against — the same
 * "no active portfolio" gate `app/page.tsx` (Dashboard) already
 * establishes, reused here rather than inventing a second pattern.
 *
 * **Both M6-001 placeholders are gone.** "Simulation Results" renders
 * `ScenarioSummary` (Batch 8), immediately followed by "Simulation
 * Assumptions" rendering `SimulationAssumptions` (M6-013, Batch 12) and
 * "Simulation Warnings" rendering `SimulationWarnings` (M6-014, Batch
 * 13) — grouped together directly after Results per `01_PRD.md`'s own
 * Principle Two ("Every displayed number must have a documented
 * origin"), answering "what was assumed"/"what should I be careful
 * about" right next to "what was calculated." "Save Scenario" (new,
 * M6-015, Batch 14) renders `SaveSimulationForm`, the bridge between a
 * currently-active scenario and "Portfolio Comparison" (which renders
 * `ScenarioComparison`, M6-010, Batch 9) — a scenario must be saved
 * before it can appear there — `ScenarioComparison` now also owns
 * loading a saved scenario back (M6-016, Batch 15), so it takes the
 * active `Portfolio` as a prop to detect drift since save time, and
 * owns duplicating one (M6-017, Batch 16) — neither needed a new prop
 * or a new section here, since both act on the same already-rendered
 * `savedScenarios` list.
 * Followed by "Scenario Charts" rendering `ScenarioCharts` (M6-011,
 * Batch 10), then "Scenario Timeline" rendering `ScenarioTimeline`
 * (M6-012, Batch 11) — see each component's own header comment for its
 * full field-mapping/gap reasoning.
 *
 * **"Export" (new, M6-019, Batch 18) renders `ExportSimulation`,
 * placed directly after "Simulation Warnings" and before "Save
 * Scenario"** — a user has now seen the results, assumptions, and
 * warnings for the currently active scenario, and can either export it
 * or save it next. It reads the active `Portfolio` the same way
 * `SimulationAssumptions` already does (for live Protocol Parameters),
 * not a new pattern.
 *
 * **`portfolioNames` (Batch 19, M6-020, "Simulation History") is built
 * here, not inside `ScenarioComparison.tsx`.** Sorting saved scenarios
 * "by Portfolio" needs a human-readable name for every portfolio a
 * saved scenario references — not just the currently active one, since
 * `savedScenarios` is never cleared when the active portfolio changes
 * (M6-003's own independence design). `stores/simulationStore.ts`
 * itself never imports `usePortfolioStore` (its own DoD), and no other
 * Simulation feature component does either — this page is the one
 * place that already reads the full `portfolios` dictionary, so it
 * resolves `{ id: name }` here and passes only that plain map down,
 * the same "page composes across Stores, feature components receive
 * plain props" convention `portfolio`/`portfolioUpdatedAt` already
 * established.
 *
 * **`key={activePortfolioId}` on the results wrapper, plus `portfolioId`
 * passed to `ScenarioBuilder` (M9-012, "Audit State Management" — "No
 * cross-portfolio contamination")** — the same remount-on-switch
 * mechanism `PortfolioDetailsForm` (M4-010) already established for
 * this exact class of problem. The key alone only resets local React
 * state; `useSimulationStore`'s own `currentScenario`/`currentResult`
 * are external Zustand state that survives a remount, so
 * `ScenarioBuilder` also calls `syncActivePortfolio` on mount/
 * `portfolioId` change, which clears that working state only on a
 * genuine portfolio change, never on a same-portfolio remount.
 *
 * **V4 Readiness Audit §12 Stage 24 — mounts `useAaveV4Sync`, and gates
 * the entire Scenario Controls/Results subtree on canonical V4 live
 * status, closing the Stage 24 audit's own P1 finding.** Every other
 * V4-wired page (Dashboard, Portfolio, Loop Builder, Exit Planner,
 * Recommendations) mounts `useAaveV4Sync` so a direct navigation always
 * attempts a fresh sync; Simulation previously mounted neither V3 nor V4
 * sync at all, deliberately relying on whichever other page had already
 * populated the shared `portfolioStore`. That is still correct for V3
 * (unchanged here — see below) but was NOT safe for V4: `v4DebtState`/
 * `v4CollateralRisk` are real fields that persist to local storage and
 * survive a reload, so a portfolio synced once, in a past session, would
 * have both fields present — `calculatePortfolioSummary`'s own
 * `checkAaveV4DebtStateAvailable`/`checkAaveV4CollateralRiskAvailable`
 * guards only fail closed on ABSENCE, not staleness — meaning Simulation
 * would silently compute a full result from however-old that data was,
 * with no indication anywhere on the page that it might not reflect
 * current on-chain debt (which accrues every block).
 *
 * **The fix is two parts, not one** (mounting the hook alone is
 * insufficient — see this stage's own explicit design constraint): (1)
 * `useAaveV4Sync(activePortfolioId)` mounted unconditionally, exactly
 * like the other five pages, so a fresh fetch is always attempted; (2) a
 * new gate, computed via the SAME canonical `deriveProtocolStatus`
 * (`utils/protocolStatus.ts`) every other page already uses for its own
 * status badge — never a second, Simulation-only definition of
 * "current." When `protocolStatus.version === 'v4'` and
 * `protocolStatus.status !== 'live'` (covers `waiting-for-address`,
 * `loading`, `provider-error`, `missing-debt-state`,
 * `missing-collateral-risk`, and `stale` uniformly, via the exact same
 * composed worse-of-two-stores logic `deriveProtocolStatus` already
 * implements — no new sub-state vocabulary invented here), the ENTIRE
 * portfolio-dependent subtree (Scenario Controls aside AND every results
 * section) is replaced by a single status panel instead of rendering
 * `ScenarioBuilder`/`ScenarioSummary`/etc. against untrustworthy data —
 * the same "replace the whole thing with one message" shape the
 * pre-existing "no active portfolio" branch already uses one level up,
 * not a new pattern. This also means `missing-debt-state`/
 * `missing-collateral-risk` are now caught by this outer gate BEFORE
 * `calculatePortfolioSummary`'s own guard would have produced a
 * `ServiceFailure` for the same condition one layer down — one clear
 * message instead of two independently-worded ones for what is the same
 * underlying fact.
 *
 * **`provider-error` renders as a real alert (`role="alert"`,
 * destructive styling)** — a failed refresh must fail visibly, not read
 * as an ordinary transient loading state. Every other non-live sub-state
 * (`loading`, `waiting-for-address`, `missing-debt-state`,
 * `missing-collateral-risk`, `stale`) renders as a neutral `role="status"`
 * panel — none of them are wrong data, they are "not yet confirmed
 * current," which is a different severity than a confirmed failure.
 *
 * **V3/unset is completely untouched.** `protocolStatus.version === 'v3'`
 * is never read by the gate above — only the `'v4'` branch's `status` is
 * ever inspected, so a V3 portfolio's render path is byte-for-byte
 * identical to before this stage, regardless of whatever the V3 branch
 * of `deriveProtocolStatus` itself would have returned (deliberately
 * unused; V3 gets no live sync here, same as always — this stage is a
 * V4-specific correction, not a Simulation semantics rewrite). No
 * `useAaveLiveSync` (V3) mount was added, and none should be — that
 * would be a scope change this stage does not ask for.
 */
export function SimulationPageClient() {
  const activePortfolioId = usePortfolioStore((state) => state.activePortfolioId);
  const record = usePortfolioStore((state) =>
    state.activePortfolioId !== null ? state.portfolios[state.activePortfolioId] : undefined,
  );
  const portfolios = usePortfolioStore((state) => state.portfolios);
  const portfolioNames = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(portfolios).map(([id, portfolioRecord]) => [
          id,
          portfolioRecord.portfolio.name,
        ]),
      ),
    [portfolios],
  );

  // V4 Readiness Audit §12 Stage 24 — see this component's own header
  // comment for the full reasoning. Mounted unconditionally, exactly like
  // the other five V4-wired pages; internally a strict no-op for any
  // portfolio without both `protocolVersion: 'v4'` and `v4Position` set.
  useAaveV4Sync(activePortfolioId);
  const aaveV4Status = useAaveV4LiveDataStore((state) => state.status);
  const aaveV4LastFetchedAt = useAaveV4LiveDataStore((state) => state.lastFetchedAt);
  const aaveV4CollateralRiskStatus = useAaveV4CollateralRiskLiveDataStore((state) => state.status);
  const aaveV4CollateralRiskLastFetchedAt = useAaveV4CollateralRiskLiveDataStore(
    (state) => state.lastFetchedAt,
  );

  // Only the `'v4'` branch of this is ever read below (`v4NotLive`) — the
  // `'v3'` branch's own returned status is deliberately never inspected,
  // preserving V3/V4 isolation structurally, not just by convention.
  const protocolStatus =
    record !== undefined
      ? deriveProtocolStatus({
          protocolVersion: record.portfolio.protocolVersion,
          v4PositionSet: record.portfolio.v4Position !== undefined,
          v4DebtStateSet: record.portfolio.v4DebtState !== undefined,
          aaveMarketQuote: null,
          aaveV4Status,
          aaveV4LastFetchedAt,
          v4CollateralRiskSet: record.portfolio.v4CollateralRisk !== undefined,
          aaveV4CollateralRiskStatus,
          aaveV4CollateralRiskLastFetchedAt,
          v4DebtStateSource: record.portfolio.v4DebtStateSource,
          v4CollateralRiskSource: record.portfolio.v4CollateralRiskSource,
          now: new Date().toISOString(),
        })
      : null;
  // V4 Readiness Audit §12 Stage 25 — `'manual'` is calculation-ready,
  // exactly like `'live'` (see `deriveProtocolStatus`'s own header
  // comment): a manual/hypothetical V4 portfolio must not be blocked
  // here merely because it has no wallet address. This is the ONE
  // targeted change to the Stage 24 gate itself — the gate's own
  // fail-closed shape (block on anything else) is unchanged.
  const v4NotLive =
    protocolStatus?.version === 'v4' &&
    protocolStatus.status !== 'live' &&
    protocolStatus.status !== 'manual';
  const v4ProviderError =
    protocolStatus?.version === 'v4' && protocolStatus.status === 'provider-error';

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Simulation</h1>
        <p className="text-sm text-muted-foreground">&ldquo;What happens if...?&rdquo;</p>
      </div>

      {activePortfolioId === null || record === undefined ? (
        <p className="text-sm text-muted-foreground">
          No portfolio is currently selected.{' '}
          <Link href="/portfolios" className="underline">
            Select or create one
          </Link>{' '}
          to build a scenario.
        </p>
      ) : v4NotLive && protocolStatus !== null ? (
        <div
          role={v4ProviderError ? 'alert' : 'status'}
          className={
            v4ProviderError
              ? 'rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm'
              : 'rounded-md border border-border bg-muted/40 p-4 text-sm'
          }
        >
          <p
            className={
              v4ProviderError ? 'font-medium text-destructive' : 'font-medium text-foreground'
            }
          >
            Simulation is not available yet.
          </p>
          <p className="mt-1 text-muted-foreground">
            Simulation requires current Aave V4 debt and collateral-risk data for this portfolio — a
            previously-synced value is not shown as a substitute for a live one.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {formatProtocolStatus(protocolStatus)}
          </p>
          <p className="mt-3">
            <Link href="/portfolio" className="underline">
              Go to Portfolio
            </Link>{' '}
            to check or sync this portfolio&rsquo;s Aave V4 data.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6 lg:flex-row" key={activePortfolioId}>
          <aside
            aria-label="Scenario Controls"
            className="flex flex-col gap-2 rounded-md border border-border p-4 lg:w-80 lg:shrink-0"
          >
            <h2 className="text-sm font-medium text-foreground">Scenario Controls</h2>
            <ScenarioBuilder portfolio={record.portfolio} portfolioId={record.portfolio.id} />
          </aside>

          <div className="flex flex-1 flex-col gap-6">
            <section className="flex flex-col gap-2 rounded-md border border-border p-4">
              <h2 className="text-sm font-medium text-foreground">Simulation Results</h2>
              <ScenarioSummary />
            </section>
            <section className="flex flex-col gap-2 rounded-md border border-border p-4">
              <h2 className="text-sm font-medium text-foreground">Simulation Assumptions</h2>
              <SimulationAssumptions portfolio={record.portfolio} />
            </section>
            <section className="flex flex-col gap-2 rounded-md border border-border p-4">
              <h2 className="text-sm font-medium text-foreground">Simulation Warnings</h2>
              <SimulationWarnings portfolio={record.portfolio} />
            </section>
            <section className="flex flex-col gap-2 rounded-md border border-border p-4">
              <h2 className="text-sm font-medium text-foreground">Export</h2>
              <ExportSimulation portfolio={record.portfolio} />
            </section>
            <section className="flex flex-col gap-2 rounded-md border border-border p-4">
              <h2 className="text-sm font-medium text-foreground">Save Scenario</h2>
              <SaveSimulationForm
                portfolioId={record.portfolio.id}
                portfolioUpdatedAt={record.portfolio.updatedAt}
              />
            </section>
            <section className="flex flex-col gap-2 rounded-md border border-border p-4">
              <h2 className="text-sm font-medium text-foreground">Portfolio Comparison</h2>
              <ScenarioComparison portfolio={record.portfolio} portfolioNames={portfolioNames} />
            </section>
            <section className="flex flex-col gap-2 rounded-md border border-border p-4">
              <h2 className="text-sm font-medium text-foreground">Scenario Charts</h2>
              <ScenarioCharts />
            </section>
            <section className="flex flex-col gap-2 rounded-md border border-border p-4">
              <h2 className="text-sm font-medium text-foreground">Scenario Timeline</h2>
              <ScenarioTimeline />
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

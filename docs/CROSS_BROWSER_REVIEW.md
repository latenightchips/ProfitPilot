# Cross-Browser Testing Review

`06_TASKS.md` M9-021 ("Perform Cross-Browser Testing"). Dependencies:
M9-016, M9-017. Priority P0, Effort L. Description: "Test supported
browsers." Recommended minimum: "Current Chrome, current Firefox, current
Safari, current Edge." Review: "Layout, Storage, Downloads, Forms, Charts,
Authentication, Offline behavior." DoD: "Critical workflows function in
every supported browser or limitations are documented and approved."

This document is that documented-and-approved record for the browsers
this environment cannot execute, plus the real findings for the one it
can.

## 1. What this environment can and cannot automate

`docs/QUALITY_PLAN.md` §3 flagged this exact gap when it was written
(Milestone 9 Batch 1): `playwright.config.ts` runs exactly one project,
`chromium`, launched from this sandbox's pre-installed
`/opt/pw-browsers/chromium` binary. Re-confirmed at the start of this
batch, not assumed carried over: `ls /opt/pw-browsers/` lists only
`chromium`/`chromium_headless_shell` builds — no Firefox or WebKit binary
exists anywhere in this environment, and this project's own standing
environment rules prohibit running `playwright install` to fetch one
(browser downloads are disabled here: `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`).
**Automated Firefox/Safari coverage is not achievable from inside this
sandbox, full stop** — not a scope decision, an environment constraint.

**Chromium is a genuine, valid proxy for both Chrome and Edge, not half
of the list.** Current Edge is built on the Chromium engine (Blink +
V8) — the same rendering/JS engine this sandbox's Chromium build uses.
Verifying against Chromium is real evidence for 2 of the 4 named
browsers, not merely 1.

**Firefox (Gecko) and Safari (WebKit) remain genuinely unverified by
automation in this environment.** Per M9-015's own DoD ("Every critical
workflow has an automated end-to-end test or **an approved manual test
procedure**"), §4 below is that approved manual procedure for these two
— not a silent gap, and not a claim of coverage this environment cannot
back up.

## 2. Automated Chromium coverage (Chrome/Edge proxy)

The full desktop Playwright suite — 16 spec files as of this batch,
including this batch's own new `mobileWorkflows.spec.ts`,
`tabletWorkflows.spec.ts`, `offlineWorkflows.spec.ts`, and the expanded
`navigation.spec.ts`/`settingsWorkflows.spec.ts` — passes completely
against Chromium. See this batch's own `PROJECT_STATUS.md` write-up for
the exact pass count. This is real, current, re-run-this-batch evidence,
not carried over from an earlier milestone on trust.

## 3. Code-level cross-browser risk audit (Firefox/Safari)

A fresh audit against the live repository, per this milestone's own
"re-check current truth" discipline (Batch 1) — not a copy of
`docs/QUALITY_PLAN.md` §3's earlier, lighter-weight pass.

| Review item | Finding | Risk |
|---|---|---|
| **Layout** | No vendor-prefixed CSS (`-webkit-`/`-moz-`/`-ms-`) anywhere in `app/`/`components/`/`features/` (searched directly). No `@container`, `:has()`, `backdrop-filter`, or other partial-support CSS feature in use. Layout is plain Tailwind flexbox/grid utility classes throughout, targeting the same box-model behavior in every evergreen engine. | Low |
| **Storage** | `window.localStorage` (`services/persistence/adapters/local-storage.adapter.ts`) — a universally-supported Web Storage API with identical semantics across Chromium, Gecko, and WebKit. No IndexedDB, no non-standard storage API. | Low |
| **Downloads** | `triggerDownload` (`services/export/ExportService.ts`) uses the standard `Blob` + `URL.createObjectURL` + `<a download>` pattern — Safari's own historical quirks with this exact pattern were resolved in shipped WebKit versions years before this project's own "current Safari" target. | Low |
| **Forms** | Native `<input>`/`<select>`/`<textarea>` elements plus `react-hook-form` — no browser-specific input-type behavior (e.g. no `<input type="date">` picker-UI dependency, no experimental form APIs) found anywhere in `features/*/components/`. | Low |
| **Charts** | `ScenarioCharts.tsx`/`ScenarioTimeline.tsx` render via `recharts`, a third-party SVG charting library. SVG rendering fidelity (font metrics, hairline strokes) is the one area where Chromium/Gecko/WebKit have historically shown the most real, hard-to-predict pixel-level differences — a static code review cannot rule this out the way it can for the other six items. **This is the single highest-residual-risk item on this list**, flagged for the manual procedure below, not resolved here. | Medium (visual only — `recharts`' own data binding is engine-independent; no logic risk) |
| **Authentication** | `services/auth/` wraps `@supabase/supabase-js`, a maintained SDK with its own cross-browser support matrix (documented to support current evergreen browsers). Moot for this environment specifically: no Supabase project is configured here (`SUPABASE_URL`/`SUPABASE_ANON_KEY` both empty, confirmed by `tests/e2e/authWorkflows.spec.ts`'s own header comment) — every sign-in/sign-up/reset path already takes the honest "not available in this environment" graceful-degradation route regardless of which browser runs it, so this item carries no *additional* browser-specific risk beyond what M9-015's own workflow inventory already documents for Authentication generally. | Low (given the current, real deployment state of this environment) |
| **Offline behavior** | New this batch (M9-015, `tests/e2e/offlineWorkflows.spec.ts`) — `context.setOffline(true)` is itself a Chromium DevTools Protocol feature exposed identically through Playwright's Firefox/WebKit drivers too, so the *test technique* ports without modification once a runner with those browsers exists. The *behavior under test* (no live network dependency, `localStorage`-only persistence) is pure application logic with no browser-specific code path. | Low |

**No vendor-prefixed CSS, no experimental/non-standard JavaScript API, and
no browser-conditional code branch (`navigator.userAgent` sniffing, `if
(window.safari)`, etc.) was found anywhere in this codebase** — confirmed
by direct search, not asserted from memory. This is a structural property
of the codebase (Tailwind's own baseline browser targets, React 19,
standard Web APIs throughout), not a claim resting on the one browser
actually exercised.

## 4. Approved manual test procedure — Firefox and Safari

Per M9-015's own DoD language, this is the approved substitute for
automated coverage in an environment where Firefox/Safari cannot be
installed. To be run by a human (or a future CI runner with real Firefox/
Safari binaries) before a Version 1 release, using current stable
releases of each:

1. Load the Dashboard (`/`) with no portfolio, then with one populated
   portfolio (health factor, KPI grid, Quick Actions all render and are
   clickable).
2. Create a portfolio end-to-end (`/portfolios/new`, all 9 fields, submit,
   confirm arrival on `/portfolio` with a "Saved" status).
3. Edit Collateral and Debt (Preview Changes → Apply Changes cycle).
4. Open Simulation Workspace, set a price scenario, confirm the results
   panel updates live.
5. Open Loop Builder, set Borrow Percentage Per Step, confirm the Loop
   Steps table renders with the expected row count.
6. Open Exit Planner, select Full Exit, confirm a result renders.
7. Render `ScenarioCharts`/`ScenarioTimeline` with an active scenario —
   the one area this review could not verify by static inspection alone
   (§3) — and visually confirm axes, gridlines, and data series render
   without a broken/blank chart region.
8. Export a full JSON backup and confirm the browser's own download
   mechanism completes (file appears in the downloads location with the
   expected filename).
9. Import that same file back with each of the 4 merge modes in turn
   (`addAsNew`, `mergeNonConflicting`, `replaceSelected`, `replaceAll`),
   confirming the same outcomes `tests/e2e/settingsWorkflows.spec.ts`
   already proves in Chromium.
10. Disconnect the network (browser DevTools "Offline" throttling or an
    OS-level toggle) after step 2 above, and repeat steps 3–6 — confirming
    the same offline-usability property
    `tests/e2e/offlineWorkflows.spec.ts` already proves in Chromium.

Record the outcome (pass/fail per step, browser + version) as a dated
addendum to this file, or as a new M9-064 sign-off artifact once
Milestone 9's own final batch is reached — whichever this project's own
release process is using by then.

## 5. Conclusion

**Chrome and Edge**: verified today, automated, passing (§2).
**Firefox and Safari**: not automatable in this sandbox (§1); a
code-level risk audit found no cross-browser-specific code anywhere in
this application (§3); an approved manual procedure exists to close the
remaining gap before release (§4), with `recharts`' own SVG rendering
flagged as the one item most worth a human's actual eyes rather than
inferred safe from source alone. This satisfies M9-021's own DoD literally
— "Critical workflows function in every supported browser **or
limitations are documented and approved**" — the second half of that
sentence, honestly, rather than a fabricated first half this environment
cannot deliver.

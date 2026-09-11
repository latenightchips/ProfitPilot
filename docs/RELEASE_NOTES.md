# Release Notes

`06_TASKS.md` M10-004 ("Prepare Release Notes") — Milestone 10 Batch 1.
Dependencies: M10-003. Description: "Document major features, known
limitations, supported browsers, supported devices, storage options,
authentication options, import/export capabilities, breaking changes,
upgrade instructions." DoD: "Release notes accurately describe Version 1."

This document is new — distinct from `docs/CHANGELOG.md`, which is an
engineering audit trail organized by version/milestone. This is a
release-facing summary of what the current release actually is, for
someone deciding whether and how to run it. See `docs/USER_GUIDE.md` for
full usage instructions and `docs/CHANGELOG.md` for the complete build
history and version-metadata record.

## Version 1.24.0

**Current release.** Post-`v1.23.0` Release Reconciliation — eight
independent commits applied directly to `main`: Loop Builder minimum-HF
wording fix (`10f0c50`), Loop Builder raw warning-identifier cleanup
(`74eabb1`), Recommendations `expectedEffect` wording fix (`8b426ac`),
Portfolio History protocol-switch snapshot fix (`1254b6e`), Portfolio
Creation V4 provenance fix (`fb09f38`), Portfolio Creation V4
phantom-history-entry fix (`7e6f877`), consolidated Aave V4 regression
hardening (`57e15fd`, test-only, zero production diff), and
Dashboard/Portfolio History Trends removal (`d729a49`) — each built,
tested, and independently re-verified in the commit that produced it,
not a fresh Milestone-9/V1.1-style Release Candidate process with its
own new manual exploratory pass. See `PROJECT_STATUS.md`'s "v1.24.0
Release Reconciliation" section and `docs/CHANGELOG.md`'s `[1.24.0]`
entry for the full record. Everything in "Version 1.23.0" and earlier
below still applies; this section covers only what is new since 1.23.0.
**Still a self-hostable software release, not a hosted product** — see
"Deployment" below, unchanged from Version 1.0.0.

### What's new in 1.24.0

**No new feature.** This release is entirely correctness fixes,
regression-test hardening, and a UI simplification.

- **Loop Builder's minimum-Health-Factor safety-stop wording is now
  consistent** between its own analysis copy and the raw reason
  identifier surfaced to users.
- **Recommendations no longer show a fabricated dollar figure and
  resulting Health Factor when no action is actually needed.** The
  Additional Collateral and Repayment recommendations now say plainly
  that no action is needed in that case, instead of always stating a
  specific (and, in that case, meaningless) numeric outcome.
- **Switching a portfolio's protocol version now reliably shows up in
  Portfolio History.** A genuine, material change from switching
  protocol version or updating your Aave V4 position could previously
  go unrecorded; it's now captured the same way every other portfolio
  change already is.
- **Creating a new Aave V4 portfolio no longer mislabels manually-typed
  debt data as "live."** Your wallet-position and base-drawn-APR
  provenance are now each judged only by what you actually did for that
  specific field.
- **Creating a new Aave V4 portfolio no longer writes a meaningless
  placeholder entry to Portfolio History before your real V4 data has
  synced.** The first real snapshot for a new V4 portfolio now reflects
  your actual debt/collateral-risk state, not an interim zero-debt
  guess.
- **The Dashboard's "Trends" section and Portfolio History's own trend
  chart are gone.** A read-only UX audit found every chart metric
  already duplicated a value shown elsewhere on the same page, with no
  time axis, tooltip, or current-value emphasis of its own — and that
  Portfolio History only records a new snapshot on a materially
  different change, so most of those charts could rarely show a real
  trend in the first place. Every number is still there: the Dashboard's
  existing current-value panels are unchanged, and Portfolio History's
  table and mobile-card views — including every before→after delta,
  protocol badge, and data-source badge — are exactly as they were.

### What this is not

**This is a correctness/hardening/cleanup release, not a new Aave V4
capability.** No new formula, no new persisted field, no new user
workflow, no Engine change (verified: `git diff v1.23.0..HEAD --
engine/` touches only two files' own output-text template, never a
computed value or a `FORMULA_VERSION`). It does **not**: add any new
financial calculation; add any new Portfolio, Loop Builder, Exit
Planner, or Simulation input you didn't already have; change what data
Aave V4 creation collects or requires; or resolve Health Factor
risk-band classification (Conflict #1), the Exit Readiness Formula ID
gap (Conflict #11), the F-067 component-formula gap (Conflict #12), the
Interest Cost category's F-065 gap, cost basis, P&L, total return, or
any operated production deployment.

**Your Portfolio History data is completely unaffected by the Trends
removal.** Nothing about how history is recorded, persisted,
deduplicated, or displayed in table/card form changed — only the
decorative chart layer on top of it is gone. If you exported or relied
on any value a Trend chart ever showed, it remains exactly as visible
today in the table/card view it always duplicated.

### Explicitly unchanged in 1.24.0

**No financial formula changed, and no Formula ID was assigned.** Every
Engine function computes exactly what it did before. **`STORAGE_SCHEMA_VERSION`
stays `1.0.0`** — no persisted field was added, changed, or removed.
**No V3/V4 semantic change** — `services/portfolio/mapping.ts`,
`hooks/useAaveV4LiveSync.ts`, and `hooks/useAaveV4CollateralRiskLiveSync.ts`
are all untouched. `services/export/CsvExporter.ts` and
`services/export/JsonExporter.ts` are both untouched — the Trends
removal never had its own export column to begin with. No Simulation or
Exit Planner calculation file was touched.

## Version 1.23.0 (previous release)

Promotes Safety Targets Status Batches 1–3 plus a
pre-release Aave V4 correctness/clarity bugfix on top of Version 1.22.0:
Batch 1, Portfolio Page Safety Targets Status Panel
(`edae4d578b88cea34a03efae61b84a90e2b153ab`); Batch 2, Dashboard Safety
Targets Status Integration (`95c2e4ec2f98693cc02396da9ce73f5d62fcf026`);
Batch 3, Safety Targets Cross-Surface Consistency Proof (test-only, zero
production diff, `87cd0306d8d3d2d1cbd2536280939ebf125e04cc`); and the
pre-release bugfix, Aave V4 Technical Details & Unsaved Manual-State
Clarity (`26f7936a123019b0bb43dae3f2aa337fede4d504`) — built, tested, and
independently re-verified in the batches that produced them, not a fresh
Milestone-9/V1.1-style Release Candidate process with its own new manual
exploratory pass. See `PROJECT_STATUS.md`'s "v1.23.0 Release
Reconciliation" section and `docs/CHANGELOG.md`'s `[1.23.0]` entry for
the full record. Everything in "Version 1.22.0" and earlier below still
applies; this section covers only what is new since 1.22.0. **Still a
self-hostable software release, not a hosted product** — see
"Deployment" below, unchanged from Version 1.0.0.

### What's new in 1.23.0

- **The Portfolio page now shows a read-only "Safety Targets Status"
  panel.** For each of your four configured Safety Targets (Target
  Health Factor, Holding Period, Target BTC Price, Safety Buffer %), it
  shows your current value alongside your configured target and whether
  it's Met, Not met, Not configured, or Not available — computed
  independently per field, never as one all-or-nothing state.
- **The Dashboard now shows a compact Safety Targets Status summary**
  in its Overview group, presenting the exact same status as the
  Portfolio page's own panel — proven, not just asserted, to derive from
  the same single calculation rather than a second, independently
  recalculated one — with a link to the Portfolio page for full detail.
- **Verified consistent with your CSV export**, for target values and,
  where applicable, current values, across fully configured, fully
  absent, partial, valid-zero, and multi-portfolio scenarios — proven
  directly, not merely assumed. No CSV/export code changed.
- **Aave V4 Technical Details (Developer Mode) no longer shows Aave V3
  data for a portfolio configured for Aave V4.** Before this release, a
  V4-configured portfolio's Technical Details could still display the
  last Aave V3 live fetch's protocol/network/block information — data
  that describes nothing about that portfolio's real (V4) position. It
  now shows an honest "Not applicable for Aave V4" message instead, and
  never fabricates a V4 equivalent that doesn't exist yet.
- **The manual Aave V4 debt-assumptions form now says whether what
  you're looking at is saved.** Before this release, an entirely
  unsaved form (showing default `0` values) looked identical to a
  genuinely saved all-zero debt assumption. It now shows "Not saved
  yet" until you press Save, and "Showing your saved Aave V4 debt
  assumptions" once you have — a real, persisted `0` is still exactly
  as valid as before and is never treated as missing.

### What this is not

**This is a status-visibility feature and an Aave V4 correctness/clarity
fix, not a new financial capability.** No new formula, no new persisted
field, no Engine change (verified: `git diff v1.22.0..HEAD -- engine/`
returns empty output). Safety Targets themselves — setting your own
Target Health Factor, Holding Period, Target BTC Price, and Safety
Buffer % — were already configurable on the Portfolio page before this
release (since before `v1.22.0`); this release only adds the ability to
see how your current position compares to what you've already
configured. It does not evaluate your targets into a recommendation,
does not add Quantified Impact or Apply-to-Portfolio support for them,
and does not add any live Aave V4 network/block/method verification
data that doesn't already exist — the Technical Details fix states that
absence honestly rather than inventing one. It does **not**: change your
CSV or JSON export in any way; change what an address is required for
(none, for manual V4 assumptions, exactly as before); or resolve Health
Factor risk-band classification (Conflict #1), the Exit Readiness
Formula ID gap (Conflict #11), the F-067 component-formula gap (Conflict
#12), the Interest Cost category's F-065 gap, cost basis, P&L, total
return, or any operated production deployment.

### Explicitly unchanged in 1.23.0

**No financial formula changed, and no Formula ID was assigned.** Every
Engine function is byte-for-byte unchanged. **`STORAGE_SCHEMA_VERSION`
stays `1.0.0`** — no persisted field was added, changed, or removed.
**No V3/V4 semantic change** — `services/portfolio/mapping.ts`,
`hooks/useAaveV4LiveSync.ts`, and `hooks/useAaveV4CollateralRiskLiveSync.ts`
are all untouched; V4 zero values remain valid, never "missing"; missing
required V4 state remains fail-closed; manual V4 assumptions still
require no wallet/address. `services/export/CsvExporter.ts` and
`services/export/JsonExporter.ts` are both untouched. No Simulation,
Loop Builder, or Exit Planner file was touched. No recommendation-engine
file was touched.

## Version 1.22.0 (previous release)

Promotes three batches on top of Version 1.21.0,
together titled "Portfolio CSV Export Completeness, Part 2 — Safety
Targets + User Guide Accuracy": Batch 1, Safety Targets CSV Columns;
Batch 2, Safety Targets CSV/JSON Cross-Export Consistency Proof
(test-only, zero production diff); and Batch 3, User Guide Accuracy
Pass (documentation-only) — built, tested, and independently
re-verified in the batches that produced them, not a fresh
Milestone-9/V1.1-style Release Candidate process with its own new
manual exploratory pass. See `PROJECT_STATUS.md`'s "v1.22.0 Release
Reconciliation" section and `docs/CHANGELOG.md`'s `[1.22.0]` entry for
the full record. Everything in "Version 1.21.0" and earlier below still
applies; this section covers only what is new since 1.21.0. **Still a
self-hostable software release, not a hosted product** — see
"Deployment" below, unchanged from Version 1.0.0.

### What's new in 1.22.0

- **The Portfolio Positions CSV export now includes your Safety
  Targets**, if you've set them on the Portfolio page: Target Health
  Factor, Holding Period (Days), Target BTC Price (USD), and Safety
  Buffer (%).
- **Anything you haven't configured shows "Not available"** — the same
  convention this export already uses everywhere else, including a
  genuine `0` for Holding Period (Days) or Safety Buffer (%), which is
  never confused with a missing value.
- **Checked against your JSON backup**, field by field, to confirm both
  exports agree on the same underlying data.
- **The User Guide is now accurate about the Dashboard and export
  options.** The Dashboard section describes what's actually there
  today — Data Freshness, your core metrics, a read-only Starting-Value
  Baseline panel, and Recommended Actions — and is explicit that the
  Dashboard cannot set or reset your baseline and cannot configure your
  Recommendation Preferences; both stay on the Portfolio page. The
  "Your data" section now explains the CSV export options (Portfolio
  Positions, Scenario Comparisons, Loop Steps, Exit Plan Breakdowns)
  alongside the Full Backup, and is explicit that CSV cannot be
  imported and is not a substitute for a Full Backup.

### What this is not

**This is a data-export completeness change and a documentation-accuracy
pass, not a new financial capability.** No new formula, no new persisted
data — the Safety Targets fields this release adds to CSV were already
saved by your portfolios (since `v1.17.0`). Safety Targets are your own
configured targets, not a computed recommendation — nothing in this
release evaluates them or tells you whether your position currently
meets them. It does not change your JSON backup format at all. It does
not resolve Health Factor risk bands, Exit Readiness, the Interest Cost
warning gap, cost basis, P&L, or total return.

### Explicitly unchanged in 1.22.0

No financial formula changed, no persisted-data schema version changed,
no migration required, no V3/V4 semantic change. The JSON backup/export
format is completely unaffected by this release. Still no live wallet
connection or transaction execution, still no cloud backup or
synchronization, still no publicly operated production deployment.

## Version 1.21.0 (previous release)

Promotes three implementation batches on top of Version 1.20.0, together
titled "Portfolio CSV Export Field Completeness": Batch 1, Starting-Value
Baseline CSV Columns; Batch 2, Recommendation Preferences CSV Columns;
and Batch 3, CSV/JSON Cross-Export Consistency Proof (test-only, zero
production diff) — built, tested, and independently re-verified in the
batches that produced them, not a fresh Milestone-9/V1.1-style Release
Candidate process with its own new manual exploratory pass. See
`PROJECT_STATUS.md`'s "v1.21.0 Release Reconciliation" section and
`docs/CHANGELOG.md`'s `[1.21.0]` entry for the full record. Everything
in "Version 1.20.0" and earlier below still applies; this section
covers only what is new since 1.20.0. **Still a self-hostable software
release, not a hosted product** — see "Deployment" below, unchanged
from Version 1.0.0.

### What's new in 1.21.0

- **The Portfolio Positions CSV export now includes your Starting-Value
  Baseline facts**, if you've set one on the Portfolio page: when it
  was established, the collateral quantity, and the BTC price at that
  moment.
- **The CSV export now also includes your Recommendation Preferences**,
  if you've configured them on Portfolio Details: your minimum Health
  Factor for borrowing, target Debt Ratio ceiling, Loop borrow
  percentage, and maximum acceptable annual interest cost.
- **Anything you haven't configured shows "Not available"** — the same
  convention this export already uses everywhere else, never a blank
  cell or a guessed value.
- **Checked against your JSON backup**, field by field, to confirm both
  exports agree on the same underlying data.

### What this is not

**This is a data-export completeness change, not a new financial
capability.** No new formula, no new persisted data — everything this
release adds to CSV was already saved by your portfolios. It does not
show your baseline's current value or change since baseline in the CSV
(that stays only on the Dashboard and Portfolio page). It does not
evaluate your preferences to tell you whether a recommendation is
currently available. It does not change your JSON backup format at
all. It does not resolve Health Factor risk bands, Exit Readiness, the
Interest Cost warning gap, cost basis, P&L, or total return.

### Explicitly unchanged in 1.21.0

No financial formula changed, no persisted-data schema version changed,
no migration required, no V3/V4 semantic change. The JSON backup/export
format is completely unaffected by this release. Still no live wallet
connection or transaction execution, still no cloud backup or
synchronization, still no publicly operated production deployment.

## Version 1.20.0 (previous release)

Promotes two implementation batches on top of Version 1.19.0, together
titled "Dashboard Starting-Value Baseline Visibility": Batch 1,
Dashboard Starting-Value Baseline Section — Service/View Reuse +
Dashboard Wiring; and Batch 2, Cross-Page Integration Proof +
Deterministic `portfolioStore` `updatedAt` Test Hardening (no production
defect found) — built, tested, and independently re-verified in the
batches that produced them, not a fresh Milestone-9/V1.1-style Release
Candidate process with its own new manual exploratory pass. See
`PROJECT_STATUS.md`'s "v1.20.0 Release Reconciliation" section and
`docs/CHANGELOG.md`'s `[1.20.0]` entry for the full record. Everything
in "Version 1.19.0" and earlier below still applies; this section
covers only what is new since 1.19.0. **Still a self-hostable software
release, not a hosted product** — see "Deployment" below, unchanged
from Version 1.0.0.

### What's new in 1.20.0

- **The Dashboard now shows your Starting-Value Baseline, if you've set
  one on the Portfolio page.** A new "Performance since [date]" section
  appears near the top of the Dashboard, showing the same baseline
  value, current value, and change since baseline you already see on
  the Portfolio page.
- **If your BTC quantity has changed since your baseline was set**, the
  Dashboard shows the same "Composition changed since baseline" note
  the Portfolio page shows — the numbers stay visible, just qualified.
- **If you haven't set a baseline yet**, the Dashboard says so plainly
  and links you to the Portfolio page to set one.
- **No new button on the Dashboard.** Setting or resetting a baseline
  still happens only on the Portfolio page — the Dashboard only shows
  what's already been set.
- **Verified to match exactly** between the Dashboard and the Portfolio
  page, for the same portfolio.

### What this is not

**This is a visibility change, not a new financial capability.** No new
formula, no new persisted data, no new calculation. It does not add a
way to set or reset a baseline from the Dashboard. It does not add cost
basis, profit/loss, or total return — the Starting-Value Baseline
remains a simple performance reference point, not an accounting record,
exactly as it was when introduced in `v1.17.0`. It does not resolve
Health Factor risk bands, Exit Readiness, the Interest Cost warning gap,
or any operated production deployment.

### Explicitly unchanged in 1.20.0

No financial formula changed, no persisted-data schema version changed,
no migration required, no V3/V4 semantic change. The Starting-Value
Baseline calculation itself — and the Portfolio page's own panel — are
completely unaffected by this release, same calculation, same wording,
same behavior as before. Still no live wallet connection or transaction
execution, still no cloud backup or synchronization, still no publicly
operated production deployment.

## Version 1.19.0 (previous release)

Promotes three implementation batches on top of Version 1.18.0, together
titled "Dashboard Recommendation Summary Parity": Batch 1, Service
Integration; Batch 2, UI Wiring; and Batch 3, Integration/E2E Hardening —
built, tested, and independently re-verified in the batches that
produced them, not a fresh Milestone-9/V1.1-style Release Candidate
process with its own new manual exploratory pass. See
`PROJECT_STATUS.md`'s "v1.19.0 Release Reconciliation" section and
`docs/CHANGELOG.md`'s `[1.19.0]` entry for the full record. Everything in
"Version 1.18.0" and earlier below still applies; this section covers
only what is new since 1.18.0. **Still a self-hostable software release,
not a hosted product** — see "Deployment" below, unchanged from Version
1.0.0.

### What's new in 1.19.0

- **The Dashboard now shows Borrow and Loop recommendations, alongside
  Repayment and Additional Collateral.** If you've configured a Borrow
  or Loop preference pair on Portfolio Details (added in `v1.18.0`) and
  that recommendation currently has something to say, it now appears on
  the Dashboard too, not only in the Recommendation Center.
- **Order is fixed and predictable**: Repayment, Additional Collateral,
  Borrow, Loop. An item that isn't configured, or is currently fine, is
  simply left out — never shown with a made-up value.
- **The wording matches what you'd see in the Recommendation Center** —
  the same reworded, "your configured limits" phrasing, not a second,
  differently written version of the same message.
- **Verified through the real app, not just isolated tests**: a
  configured Borrow/Loop preference survives closing and reopening the
  application, and still shows up correctly on the Dashboard afterward.

### What this is not

**This is a display change, not a new recommendation capability.** No
new formula, no new preference field, no new category. It does not add
Quantified Impact (before/after numbers) or an Apply-to-Portfolio button
for Borrow/Loop on the Dashboard or the Recommendation Center — neither
existed for Borrow/Loop before, and neither is added now. It does not
suggest a specific amount to borrow or loop. It does not add an
explanation for why a Borrow or Loop recommendation is missing when it's
missing — the Dashboard has never explained an omitted "already
satisfied" Repayment or Additional Collateral recommendation either, and
this release extends that same, already-established behavior to
Borrow/Loop rather than inventing a new one. It does not resolve Health
Factor risk bands, Exit Readiness, the Interest Cost warning gap, cost
basis, P&L, or total return — each remains open for its own previously-
documented reason.

### Explicitly unchanged in 1.19.0

No financial formula changed, no persisted-data schema version changed,
no migration required, no V3/V4 semantic change. Repayment and
Additional Collateral are completely unaffected — same calculations,
same wording, same behavior as before this release. Still no live wallet
connection or transaction execution, still no cloud backup or
synchronization, still no publicly operated production deployment.

## Version 1.18.0 (previous release)

Promotes four implementation batches on top of
Version 1.17.0, together titled "Recommendation Preferences": Batch 1,
Schema and Persistence; Batch 2, Service Integration; Batch 3,
Recommendation Center Wiring and Portfolio Preference UI; and Batch 4,
Presentation-Language Layer and E2E/Accessibility Hardening — built,
tested, and independently re-verified in the batches that produced them,
preceded by a dedicated specification phase, not a fresh Milestone-9/
V1.1-style Release Candidate process with its own new manual exploratory
pass. See `PROJECT_STATUS.md`'s "v1.18.0 Release Reconciliation" section
and `docs/CHANGELOG.md`'s `[1.18.0]` entry for the full record.
Everything in "Version 1.17.0" and earlier below still applies; this
section covers only what is new since 1.17.0. **Still a self-hostable
software release, not a hosted product** — see "Deployment" below,
unchanged from Version 1.0.0.

### What's new in 1.18.0

- **The Portfolio page now has a "Recommendation preferences" section**
  where you can optionally tell ProfitPilot the limits you'd want
  respected if it suggested borrowing more or looping again: a minimum
  Health Factor and a target Debt Ratio ceiling for borrowing, and a loop
  borrow percentage and a maximum acceptable annual interest cost for
  looping. Every field starts empty — nothing is pre-filled or suggested.
- **Once you've filled in both fields of a pair, the matching
  recommendation becomes real in the Recommendation Center.** Fill in
  both Borrow fields and a real Borrow recommendation appears; fill in
  both Loop fields and a real Loop recommendation appears. The two pairs
  are independent — you can configure one, both, or neither.
- **If a pair is empty or only half-filled, the Recommendation Center
  tells you exactly what to configure**, instead of just leaving that
  category blank or showing a generic "unavailable" message.
- **Repayment and Additional Collateral recommendations work exactly as
  they always have**, whether or not you ever touch these new
  preferences.
- **Borrow and Loop recommendations now read like a plain description of
  your own limits, not a bare instruction.** Instead of "Stop Looping,"
  you'll see something like "One more loop step would currently exceed
  at least one of your configured Loop limits." Click into the
  recommendation's detail view and the original wording, current values,
  and Formula ID are all still there — this is a rewording of the
  headline text only, nothing is hidden.
- **Works the same way whether your portfolio is manually entered, Aave
  V3, or Aave V4.**

### What this is not

**This does not turn ProfitPilot's recommendations into automated
financial advice.** Every recommendation is still a deterministic
calculation from your own configured preferences and your portfolio's
current numbers — nothing here is AI-generated, predictive, or
personalized beyond the exact values you enter. It does not add a "not
financial advice" disclaimer (none existed before, and this release
doesn't introduce the concept). It does not add Borrow/Loop
recommendations to the Dashboard's own summary — that stays exactly as
it was. It never suggests, pre-fills, or defaults to any specific
Health Factor, Debt Ratio, borrow percentage, or interest-cost number —
you decide every value, or leave it blank. It does not resolve why
Safety, Exit Readiness, or Interest Cost recommendations remain
unavailable — each still has its own separate, previously-documented
reason, unrelated to this feature.

### Explicitly unchanged in 1.18.0

No financial formula changed, no persisted-data schema version changed,
no migration required to use this feature, no V3/V4 semantic change.
Repayment and Additional Collateral recommendations are completely
unaffected — same calculations, same wording, same behavior as before
this release. Still no live wallet connection or transaction execution,
still no cloud backup or synchronization, still no publicly operated
production deployment.

## Version 1.17.0 (previous release)

Promotes two implementation batches on top of
Version 1.16.0, together titled "Starting-Value Baseline": Batch 1, Data
Model/Persistence/Store/Comparison, and Batch 2, Portfolio Page UI —
built, tested, and independently re-verified in the batches that
produced them, preceded by a dedicated specification phase, not a fresh
Milestone-9/V1.1-style Release Candidate process with its own new manual
exploratory pass. See `PROJECT_STATUS.md`'s "v1.17.0 Release
Reconciliation" section and `docs/CHANGELOG.md`'s `[1.17.0]` entry for
the full record. Everything in "Version 1.16.0" and earlier below still
applies; this section covers only what is new since 1.16.0.

### What's new in 1.17.0

- **The Portfolio page now has a "Performance" panel** where you can
  mark a starting point for tracking how your position's value changes
  over time. Click **"Set Baseline Now"** and ProfitPilot records your
  current collateral quantity and current BTC/WBTC price as that
  portfolio's baseline.
- **Once set, the panel shows "Baseline value," "Current value," and
  "Change since baseline"** (both the dollar amount and the percentage),
  computed from that recorded starting point against your portfolio's
  live state today.
- **"Change since baseline" means exactly what it says — nothing more.**
  It is a plain price-movement comparison: has your collateral's dollar
  value gone up or down since you set the baseline, given today's price?
  It does not account for debt, interest, fees, or anything else — see
  "What this is not," below.
- **If you edit your collateral quantity, apply a Loop or Exit strategy,
  or otherwise change how much collateral you hold, you'll see a
  "Composition changed since baseline" note.** This means the comparison
  no longer reflects price movement alone — part of the change is now
  from the quantity itself, not just the market. Your baseline is never
  silently reset or blended when this happens; the note is informational,
  and the figures stay visible.
- **"Reset Baseline"** lets you start over at any time — one click
  replaces the recorded baseline with your portfolio's current state, no
  confirmation prompt required.
- **Works the same way whether your portfolio is manually entered, Aave
  V3, or Aave V4** — nothing about this feature depends on which.
- **Your baseline is included in a full backup/export and restored on
  import**, exactly like every other portfolio setting.

### What this is not

**This is a reference point for tracking price movement, not accounting
software.** ProfitPilot does not know what you actually paid for your
BTC, and this feature makes no claim about that. It is explicitly **not**
cost basis, acquisition cost, tax accounting, profit/loss (P&L), total
return, realized return, realized interest, or lot/transaction-history
tracking. It also does not factor in your debt — it compares collateral
value only, never a net-of-debt figure — and it does not represent
interest you've paid, protocol yield earned, or execution/gas costs
actually incurred. If you're looking for real cost-basis or profit/loss
accounting, that remains a possible future consideration, not something
this release delivers.

### Explicitly unchanged in 1.17.0

No financial formula changed, no persisted-data schema version changed,
no migration required to use this feature, no V3/V4 semantic change.
Portfolio History (the automatic snapshot timeline elsewhere on this same
page) is completely unaffected — setting or resetting a baseline never
creates a history entry, and the two remain separate, clearly labeled
sections. Still no live wallet connection or transaction execution, still
no cloud backup or synchronization, still no publicly operated production
deployment.

## Version 1.16.0 (previous release)

Promotes one batch on top of Version 1.15.0, titled "Settings About —
Version Transparency": Settings About Section — built, tested, and
independently re-verified (final count 4385/4385 tests passing) in the
same batch that produced it, not a fresh Milestone-9/V1.1-style Release
Candidate process with its own new manual exploratory pass. See
`PROJECT_STATUS.md`'s "v1.16.0 Release Reconciliation" section and
`docs/CHANGELOG.md`'s `[1.16.0]` entry for the full record. Everything in
"Version 1.15.0" and earlier below still applies; this section covers
only what is new since 1.15.0. **Still a self-hostable software release,
not a hosted product** — see "Deployment" below, unchanged from Version
1.0.0.

### What's new in 1.16.0

- **Settings now has an "About" section**, showing Application Version,
  Formula Version, and Calculation Engine Version — real, live values,
  not hardcoded strings.
- **Deliberately partial.** License, Data Provider, and Last
  Synchronization are not shown — each is still blocked on its own
  unresolved product decision (no license chosen yet; no agreed wording
  for a manual-entry application's "data provider"; Cloud Synchronization
  is cancelled, so what this field would even mean is undecided). This
  is not the full About section a future release might complete, only
  what is currently unblocked.

### Explicitly unchanged in 1.16.0

No financial formula changed, no Formula ID added, no persisted-data
schema changed, no migration, no Service or Store file changed, no new
protocol API call, no V3/V4 semantic change — this release introduces no
protocol-version branching anywhere, and reads no portfolio or protocol
data at all; the About section displays three static build-time
constants. Still no live wallet connection or transaction execution,
still no cloud backup or synchronization, still no publicly operated
production deployment.

## Version 1.15.0 (previous release)

Promotes three batches on top of Version 1.14.0,
together titled "Dashboard Information Architecture — Trend/Current-State
Separation": Trends Group + Health & Risk Trend Migration (Batch 1),
Composition & Debt Trend Migration (Batch 2), and Overview Trend
Migration + Final Regression Cleanup (Batch 3) — built, tested, and
independently re-verified (final count 4379/4379 tests passing) in the
same batches that produced them, not a fresh Milestone-9/V1.1-style
Release Candidate process with its own new manual exploratory pass. See
`PROJECT_STATUS.md`'s "v1.15.0 Release Reconciliation" section and
`docs/CHANGELOG.md`'s `[1.15.0]` entry for the full record. Everything in
"Version 1.14.0" and earlier below still applies; this section covers
only what is new since 1.14.0. **Still a self-hostable software release,
not a hosted product** — see "Deployment" below, unchanged from Version
1.0.0.

### What's new in 1.15.0

- **The Dashboard now has a dedicated "Trends" section**, centralizing
  all 14 existing historical trend charts that were previously scattered
  across Overview, Health & Risk, and Composition & Debt. Overview,
  Health & Risk, and Composition & Debt now show current-state content
  only — separating "what is my position right now" from "how has it
  changed over time" as two distinct, predictable places to look.
  Recommended Actions is unchanged.
- **No chart's own behavior changed.** Every relocated trend chart is a
  pre-existing component, moved without modification — same data, same
  calculation, same formatting, same provenance handling, only a
  different position on the page.

### Explicitly unchanged in 1.15.0

No financial formula changed, no Formula ID added, no persisted-data
schema changed, no migration, no Engine/Service/Store file changed, no
new protocol API call, no V3/V4 semantic change (every relocated chart's
own protocol-version handling — including Supply APR's V4 "Not
applicable" case — is exactly as it was before relocation), no
historical value is recomputed or normalized differently, still no live
wallet connection or transaction execution, still no cloud backup or
synchronization, still no publicly operated production deployment.

## Version 1.14.0 (previous release)

Promotes three batches on top of Version 1.13.0,
together titled "Dashboard Trend Parity, Part 2": Collateral Value + Debt
Value Dashboard Trend Charts (Batch 1), Collateral Quantity + Debt
Quantity Dashboard Trend Charts (Batch 2), and Supply APR Dashboard Trend
Chart (Batch 3) — built, tested, and independently re-verified (final
count 4374/4374 tests passing) in the same batches that produced them,
not a fresh Milestone-9/V1.1-style Release Candidate process with its own
new manual exploratory pass. See `PROJECT_STATUS.md`'s "v1.14.0 Release
Reconciliation" section and `docs/CHANGELOG.md`'s `[1.14.0]` entry for
the full record. Everything in "Version 1.13.0" and earlier below still
applies; this section covers only what is new since 1.13.0. **Still a
self-hostable software release, not a hosted product** — see
"Deployment" below, unchanged from Version 1.0.0.

### What's new in 1.14.0

- **The Dashboard now shows five more trend charts**: Collateral Value,
  Debt Value, Collateral Quantity, Debt Quantity, and Supply APR —
  completing the Dashboard's own mirror of every metric Portfolio
  History's chart selector has offered since `v1.12.0`–`v1.13.0`.
- **Collateral/Debt Value and Quantity** read the same already-persisted
  fields Portfolio History has charted since `v1.12.0`, directly — never
  derived from one another or from market price. Debt Quantity shows
  each historical point's own real debt-asset symbol, correctly handling
  a portfolio whose borrowed asset changed between snapshots.
- **Supply APR** reads `entry.supplyApr` directly; a V4 entry's
  permanently-unavailable Supply APR renders as "Not applicable," never
  a fabricated percentage.
- **No historical point is recomputed using current portfolio state,
  and no live oracle or Aave lookup was introduced** for any of the five
  new Dashboard surfaces.

### Explicitly unchanged in 1.14.0

No financial formula changed, no Formula ID added, no persisted-data
schema changed, no migration, no Engine file changed, no new protocol
API call, no V3/V4 semantic change (every new chart reads identically
for both protocol versions, and Supply APR's V4 "Not applicable" case
uses the same established, permanent semantic Portfolio History already
uses), still no live wallet connection or transaction execution, still
no cloud backup or synchronization, still no publicly operated
production deployment.

## Version 1.13.0 (previous release)

Promotes five batches on top of Version 1.12.0,
together titled "Portfolio History & Simulation Completeness, Part 3":
Protocol-Version Provenance Badge (Batch 1), Supply APR Portfolio History
Chart Metric (Batch 2), Simulation `ScenarioSummary` Debt + Liquidation
Price (Batch 3), Dashboard Section Grouping (Batch 4), and Multi-Scenario
Comparison Debt + Liquidation Price (Batch 5) — built, tested, and
independently re-verified (final count 4319/4319 tests passing) in the
same batches that produced them, not a fresh Milestone-9/V1.1-style
Release Candidate process with its own new manual exploratory pass. See
`PROJECT_STATUS.md`'s "v1.13.0 Release Reconciliation" section and
`docs/CHANGELOG.md`'s `[1.13.0]` entry for the full record. Everything in
"Version 1.12.0" and earlier below still applies; this section covers
only what is new since 1.12.0. **Still a self-hostable software release,
not a hosted product** — see "Deployment" below, unchanged from Version
1.0.0.

### What's new in 1.13.0

- **Portfolio History now shows a protocol-version provenance badge**
  per entry, reading each snapshot's own persisted `protocolVersion`
  ("Aave V3"/"Aave V4") directly — legible even for a portfolio that has
  since switched protocol versions.
- **Portfolio History's chart selector now includes Supply APR**,
  reading `entry.supplyApr` directly; shown as "Not applicable" for V4
  entries, which never carry this field, distinct from "Not available."
- **Saved Simulation scenarios now carry their own Debt and Liquidation
  Price**, shown both on the active scenario's Simulation Results and,
  new this release, as two additional rows in the multi-scenario
  Comparison table — each column reading directly from that scenario's
  own already-computed result, never recomputed and never repeated
  across scenarios. A scenario with no debt shows Liquidation Price as
  `—`, the same "no liquidation risk" convention used elsewhere.
- **The Dashboard is now organized into four labeled sections** —
  Overview, Health & Risk, Composition & Debt, and Recommended Actions —
  making its long single-column layout easier to navigate. No section's
  own content changed or moved out of place.
- **No historical points are recomputed using current portfolio state,
  and no live oracle or Aave lookup was introduced** for the provenance
  badge or Supply APR — both read only what Portfolio History already
  persisted at each snapshot's own creation time.

### Explicitly unchanged in 1.13.0

No financial formula changed, no Formula ID added, no persisted-data
schema changed, no migration, no new protocol API call, no V3/V4
semantic change (every new field and badge is read identically for both
protocol versions), still no live wallet connection or transaction
execution, still no cloud backup or synchronization, still no publicly
operated production deployment. `savedScenarios` remains pure in-memory
state — the new Debt/Liquidation Price fields carry no backward-
compatibility concern, since no saved scenario is ever persisted across
a reload.

## Version 1.12.0 (previous release)

Promotes five batches on top of Version 1.11.0,
together titled "Portfolio History Field Completeness Part 2": Collateral
Value & Debt Value chart parity (Batch 1), Collateral Quantity chart
metric (Batch 2), Debt Quantity chart metric (Batch 3), Portfolio History
data-source provenance (Batch 4), and Dependabot dependency-update
automation (Batch 5) — built, tested, and independently re-verified
(4282/4282 tests passing) in the same batches that produced them, not a
fresh Milestone-9/V1.1-style Release Candidate process with its own new
manual exploratory pass. See `PROJECT_STATUS.md`'s "v1.12.0 Release
Reconciliation" section and `docs/CHANGELOG.md`'s `[1.12.0]` entry for the
full record. Everything in "Version 1.11.0" and earlier below still
applies; this section covers only what is new since 1.11.0. **Still a
self-hostable software release, not a hosted product** — see
"Deployment" below, unchanged from Version 1.0.0.

### What's new in 1.12.0

- **Portfolio History's chart selector now includes Collateral Value and
  Debt Value**, reading `entry.collateral.valueUsd`/`entry.debt.valueUsd`
  directly, alongside the metrics already shipped through 1.11.0.
- **Portfolio History's chart selector now includes Collateral Quantity**,
  reading `entry.collateral.quantity` directly.
- **Portfolio History's chart selector now includes Debt Quantity**,
  reading `entry.debt.quantity` directly — the debt-asset symbol shown in
  the formatted value comes from that same history entry's own
  `debt.asset`, never assumed or hardcoded, so it stays correct for a
  portfolio whose borrowed asset changed between snapshots.
- **Portfolio History now shows a data-source provenance badge** on each
  entry, reflecting that entry's own persisted `dataSource` (`manual` or
  `live`) — never inferred or recomputed after the fact.
- **Dependency updates are now scanned automatically.**
  `.github/dependabot.yml` opens pull requests monthly for available
  `npm`/`pnpm` and GitHub Actions updates, grouping minor/patch bumps and
  leaving major bumps for individual review. **This only opens PRs — it
  does not approve, merge, or deploy anything;** every PR still goes
  through the full validation pipeline and manual review before a human
  merges it, same as any other dependency change.
- **No historical points are recomputed using current portfolio
  state, and no live oracle or Aave lookup was introduced** for any of
  the new chart metrics or the provenance badge — all four read only
  what Portfolio History already persisted at each snapshot's own
  creation time, the same read-only discipline every existing trend
  chart already follows.

### Explicitly unchanged in 1.12.0

No financial formula changed, no Formula ID added, no persisted-data
schema changed, no migration, no Engine file changed, no new protocol
API call, no V3/V4 semantic change (every new metric and the provenance
badge read identically for both protocol versions), still no live
wallet connection or transaction execution, still no cloud backup or
synchronization, still no publicly operated production deployment.
Dependabot does not change CI behavior, does not auto-merge, and does
not bypass review — it only surfaces available updates as ordinary pull
requests.

## Version 1.11.0 (previous release)

Promotes the Borrow APR Trend Completion work (two
batches: Portfolio History Borrow APR trend support, and Dashboard
Borrow APR trend) below out of Unreleased status — built, tested, and
independently re-verified (4250/4250 tests passing, both in the
implementation worktree and again after applying the delivered patch to
a clean checkout) in the same batches that produced it, not a fresh
Milestone-9/V1.1-style Release Candidate process with its own new manual
exploratory pass. See `PROJECT_STATUS.md`'s "v1.11.0 Release
Reconciliation" section and `docs/CHANGELOG.md`'s `[1.11.0]` entry for
the full record. Everything in "Version 1.10.0" and earlier below still
applies; this section covers only what is new since 1.10.0. **Still a
self-hostable software release, not a hosted product** — see
"Deployment" below, unchanged from Version 1.0.0.

### What's new in 1.11.0

- **Portfolio History's chart selector, table, and mobile card view now
  include Borrow APR** as a ninth metric, reading `entry.borrowApr`
  directly — no new formula, no recomputation.
- **The Dashboard now shows a matching Borrow APR trend chart**, placed
  with the existing debt/interest analytics, directly after the
  Annualized Interest Cost trend chart.
- **A V4 portfolio with no synced debt state yet renders "Not
  available"** on both surfaces — never a fabricated `0%`, interpolated,
  or inferred value, and distinct from `liquidationPriceUsd === null`'s
  own "No liquidation risk" text elsewhere on Portfolio History and the
  Dashboard.
- **The Dashboard chart requires at least two usable (non-missing)
  observations before drawing a line** — with fewer, it shows the latest
  recorded value as text instead of fabricating a second point.
- **Historical points only** — no chart recomputes a value from today's
  portfolio state, and no live oracle or Aave lookup was introduced for
  any historical point.

### Explicitly unchanged in 1.11.0

No financial formula changed, no Formula ID added, no persisted-data
schema changed, no migration, no Engine file changed, no new protocol
API call, no V3/V4 semantic change (`borrowApr` is read identically for
both protocol versions on both surfaces), still no live wallet
connection or transaction execution, still no cloud backup or
synchronization, still no publicly operated production deployment.
Collateral quantity and debt balance remain always-manual for both
protocol versions.

## Version 1.10.0 (previous release)

Promoted the Dashboard Trend Parity work (three batches: Net Worth +
Loan-to-Value, Leverage + Market Price, and Liquidation Price) below out
of Unreleased status — built, tested, and independently re-verified
(4229/4229 tests passing, both in the implementation worktree and again
after applying the delivered patch to a clean checkout) in the same
batches that produced it, not a fresh Milestone-9/V1.1-style Release
Candidate process with its own new manual exploratory pass. See
`PROJECT_STATUS.md`'s "v1.10.0 Release Reconciliation" section and
`docs/CHANGELOG.md`'s `[1.10.0]` entry for the full record. Everything in
"Version 1.9.0" and earlier below still applies; this section covers
only what was new since 1.9.0. **Still a self-hostable software release,
not a hosted product** — see "Deployment" below, unchanged from Version
1.0.0.

### What's new in 1.10.0

- **The Dashboard now shows five more trend charts**: Net Worth,
  Loan-to-Value, Leverage, Market Price, and Liquidation Price —
  completing its mirror of every metric Portfolio History's own chart
  selector has offered since v1.3.0–v1.6.0, alongside the three
  Dashboard trend charts already shipped (Health Factor, Liquidation
  Buffer, Annualized Interest Cost).
- **Net Worth** uses the same already-established `collateral.valueUsd -
  debt.valueUsd` derivation `PortfolioHistoryPanel.tsx` already uses;
  the other four read their persisted fields directly, with no
  derivation of their own.
- **A zero-debt portfolio's Liquidation Price renders "No liquidation
  risk"** — the same established text used elsewhere, never a
  fabricated `$0`.
- **Historical points only** — no chart recomputes a value from today's
  portfolio state, and no live oracle or current market-price lookup
  was introduced for any historical point.
- **Placed adjacent to each metric's own closest existing panel** on the
  Dashboard — Net Worth and Loan-to-Value near the Core KPI Grid,
  Leverage near the Leverage Summary, and Market Price and Liquidation
  Price grouped with the Liquidation Risk Panel.

### Explicitly unchanged in 1.10.0

No financial formula changed, no Formula ID added, no persisted-data
schema changed, no migration, no Engine file changed, no new protocol
API call, no V3/V4 semantic change (none of the five new charts branch
on protocol version), still no live wallet connection or transaction
execution, still no cloud backup or synchronization, still no publicly
operated production deployment. Collateral quantity and debt balance
remain always-manual for both protocol versions.

## Version 1.9.0 (previous release)

Promoted the Dashboard Annualized Interest Cost Trend batch described
below out of Unreleased status — built, tested, and independently
re-verified (4180/4180 tests passing, both in the implementation
worktree and again after applying the delivered patch to a clean
checkout) in the same batch that produced it, not a fresh
Milestone-9/V1.1-style Release Candidate process with its own new manual
exploratory pass. See `PROJECT_STATUS.md`'s "v1.9.0 Release
Reconciliation" section and `docs/CHANGELOG.md`'s `[1.9.0]` entry for
the full record. Everything in "Version 1.8.0" and earlier below still
applies; this section covers only what is new since 1.8.0. **Still a
self-hostable software release, not a hosted product** — see
"Deployment" below, unchanged from Version 1.0.0.

### What's new in 1.9.0

- **The Dashboard now shows an Interest Cost (annualized) Trend chart**,
  directly below the existing Debt and Interest panel, completing the
  Dashboard's trend-chart set alongside v1.7.0's Health Factor Trend and
  v1.8.0's Liquidation Buffer Trend — reading the same already-persisted
  Portfolio History `annualizedInterestCost` values
  `PortfolioHistoryPanel.tsx` already charts, through the identical
  service call. No new persistence path.
- **Reads the persisted field directly** — no derived-helper layer,
  unlike Liquidation Buffer's own percentage calculation.
- **A point-in-time projection, never a running total** — each plotted
  point is the projected annual borrowing cost implied by that
  snapshot's own debt and rate, never interest already paid, cumulative
  interest, realized cost, or interest paid since inception.
- **Always a plain number** — unlike Health Factor and Liquidation
  Buffer, this field is never null and never varies by protocol
  version, so there is no "no risk" state and no V3/V4 branching.
- **Explicit non-chart states**: zero entries reads "No Interest Cost
  (annualized) history yet"; a single entry (including a `$0.00` one)
  shows its own value as plain text rather than a fabricated one-point
  line; 2+ entries render an accessible, chronologically ordered chart.

### Explicitly unchanged in 1.9.0

No financial formula changed, no Formula ID added, no persisted-data
schema changed, no migration, no Engine file changed, no new protocol
API call, no V3/V4 semantic change (the chart never branches on
protocol version), still no live wallet connection or transaction
execution, still no cloud backup or synchronization, still no publicly
operated production deployment. Collateral quantity and debt balance
remain always-manual for both protocol versions.

## Version 1.8.0 (previous release)

Promoted the Dashboard Liquidation Buffer Trend Visibility batch
described below out of Unreleased status — built, tested, and
independently re-verified (4169/4169 tests passing, both in the
implementation worktree and again after applying the delivered patch to
a clean checkout) in the same batch that produced it, not a fresh
Milestone-9/V1.1-style Release Candidate process with its own new manual
exploratory pass. See `PROJECT_STATUS.md`'s "v1.8.0 Release
Reconciliation" section and `docs/CHANGELOG.md`'s `[1.8.0]` entry for
the full record. Everything in "Version 1.7.0" and earlier below still
applies; this section covers only what is new since 1.7.0. **Still a
self-hostable software release, not a hosted product** — see
"Deployment" below, unchanged from Version 1.0.0.

### What's new in 1.8.0

- **The Dashboard now shows a Liquidation Buffer Trend chart**, directly
  below the existing Liquidation Risk panel, completing the risk-trend
  pairing started by v1.7.0's Health Factor Trend chart — reading the
  same already-persisted Portfolio History `marketPriceUsd`/
  `liquidationPriceUsd` values `PortfolioHistoryPanel.tsx` already
  charts, through the identical service call. No new persistence path.
- **Reuses the v1.6.0 `calculateLiquidationBufferPercent` helper
  verbatim** — never the Engine's separate, live-computed F-025
  `calculateLiquidationBuffer`, which continues unchanged as
  `LiquidationRiskPanel`'s own current-value figure.
- **Presentation/read-layer only** — every plotted value comes directly
  from an already-persisted history entry, never recomputed from
  today's portfolio state or a new formula.
- **No Health Factor risk-band classification is introduced.**
  Conflict #1 remains exactly as unresolved as before.
- **Explicit non-chart states**: zero entries reads "No Liquidation
  Buffer history yet"; a single entry shows its own value as plain text
  rather than a fabricated one-point line; 2+ entries render an
  accessible, chronologically ordered chart.
- **`null` (zero-debt, or an unavailable denominator per the existing
  helper's own contract) renders "No liquidation risk," never a
  fabricated `0%`, `NaN`, or `Infinity`.** Positive, zero, and negative
  buffers are all shown without clamping.

### Explicitly unchanged in 1.8.0

No financial formula changed, no Formula ID added, no persisted-data
schema changed, no migration, no Engine file changed, no new protocol
API call, no V3/V4 semantic change (the chart never branches on
protocol version), still no live wallet connection or transaction
execution, still no cloud backup or synchronization, still no publicly
operated production deployment. Collateral quantity and debt balance
remain always-manual for both protocol versions.

## Version 1.7.0 (previous release)

Promoted the Dashboard Health Factor Trend Visibility batch described
below out of Unreleased status — built, tested, and independently
re-verified (4155/4155 tests passing, both in the implementation
worktree and again after applying the delivered patch to a clean
checkout) in the same batch that produced it, not a fresh
Milestone-9/V1.1-style Release Candidate process with its own new manual
exploratory pass. See `PROJECT_STATUS.md`'s "v1.7.0 Release
Reconciliation" section and `docs/CHANGELOG.md`'s `[1.7.0]` entry for
the full record. Everything in "Version 1.6.0" and earlier below still
applies; this section covers only what is new since 1.6.0. **Still a
self-hostable software release, not a hosted product** — see
"Deployment" below, unchanged from Version 1.0.0.

### What's new in 1.7.0

- **The Dashboard now shows a Health Factor Trend chart**, directly
  below the existing Health Factor Status section — reading the same
  already-persisted Portfolio History `healthFactor` values
  `PortfolioHistoryPanel.tsx` already charts, through the identical
  service call. No new persistence path.
- **Presentation/read-layer only** — every plotted value comes directly
  from an already-persisted history entry, never recomputed from
  today's portfolio state or a new formula.
- **No Health Factor risk-band classification is introduced.**
  Conflict #1 (four disagreeing band-threshold schemes) remains exactly
  as unresolved as before.
- **Explicit non-chart states**: zero entries reads "No Health Factor
  history yet"; a single entry shows its own value as plain text rather
  than a fabricated one-point line; 2+ entries render an accessible,
  chronologically ordered chart.
- **Null (zero-debt) Health Factor renders "∞," never `NaN` or a
  fabricated value** — the same established convention used everywhere
  else in the application.

### Explicitly unchanged in 1.7.0

No financial formula changed, no Formula ID added, no persisted-data
schema changed, no migration, no Engine file changed, no new protocol
API call, no V3/V4 semantic change (the chart never branches on
protocol version), still no live wallet connection or transaction
execution, still no cloud backup or synchronization, still no publicly
operated production deployment. Collateral quantity and debt balance
remain always-manual for both protocol versions.

## Version 1.6.0 (previous release)

Promoted the Liquidation Buffer Visibility batch described below out of
Unreleased status — built, tested, and independently re-verified
(4145/4145 tests passing, both in the implementation worktree and again
after applying the delivered patch to a clean checkout) in the same
batch that produced it, not a fresh Milestone-9/V1.1-style Release
Candidate process with its own new manual exploratory pass. See
`PROJECT_STATUS.md`'s "v1.6.0 Release Reconciliation" section and
`docs/CHANGELOG.md`'s `[1.6.0]` entry for the full record. Everything in
"Version 1.5.0" and earlier below still applies; this section covers
only what is new since 1.5.0. **Still a self-hostable software release,
not a hosted product** — see "Deployment" below, unchanged from Version
1.0.0.

### What's new in 1.6.0

- **Portfolio History now shows a Liquidation Buffer.** An eighth
  metric, added after Liquidation Price in the desktop table, the
  mobile card list, the before/after delta display, and the trend
  chart's metric selector.
- **It is the percentage distance between a snapshot's own market price
  and its estimated liquidation price**:
  `(marketPriceUsd − liquidationPriceUsd) / marketPriceUsd`.
- **This is display/service-layer derived analytics, not a new Engine
  formula.** Unlike every prior Portfolio History metric, this one is
  not a directly persisted field made visible — it is computed on read
  from the two already-persisted, already-rendered fields `1.5.0`
  exposed. No new Formula ID, no persisted field of its own.
- **A zero-debt (`null`) Liquidation Price continues to mean "no
  liquidation risk," now for the buffer too** — never a fabricated `0%`
  and never `Infinity`. Positive, zero, and negative buffers are all
  shown without clamping.

### Explicitly unchanged in 1.6.0

No financial formula changed, no Formula ID added, no persisted-data
schema changed, no migration, no Engine file changed, no new protocol
API call, no V3/V4 semantic change (the buffer calculation never
branches on protocol version), still no live wallet connection or
transaction execution, still no cloud backup or synchronization, still
no publicly operated production deployment. Collateral quantity and
debt balance remain always-manual for both protocol versions.

## Version 1.5.0 (previous release)

Promoted the Portfolio Analytics — Price & Liquidation Trend Visibility
batch described below out of Unreleased status — built, tested, and
independently re-verified (4119/4119 tests passing, both in the
implementation worktree and again after applying the delivered patch to
a clean checkout) in the same batch that produced it, not a fresh
Milestone-9/V1.1-style Release Candidate process with its own new manual
exploratory pass. See `PROJECT_STATUS.md`'s "v1.5.0 Release
Reconciliation" section and `docs/CHANGELOG.md`'s `[1.5.0]` entry for
the full record. Everything in "Version 1.4.0" and earlier below still
applies; this section covers only what is new since 1.4.0. **Still a
self-hostable software release, not a hosted product** — see
"Deployment" below, unchanged from Version 1.0.0.

### What's new in 1.5.0

- **Portfolio History now shows Market Price and Liquidation Price.**
  Two new columns/card entries appear in the desktop table and mobile
  card list, currency-formatted, reading the already-persisted
  `marketPriceUsd`/`liquidationPriceUsd` fields directly — computed
  since V1.1 Batch 2 but never previously surfaced anywhere.
- **Both fields' before/after deltas are now shown too**, reusing the
  comparison logic that already existed but was unused by the UI, with
  the same "before → after (delta)" convention every other column uses.
- **The trend chart gains two more metrics**, bringing the selector to
  seven: Market Price and Liquidation Price, alongside the five metrics
  V1.3.0/V1.4.0 already shipped.
- **A zero-debt Liquidation Price reads "No liquidation risk," never
  "∞" or a fabricated price** — the same wording this field already
  uses elsewhere in the application (Apply-to-Portfolio review,
  Recommendation detail), stated plainly rather than borrowed from
  Health Factor's own unrelated convention.

### Explicitly unchanged in 1.5.0

No financial formula changed, no persisted-data schema changed, no
migration, no Engine file changed, no new protocol API call, no V3/V4
semantic change (both fields are computed identically for both protocol
versions), still no live wallet connection or transaction execution,
still no cloud backup or synchronization, still no publicly operated
production deployment. Collateral quantity and debt balance remain
always-manual for both protocol versions.

## Version 1.4.0 (previous release)

Promoted the Annualized Interest Cost Visibility batch described below
out of Unreleased status — built, tested, and independently re-verified
(4108/4108 tests passing, both in the implementation worktree and again
after applying the delivered patch to a clean checkout) in the same
batch that produced it, not a fresh Milestone-9/V1.1-style Release
Candidate process with its own new manual exploratory pass. See
`PROJECT_STATUS.md`'s "v1.4.0 Release Reconciliation" section and
`docs/CHANGELOG.md`'s `[1.4.0]` entry for the full record. Everything in
"Version 1.3.0" and earlier below still applies; this section covers
only what is new since 1.3.0. **Still a self-hostable software release,
not a hosted product** — see "Deployment" below, unchanged from Version
1.0.0.

### What's new in 1.4.0

- **Portfolio History now shows Annualized Interest Cost.** A new
  column/card entry ("Interest Cost (annualized)") appears in the
  desktop table and mobile card list, currency-formatted, reading the
  already-persisted `annualizedInterestCost` field directly — computed
  since V1.1 Batch 2 but never previously surfaced anywhere.
- **Its before/after delta is now shown too**, reusing the comparison
  logic that already existed but was unused by the UI, with the same
  "before → after (delta)" convention every other column uses.
- **The trend chart gains a fifth metric**: Interest Cost (annualized),
  alongside the four V1.3.0 metrics, using the same chart architecture.
- **This is a point-in-time projection, not interest paid.** Both the
  table header and card label carry a short tooltip stating plainly that
  this figure is the annualized cost implied by one snapshot's own debt
  and rate — never interest already paid, cumulative interest, realized
  borrowing cost, or interest paid since inception.

### Explicitly unchanged in 1.4.0

No financial formula changed, no persisted-data schema changed, no
Engine file changed, no new protocol API call, no V3/V4 semantic change
(the field is computed identically for both protocol versions), still no
live wallet connection or transaction execution, still no cloud backup
or synchronization, still no publicly operated production deployment.
Collateral quantity and debt balance remain always-manual for both
protocol versions.

## Version 1.3.0 (previous release)

Promoted the Portfolio Analytics / Trend Visibility batch described
below out of Unreleased status — built, tested, and independently
re-verified (4100/4100 tests passing, both in the implementation
worktree and again after applying the delivered patch to a clean
checkout) in the same batch that produced it, not a fresh
Milestone-9/V1.1-style Release Candidate process with its own new manual
exploratory pass. See `PROJECT_STATUS.md`'s "v1.3.0 Release
Reconciliation" section and `docs/CHANGELOG.md`'s `[1.3.0]` entry for the
full record. Everything in "Version 1.2.0" and earlier below still
applies; this section covers only what is new since 1.2.0. **Still a
self-hostable software release, not a hosted product** — see
"Deployment" below, unchanged from Version 1.0.0.

### What's new in 1.3.0

- **The Portfolio History chart now offers four metrics.** A compact
  selector switches the existing trend chart between Health Factor
  (unchanged default), Net Worth, Loan-to-Value, and Leverage. The table
  and mobile card list beneath it, and every value in them, are
  unchanged.
- **Net Worth is exactly the already-documented "Portfolio Value − Debt"
  equation** applied to a stored snapshot's own collateral and debt
  values — not a new formula. Loan-to-Value and Leverage plot the
  already-persisted fields directly.
- **Historical snapshots remain discrete observations, not a continuous
  accounting record.** This release does not add portfolio profit/loss,
  total return, gain since inception, a cost basis, or cumulative/
  realized interest — ProfitPilot has no mechanism to capture an
  acquisition price, so none of these can be computed without new
  specification work this release does not do.

### Explicitly unchanged in 1.3.0

No financial formula changed, no persisted-data schema changed, no
Engine file changed, no new protocol API call, no V3/V4 semantic change,
still no live wallet connection or transaction execution, still no cloud
backup or synchronization, still no publicly operated production
deployment. Collateral quantity and debt balance remain always-manual
for both protocol versions.

## Version 1.2.0 (previous release)

Promoted the Aave V4 capability and correctness work described below out
of Unreleased status — built, tested, and independently re-verified
(4092/4092 tests passing) in the same batches that produced it, not a
fresh Milestone-9/V1.1-style Release Candidate process with its own new
manual exploratory pass. See `PROJECT_STATUS.md`'s "V1.2.0 Release
Reconciliation" section and `docs/CHANGELOG.md`'s `[1.2.0]` entry for the
full record. Everything in "Version 1.1.0" and "Version 1.0.0" below
still applies; this section covers only what is new since 1.1.0. **Still
a self-hostable software release, not a hosted product** — see
"Deployment" below, unchanged from Version 1.0.0.

### What's new in 1.2.0

- **Aave V4 portfolios can now be created directly.** Previously, every
  new portfolio started as V3; Aave V4 was only reachable by switching
  an existing portfolio afterward. The New Portfolio form now offers
  the same choice up front — with or without an on-chain address.
- **A third V4 field can now be read live: base drawn interest rate**,
  joining debt state and collateral risk factor, on the same opt-in,
  read-only, never-silently-overwritten terms as those two.
- **Live V4 reserve (BTC) price**, read from Aave V4's own oracle,
  independent of V3's separate live price feed.
- **Per-field live/manual status for V4.** Debt state, collateral risk,
  and base drawn rate each now show their own status individually
  instead of one combined figure for the whole portfolio.
- **Consistent V4 debt totals in every preview.** The Portfolio page's
  own change preview and Simulation's portfolio-action path now agree
  with every other V4 surface on what a position's real total debt is.
- **V3/V4 terminology correctness verified end to end.** A focused
  review found and fixed every remaining place a V4 portfolio's real
  Collateral Factor was still shown or validated using V3's "Maximum
  LTV" language, or where an unchanged-assumptions disclosure still
  named "Supply APR" for V4 (a concept V4 doesn't have) — across Loop
  Builder, Simulation, Apply-to-Portfolio, and the Dashboard. The
  underlying numbers were already correct in every case; only the
  wording was wrong. A follow-up, independent review re-checked every
  V4-reachable surface and found nothing further to fix.

### Explicitly unchanged in 1.2.0

No financial formula changed, no persisted-data schema changed, still
no live wallet connection or transaction execution, still no cloud
backup or synchronization, still no publicly operated production
deployment. Collateral quantity and debt balance remain always-manual
for both protocol versions.

## Version 1.1.0 (previous release)

Quality Sign-Off completed via the V1.1 Release
Candidate audit (Batches 1–7), with zero release-blocking (P0/P1)
defects — see `docs/DEFECT_CLASSIFICATION.md`'s "V1.1 Release Candidate
Review" section for the full review. Everything in "Version 1.0.0" below
still applies; this section covers only what is new since that release.
**Still a self-hostable software release, not a hosted product** — see
"Deployment" below, unchanged from Version 1.0.0.

### What's new in 1.1.0

- **Live-data trust parity for Aave V3.** A live V3 fetch that disagrees
  with a manually entered market price or protocol parameter is now held
  as a pending candidate and surfaced as an explicit confirmation ("Use
  Live Data" / "Keep Manual") on the Portfolio page — it is never applied
  silently. V4 already worked this way; V3 previously did not.
- **Portfolio History.** Every portfolio now keeps an automatic timeline
  of its own meaningful changes — a Health Factor trend chart plus a
  table of before/after deltas (timestamp, Health Factor, collateral/debt
  value, LTV, leverage, borrow APR), recorded on creation, on save, and
  whenever an accepted live update or an applied change is material.
- **Apply-to-Portfolio.** Simulation, Loop Builder, Exit Planner, and
  Recommendation Detail results can now be written directly to your
  tracked portfolio, through one shared review step showing current vs.
  proposed Health Factor, leverage, LTV, liquidation price, and annual
  borrowing cost before you confirm. Refuses to apply (rather than
  applying stale assumptions) if the portfolio changed since the review
  was generated.
- **More explainable recommendations.** Each recommendation now shows a
  quantified before/after impact, a plain-language risk/tradeoff and cost
  statement, and a data-confidence note, and can be applied directly
  through the same Apply-to-Portfolio review.
- **Clearer live-vs-manual data status.** Anywhere a manually entered
  value has a live counterpart, the interface now states plainly whether
  it is live, manual, or manual-and-stale, rather than leaving that
  implicit.
- **Usable on a phone.** Primary navigation now works below the tablet
  breakpoint (previously reachable only via the Dashboard's own Quick
  Actions shortcuts); Portfolio History and the Apply-to-Portfolio review
  are both readable at narrow widths without horizontal scrolling.

### Explicitly unchanged in 1.1.0

No financial formula changed, no persisted-data schema changed, still no
live wallet connection or transaction execution, still no cloud backup or
synchronization, and still no publicly operated production deployment —
see "Known limitations" and "Deployment" below, both unchanged from
Version 1.0.0.

## Version 1.0.0 (previous release)

Quality Sign-Off completed Milestone 9 Batch 11 (`06_TASKS.md` M9-064),
with zero release-blocking (P0/P1) defects — see
`docs/DEFECT_CLASSIFICATION.md` §6 for the full review. **This is a
self-hostable software release, not a hosted product** — no publicly
operated production deployment exists for Version 1.0.0 (see "Deployment"
below).

## Major features

- **Portfolio management**: create, edit, duplicate, archive, and delete
  one or more Bitcoin-collateralized leverage positions.
- **Dashboard**: Health Factor, Loan-to-Value, liquidation price/distance/
  buffer, net worth, and risk warnings, recalculated instantly from your
  own entered values.
- **Simulation Workspace**: model a hypothetical price, collateral, debt,
  or interest-rate change without touching your real tracked position;
  save, compare, and export scenarios.
- **Loop Builder**: model a leverage loop (repeated borrow-and-add-
  collateral cycles), with automatic stop conditions (minimum Health
  Factor, protocol borrowing limits) and cost/break-even analysis.
- **Exit Planner**: model a full or partial position exit, including
  price-sensitivity analysis.
- **Recommendation Center**: rule-based, explained suggestions (Borrow,
  Repay, Add Collateral, Loop) generated from your current position
  against a target you set.
- **Local-first persistence**: everything is stored in your browser's own
  `localStorage`; nothing is sent anywhere by default.
- **Full backup/restore**: export everything as a single JSON file;
  import with 4 merge modes (Add as new, Merge non-conflicting, Replace
  selected, Replace all local data); automatic Recovery Snapshots before
  a destructive import.
- **Optional, dormant Authentication**: sign in (Supabase) is available
  if a deployer configures it, but never required and never changes how
  portfolio data is stored.
- **Optional, dormant error monitoring**: Sentry integration exists but
  reports nothing unless a deployer sets `NEXT_PUBLIC_SENTRY_DSN`.

## Known limitations

See `docs/DEFECT_CLASSIFICATION.md` §6 and `docs/CHANGELOG.md`'s "Known
limitations" section for the complete, classified list. Summarized:

- **Corrected for the current release** (this bullet, as originally
  written for Version 1.0.0, is no longer accurate — see
  `docs/USER_GUIDE.md` for the full current picture): BTC price and
  Aave V3 protocol parameters are live and read-only by default; Aave
  V4 debt state, collateral risk, and base drawn rate are live and
  read-only if you opt in with an on-chain address. What remains
  permanently manual, for both protocol versions: collateral quantity
  and debt balance (your own position size), and there is still no
  wallet connection or transaction execution of any kind.
- No cloud backup or cloud sync — Cloud Database and Cloud Synchronization
  were **cancelled by product decision** in Milestone 8
  (`docs/MILESTONE_8_SCOPE_CHANGE.md`) and remain cancelled.
- No wallet connection, no transaction execution — this is a decision-
  support tool, not a trading system.
- Automated cross-browser test coverage is Chromium-only; Firefox/Safari
  are covered by code-level review (`docs/CROSS_BROWSER_REVIEW.md`), not
  automated tests.
- CI runs a blocking production smoke gate on every PR/push
  (`.github/workflows/ci.yml`); the full end-to-end (Playwright) test
  suite runs as a separate, manual release gate
  (`.github/workflows/e2e-full.yml`), not automatically on every push
  (`docs/DEFECT_CLASSIFICATION.md` §6, classified non-blocking).
  Corrected in v1.8.0's release reconciliation — this bullet previously
  understated the smoke gate that already existed by that point
  (Post-M10 hardening, R1-3/R2-4).
- No public production deployment exists for Version 1.0.0 (see
  "Deployment" below).

## Supported browsers

Current Chrome, current Edge (both Chromium-based; automated coverage
runs against Chromium directly). Current Firefox and current Safari are
supported per code-level review (no browser-specific APIs found; no
vendor-prefixed CSS) but not automated in this development environment —
see `docs/CROSS_BROWSER_REVIEW.md` for the full reasoning.

## Supported devices / viewports

Desktop (primary, 1280px+ tested), tablet (768px, sidebar breakpoint
tested), and mobile (375px tested, essential features) — see
`docs/QUALITY_PLAN.md` §4 and `tests/e2e/responsiveLayout.spec.ts`.

## Storage options

- **Local storage (default, always available)**: the only persistence
  mode Version 1.0.0 actually ships. No account required. Versioned
  (`STORAGE_SCHEMA_VERSION`) and migration-capable — see
  `docs/VERSIONING_STRATEGY.md`.
- **Cloud storage/synchronization**: not available in any form — cancelled
  by product decision, not deferred.

## Authentication options

Optional and dormant. If a deployer configures
`NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`, Sign In/Sign
Up/Password Reset become available (session/identity only — no
service-role key anywhere in this codebase). In this project's own
default configuration, neither is set, and Sign In reports "Cloud
accounts are not available in this environment" — the expected state,
not an error. Signing in never changes how portfolio data is stored.

## Import/export capabilities

Full backup export (JSON, all record types), single-record export,
per-tool CSV export (Portfolio Positions, Scenario Comparisons, Loop
Steps, Exit Plan Breakdowns), and import with 4 merge modes and automatic
Recovery Snapshots before a destructive replace — see
`docs/USER_GUIDE.md`'s "Your data" section for the full user-facing
walkthrough.

## Breaking changes

None — Version 1.0.0 is this project's first release. `STORAGE_SCHEMA_VERSION`
(`1.0.0`) is the only schema version that has ever existed; there is
nothing for it to break compatibility with.

## Upgrade instructions

There is no prior installed version to upgrade from — Version 1.0.0 is
the first release. For a future release: pull the new build, run
`pnpm install --frozen-lockfile`, and start the application normally; any
required local-data migration runs automatically on first load
(`providers/PersistenceProvider.tsx`'s own `runLocalDataMigration` call).
Export a backup first regardless (`/settings` → **Export** → **Full
Backup**) — the same standing recommendation `docs/USER_GUIDE.md` and
`docs/DISASTER_RECOVERY.md` already make for any local-data operation.

## Deployment

**No publicly operated production deployment exists for Version 1.0.0.**
This is a deliberate release decision, not an oversight or a missing
step: ProfitPilot is a self-hostable application with no single owned
production domain by design (see `CONTRIBUTING.md`'s "Deployment"
section). Running it requires cloning the repository and building it
yourself (`pnpm install && pnpm build && pnpm start`, or an equivalent
Next.js-compatible host) — see `docs/PRODUCTION_READINESS.md` for the
repository-level readiness audit and the specific infrastructure a
deployer would need to provide (hosting, and optionally Supabase/Sentry
projects) that this release does not include.

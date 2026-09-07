# Starting-Value Baseline — Canonical Specification

**Status: Approved for implementation planning. Not yet implemented.**
Produced by a dedicated product/specification decision phase following the
v1.17.0 roadmap audit's NO-GO recommendation and a subsequent read-only
cost-basis/financial-performance research phase (see
`PROJECT_STATUS.md`'s "v1.17.0 Specification Phase — Starting-Value
Baseline" section for the full decision trail: the roadmap audit's
findings, the cost-basis research's model comparison, and the five owner
decisions this document implements). This is the one canonical,
implementation-ready source for this feature's semantics — no other
document restates these definitions; where another document (Dashboard,
Portfolio page, `PROJECT_STATUS.md`) needs to reference this feature, it
points here rather than repeating this content.

This document is **specification only**. It defines exactly what must be
built and why; it does not implement any code, schema, or test.

---

## 1. Feature purpose

**Starting-Value Baseline is a performance *reference point*, not an
accounting feature.** It lets a user mark "how my position's value has
changed since [a chosen or observed moment]" — nothing more.

**It is explicitly NOT:**
- Acquisition cost basis (what the user actually paid).
- Tax or accounting cost basis.
- Purchase price tracking.
- Realized profit/loss accounting.
- A claim about when or at what price the user's BTC was acquired in
  the real world.

ProfitPilot has no data anywhere — live or historical — recording what a
user paid for their BTC (verified directly against `CollateralPosition`,
`DebtPosition`, `MarketPrices`, and `PersistedPortfolioHistoryEntry`
during the cost-basis research phase: none carries an acquisition price).
Starting-Value Baseline does not attempt to reconstruct that. It records
a value ProfitPilot can actually know — the portfolio's own state at a
moment the user explicitly adopts as their comparison point — and
measures change from there forward, honestly labeled as such.

---

## 2. Baseline data model

**Store source facts, not derived values**, matching this codebase's
existing convention: `PersistedPortfolioHistoryEntry` already stores
`collateral.quantity` (a fact) alongside `collateral.valueUsd` (a
derived value it also happens to persist for historical-snapshot
purposes) — but the *live* `Portfolio` type stores no derived financial
figures at all; every derived number (`PortfolioSummary`, `netWorth`,
etc.) is recomputed on read by the Engine/Service layer, never
persisted redundantly on the portfolio record itself. Starting-Value
Baseline follows the live-`Portfolio` convention, not the history-entry
one, because it lives on the portfolio record (see §11) and must never
go stale relative to the market-price data it depends on.

**Canonical baseline fields** (all persisted together, or not persisted
at all — see §3):

| Field | Type | Meaning |
|---|---|---|
| `establishedAt` | `string` (ISO 8601) | When this baseline was set. |
| `collateralQuantity` | `number` | Collateral quantity at the moment the baseline was established. |
| `marketPriceUsd` | `number` | BTC price at the moment the baseline was established. |

**Derived value at read time, never persisted:**
`baselineValueUsd = collateralQuantity × marketPriceUsd`. Persisting a
redundant `baselineValueUsd` would create exactly the kind of "two
numbers that can silently disagree" risk this codebase has deliberately
avoided elsewhere (compare `PersistedPortfolioHistoryEntry`'s own
`valueUsd`, which is a snapshot artifact by necessity — a history entry
is immutable once written — not a precedent for a *live*, mutable
portfolio field). Because `collateralQuantity` and `marketPriceUsd` are
each individually a plain number requiring no recomputation logic
beyond a single multiplication, storing only the two source facts and
deriving the product on every read is strictly simpler and cannot drift.

**Not part of the baseline record**: debt, protocol parameters, or any
other portfolio field. See §7.

---

## 3. Baseline establishment

**Chosen: Option A — explicit user action ("Set Baseline Now"), using
the portfolio's own current live state as the values recorded.**

Rationale, given Decision 3 (preserve-not-blend) and Decision 5
(terminology discipline): an *automatic* baseline (Option B, silently
adopting the first `portfolioHistory` observation) would misrepresent a
portfolio's actual first-observed state as a *user-endorsed* reference
point — the user never chose that moment, and `portfolioHistory`'s own
threshold-triggered, deduplicating nature (verified in
`isMaterialPortfolioHistoryChange.ts`) means the "first entry" is
whatever state existed the first time a deliberate action happened to
occur, not necessarily a moment the user would recognize as meaningful.
Option C (adopting an observed history point) is **not adopted** either,
for the same reason stated more sharply by the owner's own instruction:
*"Do not silently reinterpret old portfolio-history entries as
user-approved investment baselines."* Silently is the operative word —
nothing here forbids a *future* enhancement letting a user explicitly
pick a past `portfolioHistory` entry's values as their baseline (that
would still be an explicit adoption, satisfying the same rule), but that
capability is **out of scope for this specification** (see §15) and must
not be built as part of this feature.

**Deterministic establishment rule:**
1. A baseline can only be set for a portfolio whose `PortfolioSummary`
   currently calculates successfully (`summary.ok === true`) — the same
   precondition `attemptHistorySnapshot` already uses, so a baseline is
   never set from a state ProfitPilot cannot itself currently summarize.
2. Setting a baseline is an explicit, named user action (a button, not a
   side effect of any other action) that captures the portfolio's
   *current* `collateral.quantity` and `market.btcPriceUsd` at the
   moment of the click, together with `new Date().toISOString()` as
   `establishedAt` — the same timestamp convention every other
   `updatedAt`-style field in this codebase already uses.
3. A portfolio has at most one baseline at a time. Setting a new
   baseline (§6, "Reset Baseline") **replaces** the prior one in full —
   there is no baseline history and no multi-baseline concept. This
   specification does not define a UI affordance for viewing a
   previously-replaced baseline.
4. Setting a baseline does not create, require, or interact with a
   `portfolioHistory` entry. The two mechanisms are independent (§13).

---

## 4. Current comparison

While a baseline exists and the current portfolio's collateral quantity
still equals the baseline's `collateralQuantity` (§5's "current" state),
the UI may display:

- **Baseline date** — `establishedAt`, formatted with this codebase's
  existing date/time formatter (the same one `PortfolioHistoryPanel`
  and `AaveTechnicalDetails` already use for `formatDateTime`-style
  display — no new formatting convention).
- **Baseline collateral quantity** — `collateralQuantity`, formatted
  identically to how collateral quantity is displayed everywhere else
  in this codebase (fixed "BTC" unit label, matching
  `CollateralQuantityTrendSection`'s own established precedent).
- **Baseline value** — `collateralQuantity × marketPriceUsd`, in USD.
- **Current collateral quantity** — the portfolio's live
  `collateral.quantity`.
- **Current value** — the portfolio's live
  `collateral.quantity × market.btcPriceUsd`.
- **Absolute change since baseline** — `currentValue − baselineValue`,
  in USD. May be positive, negative, or zero.
- **Percentage change since baseline** — defined precisely below.

**Percentage-change definition:**

```
percentageChange = (currentValue - baselineValue) / baselineValue
```

- **Denominator**: `baselineValue` (`collateralQuantity × marketPriceUsd`
  at baseline), never `currentValue` — the standard "change relative to
  the starting point" convention, matching F-008 "Portfolio Return"'s
  own documented equation shape (`Return % = Gain / <starting value>`)
  even though F-008 itself is not reused here (§12).
- **Zero-baseline behavior**: `baselineValue` is zero only if
  `collateralQuantity` was zero at baseline-establishment time (price is
  always positive in this application's domain — `MarketPrices` has no
  zero/negative-price case anywhere in the Engine's validated input
  space). A zero-quantity baseline is a degenerate case: percentage
  change is **mathematically undefined** (division by zero) and MUST be
  displayed as unavailable — the same "never fabricate, never show
  `Infinity`/`NaN`" discipline `calculateLiquidationPrice`'s own
  zero-debt handling and `PersistedPortfolioHistoryEntry.healthFactor`'s
  `null` convention already establish elsewhere in this codebase.
  Absolute change (a plain USD difference) remains well-defined and
  displayable even when percentage change is not.

**Explicitly excluded from this comparison**: any accounting P&L
framing. No "profit," "loss," "cost basis," or "return" wording appears
anywhere in this section — see §5 for exact approved terminology.

---

## 5. Quantity-change detection

A baseline is **current/fully comparable** if and only if the
portfolio's live `collateral.quantity` at read time is **exactly equal**
to the baseline's own `collateralQuantity`. Any other value —
regardless of cause — makes the baseline **composition-changed /
partial / stale**.

This is a single, deterministic equality check on one field. It
requires no knowledge of *why* the quantity changed, honoring the
owner's explicit instruction that ProfitPilot cannot know that from
existing data. The following are illustrative, not exhaustive — the
rule applies identically regardless of cause:

- A manual collateral-quantity edit on the Portfolio Details form.
- A V4 live-quantity change (if/when V4 ever reports a live collateral
  quantity distinct from user entry — today's V4 model reads live debt
  state and collateral risk factor, not collateral quantity itself, but
  this rule is written to hold regardless).
- A Loop strategy applied to the portfolio
  (`applyPortfolioState` — verified directly during the cost-basis
  research phase that this call **fully replaces**
  `collateral.quantity`, with no partial/incremental concept).
- An Exit strategy applied to the portfolio (same `applyPortfolioState`
  mechanism, same full-replace behavior).
- A partial withdrawal (any manual reduction).
- Additional collateral (any manual or applied increase).

No exemption exists for a quantity change that nets to the same value
through two offsetting edits — if the *live* value at read time equals
the baseline's recorded value, the comparison is current; if it does
not, it is stale, full stop. This keeps the rule a pure function of two
numbers, with no event log required.

---

## 6. Behavior after quantity changes

**The baseline is never silently reset.** Per Decision 3, once a
quantity change is detected (§5):

- **What remains valid**: `establishedAt`, `collateralQuantity`, and
  `marketPriceUsd` — the baseline's own recorded facts never change and
  are never recalculated. Baseline date and baseline value remain
  displayable exactly as before.
- **What becomes qualified**: absolute change and percentage change
  since baseline. Both remain **visible**, not hidden — per Decision 3's
  "mark the comparison as partial/stale," not "suppress the
  comparison" — but rendered with a clearly visible qualifying status
  (see §11 for the exact copy) stating that the position's composition
  has changed since the baseline was set, so the figure no longer
  represents a pure price-driven comparison.
- **Warning/status shown**: a plain-text, non-alarming status indicator
  (not an error, not `role="alert"` — this is informational, not a
  failure state) reading approximately "Composition changed since
  baseline" or equivalent, adjacent to the change figures. Exact copy is
  a UI-implementation detail within the approved terminology (§9 of
  this document via §11), not fixed verbatim here.
- **How a user establishes a new baseline**: the same explicit "Set
  Baseline Now" action from §3, available at any time, including while
  an existing baseline is composition-changed/stale. Re-invoking it
  **replaces** the prior baseline in full (§3, point 3) — there is no
  separate "confirm reset" step beyond the same deliberate button click
  that established it originally, mirroring how no other single-value
  portfolio-settings field in this codebase (e.g., safety targets)
  requires a confirmation dialog to overwrite.

---

## 7. Debt semantics

**Debt is explicitly excluded from this metric.** Starting-Value
Baseline measures collateral value only:
`collateral.quantity × market.btcPriceUsd`, at baseline and at present.
It is **not** net equity, **not** net worth, and **not** any form of
leveraged-position return.

This is a deliberate scope boundary, not an oversight: the owner's
instruction is explicit ("Do not quietly convert it into 'net equity
return'"), and the cost-basis research phase already established that a
debt-side ledger (needed for any defensible net-of-debt figure) is
independently blocked and explicitly deferred (Decision 4). Folding debt
into this metric today would require either (a) a debt-repayment ledger
that does not exist, or (b) silently treating every debt-balance change
as if it were transparent to this metric, which it is not — a debt
paydown funded by external cash looks identical, from `debt.balance`
alone, to a debt paydown funded by selling collateral. This
specification does not attempt to disambiguate that.

A future net-equity or net-worth performance metric, if ever specified,
is a **separate feature** with its own specification — not an extension
of this one.

---

## 8. Interest / supply yield / execution-cost exclusions

Starting-Value Baseline represents **none** of the following, and must
never be presented as if it does:

- Borrowing interest actually paid (no ledger exists — Decision 4,
  deliberately deferred).
- Cumulative realized interest (same reason).
- Protocol supply yield earned (no yield-bearing balance concept exists
  in this codebase's domain model at all, independent of any ledger
  question).
- Realized execution/gas costs (`ExecutionCostAssumptionsSettings` are
  forward-looking planning assumptions for Loop/Exit strategy analysis,
  never a historical record of costs actually incurred).
- Net portfolio return (excluded by §7 above — debt is out of scope
  entirely, and the exclusions in this section apply independently of
  that).

**Already represented separately, unaffected by this feature**: accrued
(not realized) borrowing interest is already fully implemented and
correct today (`annualizedInterestCost`, daily/monthly/annual interest
formulas, F-030/F-031) — Starting-Value Baseline does not touch, extend,
duplicate, or reference that calculation in any way.

---

## 9. BTC/WBTC pricing assumption

Starting-Value Baseline uses `market.btcPriceUsd` exactly as every other
collateral-value calculation in this codebase already does — no new
pricing model, no new oracle, no new price source. This codebase already
treats BTC and WBTC as price-equivalent for valuation purposes wherever
`CollateralPosition.asset` is priced (`CollateralPosition.asset` is
typed as the literal `'BTC'`, and V4's on-chain reads price whichever
wrapped/native asset a V4 position actually holds under that same single
price field — no divergent treatment exists anywhere in the Engine or
Service layers today). Starting-Value Baseline inherits this existing
assumption without alteration and without re-litigating it.

**V3/V4 semantic isolation is fully preserved**: this feature reads
exactly two fields — `collateral.quantity` and `market.btcPriceUsd` —
neither of which carries any V3/V4-specific branching anywhere in the
current domain model (`CollateralPosition`/`MarketPrices` are identical
regardless of `protocolVersion`). No V4-specific debt-state, collateral-
risk, or base-drawn-rate field is read, touched, or referenced by this
feature at all. A baseline set while a portfolio is V3 and later
switched to V4 (or vice versa) behaves identically to any other
quantity-preserving protocol-version switch — it does not itself change
`collateral.quantity`, so it does not itself invalidate the baseline
under §5's rule; a protocol-version switch is not itself listed as an
illustrative quantity-change cause because it is not one.

---

## 10. Persistence semantics

- **Optionality for existing portfolios**: the baseline fields (§2) are
  entirely optional on the `Portfolio` record. Every portfolio that
  exists before this feature ships has no baseline — this is not an
  error state or a migration target, it is simply the default,
  unpopulated state (§11 defines its own UI presentation).
- **Behavior when absent**: no comparison is computed or displayed; the
  UI offers only the "Set Baseline Now" action (§3, §11).
- **Import/export/backup expectations**: the baseline fields travel with
  the portfolio record through every existing mechanism exactly like
  every other optional `Portfolio` field already does — full JSON
  backup/restore, and (if a future CSV portfolio-position export is
  ever extended) the same treatment any other optional field receives.
  No new export format and no new persisted record type are introduced
  by this feature — this stays a plain addition to the existing
  `Portfolio` record, unlike the `portfolioHistory` mechanism which
  required (and received, without a schema bump) its own new
  `PersistedRecordType`.
- **`STORAGE_SCHEMA_VERSION`**: **does not need to change**, per
  established project precedent. Every optional `Portfolio` field added
  since V1.1 (`v4Position`, `v4DebtState`, `v4CollateralRisk`,
  `marketSource`, `protocolSource`, `executionCostAssumptions`, and
  others — verified directly during the cost-basis research phase) has
  shipped at `STORAGE_SCHEMA_VERSION: '1.0.0'` unchanged, using the
  established "optional field, `undefined` on old data, never
  backfilled with an invented value" convention. Starting-Value
  Baseline's three fields (§2) follow the identical pattern.
- **Backward compatibility**: a portfolio persisted before this feature
  ships loads with all three baseline fields `undefined` — no
  normalization function needs to synthesize a value for them (contrast
  `normalizePortfolioProvenance`, which exists because *provenance*
  fields need a conservative default when absent; a baseline has no
  meaningful conservative default — "no baseline" is already the
  correct, honest absent-state, not something to default away from).

---

## 11. UI behavior

**Integration point**: the Portfolio Details page (`/portfolio`,
`app/portfolio/PortfolioPageClient.tsx`), not the Dashboard. Rationale:
setting a baseline is a deliberate, portfolio-level configuration
action — the same category as the portfolio's safety-target settings
already edited on this page — not a passive trend visualization like
the Dashboard's "Trends" group. This avoids inventing a new page and
avoids placing an action-triggering control inside the Dashboard's
otherwise read-only trend-chart section. `PortfolioHistoryPanel.tsx`
(also rendered on this same page) is the nearest existing sibling in
spirit — both concern a portfolio's change over time — but Starting-
Value Baseline is its own compact panel, not an addition to
`PortfolioHistoryPanel` itself, since it is a single before/after
comparison, not a multi-point chart, and conflating the two would blur
exactly the boundary §13 requires kept distinct.

**Required elements**:
- **Absent-baseline state**: a compact panel with a short explanatory
  line (using the approved terminology below) and a single "Set Baseline
  Now" button. No chart, no placeholder numbers, no "N/A" table.
- **Established-baseline, current state**: baseline date, baseline
  value, current value, absolute change, percentage change (§4), and a
  "Reset Baseline" action (§6) — reusing this codebase's existing
  compact key/value display pattern (the `<dl>`/`<dt>`/`<dd>` structure
  already established for exactly this kind of read-only labeled-value
  content, e.g. `AaveTechnicalDetails.tsx`, and reused for Settings'
  About section, v1.16.0).
- **Established-baseline, composition-changed state**: the same fields,
  plus the visible qualifying status from §6. Change figures remain
  shown, not hidden, per Decision 3.
- **Zero-baseline-value edge case** (§4): percentage change displayed as
  unavailable (e.g. "—", matching this codebase's existing "no
  liquidation risk"/`null`-field display convention), absolute change
  still shown normally.

**Exact approved terminology** (per Decision 5 — mandatory, no
substitutes):
- "Performance since [date]"
- "Change since baseline"
- "Baseline value"
- "Current value"

**Forbidden terminology for this feature** (per Decision 5): "Cost
basis," "Acquisition cost," "P&L," "Profit/Loss," "Total return" —
**unless** an existing, separately-scoped feature already legitimately
uses that term under its own established semantics (F-007's Simulation
"Profit or loss" is the one existing example, and it is not renamed,
touched, or reinterpreted by this specification — see §12).

**Accessibility expectations**, matching this codebase's established
conformance discipline (`docs/ACCESSIBILITY_CONFORMANCE.md`): the panel
heading follows the existing Portfolio-page heading-level convention (an
`<h2>` or `<h3>` sibling to `PortfolioHistoryPanel`'s own heading,
whichever level that panel currently uses); labeled values use the
`<dt>`/`<dd>` semantic pairing (§2's precedent), not visual-only
positioning; the composition-changed status is programmatically
associated with the figures it qualifies, not conveyed by color or
position alone; the "Set Baseline Now"/"Reset Baseline" buttons carry
accessible names describing their action, not generic "Submit"/"OK"
text — the same standard every existing button in this codebase
(`SettingsPageClient.tsx`'s own export/import/clear buttons, for
example) already meets.

**Avoided**: no new route, no new page, no modal/dialog, no chart. This
specification deliberately keeps the surface area small.

---

## 12. Formula semantics

**F-007 ("Portfolio Gain") and F-008 ("Portfolio Return") do NOT govern
any part of this feature — verified and confirmed during the
cost-basis research phase, not assumed.** `calculatePortfolioGain`
(`engine/simulation/calculatePortfolioGain.ts`, F-007) is implemented
and correctly scoped to Simulation: at every real call site
(`services/simulation/portfolioAction.ts`,
`services/simulation/scenario.ts`,
`engine/simulation/simulatePriceScenario.ts`), its `initialInvestment`
parameter is a **scenario's own baseline collateral value**, computed
fresh for that one simulation run — not a persisted, user-established
reference point. The arithmetic shape
(`current − initial`, `gain / initial`) happens to resemble Starting-
Value Baseline's own §4 formulas, but reusing F-007/F-008's Engine
functions here would silently graft this feature's persisted-baseline
semantics onto a function whose own header comment, tests, and every
caller assume a transient, per-calculation baseline — exactly the
"silently reuse it for a different financial meaning merely because the
arithmetic looks similar" error the owner's instruction explicitly
warned against.

**No existing Formula ID governs Starting-Value Baseline.** If this
feature is implemented, its two computations (§4's absolute and
percentage change) should be its own small, dedicated Service-layer (or
Engine-layer, if the implementing batch judges it belongs there)
functions — new code, not a formula ID from `02_Formulas.md`, since
`02_Formulas.md` is this project's frozen specification of the original
69 Formula IDs and this feature was never one of them. **This
specification does not assign or invent a new Formula ID** — that is an
implementation-batch decision, to be made (if at all) following this
codebase's own established "only frozen `02_Formulas.md` content gets a
Formula ID; project-specific derived Service logic does not" precedent
(the same reasoning `calculateTargetHealthFactorActions`,
`resolveManualDataStatusText`, and other non-Formula-ID Service helpers
built during this engagement already follow).

---

## 13. Interaction with existing Portfolio History

**These two mechanisms must remain semantically distinct and must never
be conflated in UI copy, code comments, or documentation:**

| | Portfolio History (`portfolioHistory`) | Starting-Value Baseline |
|---|---|---|
| **Trigger** | Automatic, threshold-triggered, on any deliberate portfolio action (`isMaterialPortfolioHistoryChange`) | Explicit, single user action ("Set Baseline Now") |
| **Cardinality** | Many entries per portfolio, append-only | At most one active baseline per portfolio, replaced (not appended) on reset |
| **Fields captured** | A broad snapshot (collateral, debt, Health Factor, LTV, leverage, APRs, interest cost — §2 of `services/persistence/types/models.ts`) | Exactly two source facts (§2 of this document) |
| **Purpose** | Historical trend visualization (Dashboard "Trends," `PortfolioHistoryPanel`) | A single before/after performance reference |
| **User-endorsed?** | No — the user never explicitly approves any one entry as meaningful | Yes — by construction, every baseline is an explicit user action |
| **Persisted as** | Its own `PersistedRecordType` (`'portfolioHistory'`) | Fields directly on the `Portfolio` record |

Setting a baseline does not read from, write to, or require any
`portfolioHistory` entry to exist. A portfolio with zero history entries
can still have a baseline; a portfolio with years of history entries has
no baseline until the user explicitly sets one. No future implementation
of this feature may use a `portfolioHistory` entry as an implicit
baseline source (§3's Option B, explicitly rejected).

---

## 14. Existing orphaned C-014 "Strategy Snapshot Card"

**Audit finding, recorded for traceability**: `docs/03_UI.md`'s
Components-reference chapter defines "C-014 Strategy Snapshot Card"
(Initial Investment, Current Portfolio, Total Return, Interest Paid,
Leverage Gain, Time Held, Net Strategy Return) but it is referenced by
**zero page layout** and **zero task** anywhere in `06_TASKS.md` — an
orphaned component, discovered during the cost-basis research phase, not
previously recorded anywhere in `PROJECT_STATUS.md`.

**This specification resolves exactly two of C-014's seven named
fields, partially and by close analogy, not by direct implementation:**
- "Initial Investment" ↔ Starting-Value Baseline's "Baseline value" —
  related in spirit (a starting reference point) but **not the same
  claim**: C-014's "Initial Investment" reads as a real acquisition
  figure in context with "Total Return"/"Net Strategy Return," which
  this specification explicitly does not provide.
- "Current Portfolio" ↔ this specification's "Current value" — same
  relationship, same caveat.

**This specification explicitly does NOT resolve, and must not be
claimed to resolve:**
- **Interest Paid** — needs the debt-repayment ledger deferred by
  Decision 4.
- **Leverage Gain** — needs a defensible decomposition of price
  appreciation vs. leverage-amplified return, not specified here and
  not derivable from §4's plain collateral-value comparison alone.
- **Net Strategy Return** — needs debt (§7, explicitly excluded) plus
  Interest Paid plus Leverage Gain.
- **Total Return** — forbidden terminology for this feature (§11);
  C-014's own use of the term implies exactly the accounting-grade
  claim this specification declines to make.
- **Time Held** — not addressed by this specification at all; trivially
  derivable from `establishedAt` if ever wanted, but not a field this
  specification defines or names as in-scope.

**C-014 remains unbuildable as a whole.** Implementing Starting-Value
Baseline does not close this orphaned-component finding; it resolves
roughly two-sevenths of it, by analogy, under materially narrower
semantics than C-014's own text implies. A future specification would
still be required to build the remaining five fields, if ever
authorized — this document does not authorize that work and should not
be cited as having done so.

---

## 15. Scope boundary — explicitly deferred

The following remain **out of scope** for Starting-Value Baseline,
consistent with the owner's decisions and the cost-basis research
phase's own model comparison. Classified per that research's own
conclusion (§13 of the prior research report):

- **Tax/accounting cost basis** — Version 2 candidate (would require
  Model D, a full transaction ledger).
- **Transaction lots** — Version 2 candidate (Model D infrastructure).
- **Realized collateral P&L** — Version 2 candidate (needs Model D).
- **Realized/paid interest ledger** — independent future/V2
  consideration (Decision 4) — **not** treated as blocked by, or
  bundled with, this feature.
- **Genuine net portfolio P&L** — Version 2 candidate (needs debt-side
  ledger + Model D).
- **Accounting-grade total return** — Version 2 candidate (needs
  everything above).
- **Supply-yield accounting** — Version 2 candidate (needs new domain
  modeling ProfitPilot does not currently have, independent of any
  ledger question).

None of these is authorized, designed, or implied by this
specification. A future specification phase would be required for any
of them, each starting from its own fresh product decision — this
document does not pre-approve any of them merely by naming them.

---

## 16. Acceptance criteria

Implementation-ready criteria for a future implementation batch:

1. **New portfolio** (never had a baseline): the panel shows the
   absent-baseline state and the "Set Baseline Now" action; no error.
2. **Existing portfolio without baseline** (a pre-feature portfolio
   loaded after this ships): identical to (1) — all three baseline
   fields are `undefined`, treated exactly like a portfolio that simply
   never had one set.
3. **Baseline creation**: clicking "Set Baseline Now" persists
   `establishedAt`/`collateralQuantity`/`marketPriceUsd` from the
   portfolio's live state at that moment; the panel immediately reflects
   the established state without a page reload.
4. **Unchanged quantity**: with a baseline set and `collateral.quantity`
   unchanged since, the panel shows the full current-comparison state
   (§4), no composition-changed status.
5. **Changed quantity**: after any action that changes
   `collateral.quantity` (manual edit, Loop apply, Exit apply, or any
   other mutation), the panel shows the composition-changed status (§6)
   while still displaying the (now-qualified) change figures — never
   silently reset, never silently blended.
6. **Baseline reset**: clicking "Set Baseline Now" again (in either the
   current or composition-changed state) replaces all three fields with
   the portfolio's live state at that new moment; no confirmation
   dialog required (§6).
7. **Zero-value edge case**: a baseline established while
   `collateral.quantity` is `0` shows a well-defined baseline value of
   `$0` but displays percentage change as unavailable, never
   `Infinity`/`NaN`/a fabricated number; absolute change remains
   displayed normally.
8. **Manual data**: behaves identically whether the portfolio's
   `market.btcPriceUsd`/`collateral.quantity` are manually entered or
   live-sourced — this feature reads the same two fields regardless of
   `marketSource`/data-origin, with no provenance-specific branching.
9. **V3**: behaves identically to the general case — no V3-specific
   logic exists or is needed (§9).
10. **V4**: behaves identically to the general case — no V4-specific
    logic exists or is needed (§9); a protocol-version switch alone does
    not trigger the composition-changed state (§9).
11. **Import/export round-trip**: a full JSON backup/restore preserves
    all three baseline fields exactly, including the absent (`undefined`)
    case for a portfolio with no baseline; no other export/import
    surface (CSV, etc.) is required to represent this feature unless a
    future batch extends portfolio CSV export generally.
12. **Accessibility**: the panel's heading level, labeled-value markup,
    and button accessible names meet the same bar §11 describes and
    this codebase's existing `docs/ACCESSIBILITY_CONFORMANCE.md`
    conformance already holds every other panel to.
13. **No semantic collision with Simulation F-007**: no code, test, or
    UI copy introduced by this feature imports, calls, renames, or
    reinterprets `calculatePortfolioGain`/F-007 or its "Profit or loss"
    terminology; the two remain fully independent, verified by their
    own respective test suites never asserting on each other's language
    or values.

---

## 17. Traceability

This document is the single canonical specification for Starting-Value
Baseline. No other document restates its semantics in full:

- `PROJECT_STATUS.md`'s "v1.17.0 Specification Phase — Starting-Value
  Baseline" section records the decision trail (roadmap audit → research
  phase → five owner decisions) and points here for the resulting
  specification — it does not duplicate this document's content.
- A future implementation batch's own `PROJECT_STATUS.md` reconciliation
  entry should reference this document by name (and note any deviation,
  should the implementing batch discover one is genuinely required)
  rather than re-deriving these semantics from the original decision
  conversation.
- `docs/VERSION_2_BACKLOG.md` is **not** updated by this specification
  phase — that document's own established convention corrects itself
  only after a release actually ships and changes what is materially
  true (see its own "Correction (post-vX.Y.Z reconciliation...)"
  entries), not speculatively ahead of an implementation that has not
  yet happened. The eventual implementation batch's own release
  reconciliation is the correct place to record that Starting-Value
  Baseline is delivered V1.x scope, distinct from the still-deferred
  Model D/lot-accounting items §15 lists.
- `docs/TERMINOLOGY.md` and the numbered `01_PRD.md`–`06_TASKS.md`
  specification set are **not** edited by this specification phase —
  they remain this project's frozen, protected original specification
  documents, per this engagement's established convention throughout;
  this document supplies the terminology and semantics a future
  implementation needs without touching them.

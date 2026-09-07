# Recommendation Engine Preferences — Canonical Specification

**Status: Approved for implementation planning. Not yet implemented.**
Produced by a dedicated read-only specification-decision phase following the
v1.18.0 roadmap audit's OPTION C recommendation and a subsequent read-only
Conflict #29 analysis (see `PROJECT_STATUS.md` entry 29 for the original
gap, and this engagement's own conversation record for the roadmap audit
and the Conflict #29 decision analysis this document implements). This is
the one canonical, implementation-ready source for the Borrow/Loop
Recommendation preference contract — no other document restates these
definitions; where another document (Recommendation Center, Dashboard,
Portfolio Details, `PROJECT_STATUS.md`) needs to reference this feature, it
points here rather than repeating this content.

This document is **specification only**. It defines exactly what must be
built and why; it does not implement any code, schema, or test.

---

## 1. Purpose and scope

**What v1.18.0 unlocks**: the two Recommendation Engine rules that are
fully implemented, fully tested, and currently unreachable from any UI —
`calculateBorrowRecommendation` (F-061) and `calculateLoopRecommendation`
(F-064), `engine/recommendation/`. Both are blocked today by exactly one
thing: `RecommendationRuleConfig`'s four preference fields
(`borrow.userMinHealthFactor`, `borrow.targetDebtRatio`,
`loop.loopBorrowPercentage`, `loop.maxAcceptableAnnualInterestCost`) have
no portfolio-level source and no documented default (Conflict #29,
`PROJECT_STATUS.md:16979-17026`). This document resolves that sourcing gap
by defining them as explicit, user-entered, per-portfolio preferences.

**What stays exactly as shipped, untouched by this document**:
`calculateRepaymentRecommendation` (F-062) and
`calculateAdditionalCollateralRecommendation` (F-063), and the
`calculateTargetHealthFactorActions` Service that already exposes them via
`Portfolio.settings.safetyTargets.targetHealthFactor`. Neither their
calculation, their consumers (`recommendationCenterStore`,
`buildRecommendationSummary`), nor their `targetHealthFactor` source
changes as a result of this specification.

**What remains explicitly unavailable, unaffected by this document**:

| Category | Formula | Blocked by | Changed by this spec? |
|---|---|---|---|
| Safety | F-060 (Health Factor Recommendation) | Conflict #1 — HF risk bands disagree across 4 documents | No |
| Exit readiness | — | Conflict #11 — no Formula ID exists for it at all | No |
| Interest cost | F-065 (Interest Warning) | An undocumented "Expected Annual Portfolio Growth" figure — a harder, unnumbered gap in the same family as Conflict #9, distinct from Conflict #29 | No |

This document does not touch F-060, F-065, F-067, F-068, F-069, or any
exit-readiness formula. It does not redefine risk bands, portfolio
scoring, or any interest-growth projection.

---

## 2. Source-of-truth hierarchy

This specification builds on, and defers to, the following documents
without restating or redefining their content:

- **`docs/02_Formulas.md`** (`:4465-4917`, "Recommendation Engine &
  Decision Scoring," page 8 of 10) — the frozen mathematical definition of
  F-060 through F-069. This document does not redefine F-061 or F-064's
  conditions or equations.
- **`06_TASKS.md`** M3-012 ("Implement Recommendation Service"), M2-025
  ("Implement Recommendation Rule Framework"), M2-026 ("Implement
  Recommendation Explanations"), M7-031 through M7-040 (Recommendation
  Center route) — the task-level requirements the existing Engine/Service/UI
  layers already satisfy for F-061–F-064's mechanics.
- **`PROJECT_STATUS.md` entry 29** — the original gap this document closes,
  including its own "Action needed" note, which already named exactly the
  resolution path (Option A) this document formalizes.
- **This engagement's Conflict #29 decision analysis** (read-only,
  delivered immediately before this specification phase) — the source of
  the four Owner Decisions this document implements (per-portfolio
  ownership, build both rules, conditional/explanatory language, no
  presets/defaults).

**Explicitly**: this document resolves Conflict #29's *preference-source*
gap only. It does **not** redefine F-061's or F-064's mathematics, their
triggering conditions, their `formulaReferences`, or any other Engine
behavior. `engine/recommendation/calculateBorrowRecommendation.ts` and
`engine/recommendation/calculateLoopRecommendation.ts` are not modified by
any requirement in this document (§11 makes this explicit as an acceptance
criterion).

---

## 3. Preference contract

Four fields, grouped exactly as `RecommendationRuleConfig` already groups
them (`engine/recommendation/generateRecommendations.ts:12-21`) so the
mapping from persisted preference to Engine parameter is direct, with no
renaming or reinterpretation at any layer.

### 3.1 `borrow.userMinHealthFactor`

| | |
|---|---|
| Canonical field name | `recommendationPreferences.borrow.userMinHealthFactor` |
| Type | `number` |
| Unit | Health Factor ratio (dimensionless, same representation as `targetHealthFactor` elsewhere in this codebase) |
| Meaning | The floor below which the user does not consider additional borrowing acceptable — F-061's "Target HF remains above user minimum" condition |
| Valid domain | Finite, strictly positive (`> 0`) — the exact bound `calculateBorrowRecommendation`'s own `validatePositive(userMinHealthFactor, 'userMinHealthFactor')` already enforces at the Engine layer (`engine/recommendation/calculateBorrowRecommendation.ts:48`). No additional minimum/maximum is invented — a schema-layer check narrower than the Engine's own would silently reject inputs the Engine would otherwise accept. |
| Persistence | Required together with `targetDebtRatio` for the Borrow recommendation to become available (§5) |
| Absence behavior | Borrow recommendation stays unavailable; no substitution |
| Engine consumer | `calculateBorrowRecommendation` (F-061) |
| UI label | "Minimum Health Factor for borrowing" |
| Helper text | "The lowest Health Factor you're willing to accept if you borrowed more. Below this, an additional borrow will never be recommended." |

### 3.2 `borrow.targetDebtRatio`

| | |
|---|---|
| Canonical field name | `recommendationPreferences.borrow.targetDebtRatio` |
| Type | `number` |
| Unit | Decimal fraction (e.g. `0.5` for 50%) — F-061's "Debt Ratio below target" condition |
| Meaning | The Debt Ratio ceiling the user does not want an additional borrow to reach or exceed |
| Valid domain | `[0, 1]` inclusive — the exact bound `calculateBorrowRecommendation`'s own `validatePercentage(targetDebtRatio, 'targetDebtRatio')` already enforces (`engine/recommendation/calculateBorrowRecommendation.ts:51`) |
| Persistence | Required together with `userMinHealthFactor` |
| Absence behavior | Borrow recommendation stays unavailable |
| Engine consumer | `calculateBorrowRecommendation` (F-061) |
| UI label | "Target Debt Ratio ceiling" |
| Helper text | "The Debt Ratio you don't want an additional borrow to reach. Expressed as a percentage (e.g. 50%)." |

### 3.3 `loop.loopBorrowPercentage`

| | |
|---|---|
| Canonical field name | `recommendationPreferences.loop.loopBorrowPercentage` |
| Type | `number` |
| Unit | Decimal fraction of available borrow capacity |
| Meaning | The fraction of available borrow capacity a proposed loop step would draw — the same representation `calculateLoopStep`'s own `borrowPercentage` parameter already uses (`engine/loop/calculateLoopStep.ts:39`) |
| Valid domain | `[0, 1]` inclusive — the exact bound `calculateLoopStep`'s own `validatePercentage(input.borrowPercentage, 'borrowPercentage')` already enforces (`engine/loop/calculateLoopStep.ts:103`), reached indirectly via `calculateLoopRecommendation` |
| Persistence | Required together with `maxAcceptableAnnualInterestCost` (and, transitively, `targetHealthFactor`) for the Loop recommendation |
| Absence behavior | Loop recommendation stays unavailable |
| Engine consumer | `calculateLoopRecommendation` (F-064), via `calculateLoopStep` |
| UI label | "Loop borrow percentage" |
| Helper text | "How much of your available borrow capacity a proposed additional loop step would use. Expressed as a percentage." |

### 3.4 `loop.maxAcceptableAnnualInterestCost`

| | |
|---|---|
| Canonical field name | `recommendationPreferences.loop.maxAcceptableAnnualInterestCost` |
| Type | `number` |
| Unit | USD per year |
| Meaning | The ceiling for F-064's "Interest Cost acceptable" condition |
| Valid domain | Finite, strictly positive (`> 0`) — the exact bound `calculateLoopRecommendation`'s own `validatePositive(maxAcceptableAnnualInterestCost, 'maxAcceptableAnnualInterestCost')` already enforces (`engine/recommendation/calculateLoopRecommendation.ts:50-54`) |
| Persistence | Required together with `loopBorrowPercentage` |
| Absence behavior | Loop recommendation stays unavailable |
| Engine consumer | `calculateLoopRecommendation` (F-064) |
| UI label | "Maximum acceptable annual interest cost" |
| Helper text | "The most you're willing to pay in projected annual interest for one more loop step, in USD." |

**`loop.targetHealthFactor` is deliberately not a new field.** F-064 also
needs a target Health Factor, but this specification does not add a
second, loop-specific target — it reuses the existing, already-persisted,
already-user-editable `Portfolio.settings.safetyTargets.targetHealthFactor`
(the same field F-062/F-063 already use), exactly as Conflict #29's own
"Action needed" note anticipated. One target Health Factor per portfolio,
shared by repayment, additional-collateral, and loop recommendations
alike — introducing a second, loop-specific target would fragment a
concept this codebase already treats as singular, without any documented
reason to diverge.

**No range or bound beyond what the Engine already enforces is invented
anywhere in this table** — every "Valid domain" cell cites the exact
existing `validate.ts` call the corresponding Engine rule already runs.
Schema-layer validation (§4, §13) mirrors these bounds exactly rather than
inventing narrower or looser ones.

---

## 4. Persistence model

**Decision: a new sibling object, `RecommendationPreferences`, under
`PortfolioSettings` — not merged into `PortfolioSafetyTargets`.**

**Why not `PortfolioSafetyTargets`, evaluated on semantic cohesion, not
convenience**: `PortfolioSafetyTargets`'s existing four fields
(`targetHealthFactor`, `holdingPeriodDays`, `targetBtcPriceUsd`,
`safetyBufferPercent`) all describe a user's desired *outcome* — what HF,
price, or holding period they're aiming for. The four Conflict #29 fields
describe *rule-configuration policy* for two specific recommendation
rules — under what conditions the Borrow/Loop rules should trigger at
all — a different kind of preference even though `userMinHealthFactor` is
superficially HF-shaped like `targetHealthFactor`. Conflating a "goal" (my
target HF) with a "rule floor" (the minimum HF below which I never want a
borrow recommendation) inside one flat object risks exactly the kind of
reader confusion a canonical field-name table should prevent. This
codebase already has a working precedent for keeping a *different*
preference domain in its own sibling object rather than cramming it into
`PortfolioSafetyTargets`: `ExecutionCostAssumptionsSettings`
(`swapFeeRate`/`slippageRate`/`gasCostUsd`, added P1-6) is its own object
under `PortfolioSettings`, not a fifth/sixth/seventh field bolted onto
`PortfolioSafetyTargets`, despite also being "just a few optional
numbers." `RecommendationPreferences` follows that same precedent.

**Shape** (`types/portfolio.ts`, alongside `PortfolioSafetyTargets` and
`ExecutionCostAssumptionsSettings`):

```ts
export interface RecommendationPreferences {
  borrow?: {
    userMinHealthFactor?: number;
    targetDebtRatio?: number;
  };
  loop?: {
    loopBorrowPercentage?: number;
    maxAcceptableAnnualInterestCost?: number;
  };
}

export interface PortfolioSettings {
  safetyTargets?: PortfolioSafetyTargets;
  executionCostAssumptions?: ExecutionCostAssumptionsSettings;
  recommendationPreferences?: RecommendationPreferences;
}
```

**Each leaf field independently optional, not the sub-object as a whole**:
`borrow`/`loop` being present does not imply both of their own fields are
set — §5 requires distinguishing "no borrow preferences at all" from
"one of the two borrow fields set." A flat `borrow?: {...}` container with
independently optional leaves is the minimal shape that allows the
partial-configuration states §5 requires to be represented and detected,
without inventing a third nesting level or a boolean "isConfigured" flag
that could itself drift from the fields it describes.

**Schema** (`types/portfolio.schema.ts`, alongside
`portfolioSafetyTargetsSchema`/`executionCostAssumptionsSchema`):

```ts
export const recommendationPreferencesSchema = z.object({
  borrow: z
    .object({
      userMinHealthFactor: z.number().finite().positive().optional(),
      targetDebtRatio: z.number().finite().min(0).max(1).optional(),
    })
    .optional(),
  loop: z
    .object({
      loopBorrowPercentage: z.number().finite().min(0).max(1).optional(),
      maxAcceptableAnnualInterestCost: z.number().finite().positive().optional(),
    })
    .optional(),
});
```

Added to `portfolioSettingsSchema` (`types/portfolio.schema.ts:155-158`)
as `recommendationPreferences: recommendationPreferencesSchema.optional()`,
and to `persistedPortfolioPayloadSchema`
(`services/persistence/schemas/portfolio.schema.ts:90-104`) automatically,
since that schema already imports and reuses `portfolioSettingsSchema` as
a whole (`services/persistence/schemas/portfolio.schema.ts:104`) — no
separate persistence-schema edit is needed beyond the shared
`portfolioSettingsSchema` change itself.

**Requirements, all satisfied by the shape above**:
- **Additive/backward-compatible**: a new optional field on an existing
  optional settings object. Zero required fields anywhere in the new
  shape.
- **Existing portfolios remain valid**: a portfolio persisted before this
  ships has `settings.recommendationPreferences === undefined`; it parses
  against the updated schema exactly as it did against the old one — the
  new field is optional at every level.
- **Absent values remain absent**: no normalization function synthesizes
  a value for any of the four leaves. The absent state (`undefined`) is
  the correct, honest "not configured" state, not something to default
  away from — the same reasoning `docs/STARTING_VALUE_BASELINE_SPEC.md`
  §10 already documents for why its own optional fields need no
  normalizer.
- **No migration-generated financial preferences**: there is no migration
  step at all. `STORAGE_SCHEMA_VERSION` (`services/persistence/envelope.ts:22`,
  currently `'1.0.0'`) **does not need to change** — this follows the
  identical, already-established "optional field, `undefined` on old
  data, never backfilled" convention this codebase has used for every
  optional `Portfolio`/`PortfolioSettings` field added since V1.1
  (`v4Position`, `v4DebtState`, `marketSource`, `executionCostAssumptions`,
  the three Starting-Value Baseline fields, and others).
- **JSON backup/restore**: the new fields travel with the portfolio record
  through the existing full-backup export/import path
  (`services/persistence`, `services/export::exportFullBackup`,
  `services/import`) automatically, the same as every other optional
  `PortfolioSettings` field — no new export format or persisted record
  type is introduced.
- **Import/export implications**: `applyValidatedImport`/`previewImport`
  (`services/import`) already validate an imported payload against the
  same `persistedPortfolioPayloadSchema` that will carry the new field;
  a corrupted or out-of-range imported value is rejected by the identical
  mechanism that already rejects a corrupted `safetyTargets` value today
  (§13). No CSV portfolio-position export currently includes
  `safetyTargets` or `recommendationPreferences`-shaped settings at all
  (only `executionCostAssumptions` appears in `CsvExporter.ts:301-303`,
  for Loop/Exit cost disclosure specifically); extending CSV export to
  include the four new fields is **out of scope** for this specification
  (§16) — nothing about the JSON backup path requires it, and no existing
  task names it as a requirement for Recommendation preferences
  specifically.
- **Checksum implications**: none beyond what already happens
  automatically. `computeChecksum` (`services/persistence/envelope.ts:25-46`)
  is a generic FNV-1a hash over the full serialized payload — it requires
  no field-specific update; a portfolio record that now includes
  `recommendationPreferences` simply produces a different (correctly
  different) checksum than the same record without it, exactly as adding
  any other optional field already does today.

---

## 5. Partial configuration semantics

**Rule, stated once, applied uniformly: each recommendation item becomes
available if and only if its own complete required field set is present.
No partial substitution, no defaulting a missing sibling field, ever.**

Borrow's required set: `{ targetHealthFactor, userMinHealthFactor,
targetDebtRatio }` (the first from `safetyTargets`, the other two from
`recommendationPreferences.borrow`). Loop's required set: `{
targetHealthFactor, loopBorrowPercentage, maxAcceptableAnnualInterestCost
}` (the first from `safetyTargets`, the other two from
`recommendationPreferences.loop`). Repayment's and Additional Collateral's
required set is unchanged: `{ targetHealthFactor }` only — this
specification does not add any new requirement to either.

| State | Repayment | Additional Collateral | Borrow | Loop |
|---|---|---|---|---|
| None configured (no `targetHealthFactor`, no `recommendationPreferences`) | Unavailable (`status: 'noTarget'`, unchanged today) | Unavailable | Unavailable | Unavailable |
| Only `targetHealthFactor` set (today's shipped state) | **Available** (unchanged) | **Available** (unchanged) | Unavailable — missing both `borrow` fields | Unavailable — missing both `loop` fields |
| `targetHealthFactor` + both `borrow.*` fields set | Available | Available | **Available** | Unavailable — missing `loop` fields |
| `targetHealthFactor` + both `loop.*` fields set | Available | Available | Unavailable — missing `borrow` fields | **Available** |
| `targetHealthFactor` + only `borrow.userMinHealthFactor` set (partial) | Available | Available | Unavailable — `targetDebtRatio` still missing | Unavailable |
| `targetHealthFactor` + only `loop.loopBorrowPercentage` set (partial) | Available | Available | Unavailable | Unavailable — `maxAcceptableAnnualInterestCost` still missing |
| All four fields + `targetHealthFactor` set | Available | Available | **Available** | **Available** |

**A category must not silently substitute missing values** — this is
enforced structurally, not by a runtime check that could be bypassed: the
new Service-layer function (§6) only calls
`calculateBorrowRecommendation`/`calculateLoopRecommendation` at all once
every field each one needs is confirmed present (`!== undefined`); there
is no code path that calls either Engine function with a placeholder,
zero, or previous value substituted for a missing preference.

---

## 6. Recommendation service/store integration contract

**Problem this section solves**: `generateRecommendationSet`
(`services/recommendation/recommendations.ts`) requires the complete,
non-optional 7-field `RecommendationRuleConfig` in one call — exactly the
all-or-nothing shape Conflict #29 identified as unusable. It must **not**
be used as the integration point, or Borrow/Loop would stay unavailable
merely because — hypothetically — the *other* rule's preferences aren't
configured yet, defeating §5's independence requirement. It also must not
be modified — §11 requires F-061/F-062/F-063/F-064 unchanged, and
`generateRecommendationSet` is directly, exhaustively tested today exactly
as an all-or-nothing composition; changing its contract would be an
unrelated, riskier change this specification does not authorize.

**Decision: a new Service function, composing the individual
already-public Engine rule functions directly — the same "compose only
what has a real source" pattern `calculateTargetHealthFactorActions`
already established for exactly this reason.**

### 6.1 New Service function

`services/recommendation/recommendationActions.ts` (new file, sibling to
`targetHealthFactorActions.ts`):

```ts
export type RecommendationItemId = 'repayment' | 'additionalCollateral' | 'borrow' | 'loop';

export interface RecommendationActionsResult {
  targetHealthFactor: number | null;
  /** Only the items whose full required preference set was present. */
  items: Partial<Record<RecommendationItemId, Recommendation>>;
  /** Every item NOT in `items`, with a real, sourced reason — never omitted silently. */
  unavailableReasons: Partial<Record<RecommendationItemId, string>>;
}

export function calculateRecommendationActions(
  portfolio: ApplicationPortfolio,
  sourceStatus: string,
): ServiceResult<RecommendationActionsResult>
```

**Behavior**:
1. Reads `targetHealthFactor` from `portfolio.settings.safetyTargets`. If
   absent, returns a result with all four items absent and each item's
   `unavailableReasons` set to a "no target Health Factor configured"
   message (matching `recommendationCenterStore`'s existing `'noTarget'`
   status precedent) — **no Engine call is made at all**, preserving
   today's exact `status: 'noTarget'` short-circuit.
2. If `targetHealthFactor` is present, computes `repayment` and
   `additionalCollateral` exactly as `calculateTargetHealthFactorActions`
   already does today — reusing that function's own calls (or the
   function itself) rather than duplicating its V4-dispatch logic (§12).
3. Independently checks whether `recommendationPreferences.borrow` has
   both `userMinHealthFactor` and `targetDebtRatio` set. If so, calls
   `calculateBorrowRecommendation` (with the same V4 risk-capacity
   dispatch `generateRecommendationSet` already applies, §12) and adds it
   to `items.borrow`. If not, adds a specific reason to
   `unavailableReasons.borrow` naming exactly which field(s) are missing
   and where to configure them ("Configure your minimum Health Factor and
   target Debt Ratio in Portfolio Settings → Recommendation Preferences
   to see Borrow recommendations here.").
4. Independently checks whether `recommendationPreferences.loop` has both
   `loopBorrowPercentage` and `maxAcceptableAnnualInterestCost` set. If
   so, calls `calculateLoopRecommendation` (with the same V4
   effective-borrow-rate and risk-capacity dispatch, §12) and adds it to
   `items.loop`. If not, adds a specific reason to
   `unavailableReasons.loop`.
5. Steps 3 and 4 are fully independent — neither's outcome affects the
   other, satisfying §5's table exactly.
6. Fails as one unit (the existing `ServiceResult` failure convention)
   only if a *computed* item's own Engine call fails for a reason other
   than "preferences not configured" (e.g. a V4 guard failure, or an
   Engine-level validation failure on an out-of-range persisted value —
   §13) — an *absent* preference is never treated as a failure, only as
   an unavailable item.

**Repayment/Additional Collateral are computed by the same code path they
use today** — this function does not reimplement F-062/F-063, it calls
the same `calculateRepaymentRecommendation`/
`calculateAdditionalCollateralRecommendation` Engine functions
`calculateTargetHealthFactorActions` already calls, with the same V4
dispatch. Their behavior, including their existing test coverage, is
unaffected.

### 6.2 Dashboard's `calculateTargetHealthFactorActions` is unchanged

Per §9's decision, `services/recommendation/targetHealthFactorActions.ts`
and `features/dashboard/utils/buildRecommendationSummary.ts` are **not**
modified by this specification — they continue to compute exactly
`repayment`/`additionalCollateral`, exactly as today. `services/recommendation/recommendationActions.ts`
is a new, additional function, not a replacement.

### 6.3 Store integration

`stores/recommendationCenterStore.ts`:
- `RecommendationItemId` extends from `'repayment' | 'additionalCollateral'`
  to `'repayment' | 'additionalCollateral' | 'borrow' | 'loop'`.
- `RecommendationCenterState.actions: TargetHealthFactorActions | null`
  becomes `actions: RecommendationActionsResult['items'] | null` (or an
  equivalent shape carrying both `items` and `unavailableReasons` — the
  exact field name is an implementation-batch detail; the *contract* is
  that both must be available to the Store's consumers).
- `RecommendationCenterState` gains `unavailableReasons:
  Partial<Record<RecommendationItemId, string>>` (or the two are kept
  together in one object) so `RecommendationList`/`RecommendationDetailPanel`
  can render a specific, sourced "why is this missing" message per item,
  the same pattern `UNAVAILABLE_FILTER_REASONS` already establishes at
  the category level.
- `recalculate` calls `calculateRecommendationActions` instead of
  `calculateTargetHealthFactorActions`. The five M7-036 recalculation
  triggers (`stores/recommendationCenterStore.ts:59-74`'s own
  documented reasoning) are unaffected — the same `[activePortfolioId,
  portfolio.updatedAt]` dependency pair already covers a
  `recommendationPreferences` edit, since editing it goes through
  `usePortfolioStore`'s `update()` action exactly like editing
  `safetyTargets` already does, which already bumps `portfolio.updatedAt`.
- `reconcileAcknowledgements`'s existing `relevantValues`-comparison logic
  (`stores/recommendationCenterStore.ts:161-185`) extends unchanged to
  `borrow`/`loop` — it is already written generically over
  `RecommendationItemId`/`Record<string, number>`, requiring no new
  special-casing.

### 6.4 Desired product behavior — confirmed satisfied

- F-062/F-063 continue working with `targetHealthFactor` — §6.1 step 2,
  unchanged code path. ✓
- F-061 appears when its own complete preference set is available — §6.1
  step 3, independent of Loop. ✓
- F-064 appears when its own complete preference set is available — §6.1
  step 4, independent of Borrow. ✓
- Unrelated blocked categories (`safety`, `exitReadiness`, `interestCost`)
  remain explicitly unavailable — untouched by this function; their
  existing `UNAVAILABLE_CATEGORIES`/`UNAVAILABLE_FILTER_REASONS` entries
  are not modified. ✓

---

## 7. UI configuration surface

**Integration point**: the Portfolio Details page
(`app/portfolio/PortfolioPageClient.tsx`), as a new `<fieldset>` alongside
the existing "Safety target settings" and "Execution cost assumptions"
fieldsets — the same page, the same pattern, immediately following the
established precedent rather than inventing a new location. Rationale:
configuring recommendation preferences is the same category of
deliberate, portfolio-level configuration action as the two fieldsets
already there; it is not a Dashboard or Recommendation-Center-page concern
(the Recommendation Center only *displays* the resulting recommendations
and explains, per item, where to configure what's missing — §8 — it does
not host the configuration form itself, mirroring how the Dashboard
displays but never configures `safetyTargets` either).

**Section name**: "Recommendation preferences" (`<legend>`, matching the
existing "Safety target settings"/"Execution cost assumptions" legend
style exactly — sentence case, no trailing punctuation).

**Field labels, units, and helper text**: exactly as specified in §3's
four tables (UI label + helper text rows) — reused verbatim, not
independently reworded, so the specification and the shipped copy cannot
drift apart.

**Input behavior**: plain `<input type="number" step="any">` per field,
using the identical `register(..., { setValueAs: (value) => (value === ''
? undefined : Number(value)) })` pattern the existing "Safety target
settings" fieldset already uses (`app/portfolio/PortfolioPageClient.tsx:753-780`)
— an empty input becomes `undefined`, not `0` or any other placeholder,
so leaving a field blank is indistinguishable from never having visited
it. **No `<select>`, no preset buttons, no suggested-value chips** — per
Owner Decision 4, every one of the four fields is entered as a plain
number with no default pre-filled and no preset offered.

**Validation behavior**: the same react-hook-form + Zod pattern this page
already uses for every other field — `recommendationPreferencesSchema`
(§4) drives both the `aria-invalid`/`aria-describedby` error presentation
already established for `name`/`baseCurrency` (`PortfolioPageClient.tsx:700-738`)
and the persisted-value validation on save. An out-of-range value (e.g.
`targetDebtRatio` of `1.5`) is rejected at the form boundary with the same
inline error-message convention already shown for required-field errors.

**Missing-value state**: an unset field simply renders empty — no
placeholder text implying a suggested number (a `placeholder` attribute
showing example units, e.g. "e.g. 1.5" for Health Factor fields, mirroring
how `type="number"` fields elsewhere in this codebase use placeholders for
*format* illustration only, is acceptable; a placeholder implying a
*product-endorsed value* is not, per Owner Decision 4).

**Save/update behavior**: identical to every other field on this form —
part of the same `update()` Store call, same dirty-tracking, same submit
flow. No separate save action for this fieldset.

**Accessibility requirements**: identical bar to the existing "Safety
target settings" fieldset — `<fieldset>`/`<legend>` semantic grouping,
`<label>` wrapping each `<input>`, `aria-invalid`/`aria-describedby`
wired to real validation-error text, no color-only error indication. This
matches `docs/ACCESSIBILITY_CONFORMANCE.md` §7 ("Form accessibility
audit")'s existing conformance bar, which this new fieldset must meet, not
merely aim for.

**Mobile/responsive requirements**: the existing Portfolio Details form's
responsive layout (verified in Batch 7 of this engagement,
`docs/ACCESSIBILITY_CONFORMANCE.md` and the mobile E2E suite) already
governs every fieldset on this page generically — the new fieldset uses
the same container/spacing classes as its siblings and requires no new
responsive behavior of its own.

---

## 8. Recommendation Center behavior

**Taxonomy** (`features/recommendations/utils/recommendationTaxonomy.ts`):
- `RECOMMENDATION_FILTER_CATEGORIES` is unchanged (still the six
  documented categories) — `debt` and `leverage` simply gain real,
  populated content.
- `FILTER_CATEGORY_BY_RECOMMENDATION_CATEGORY` gains `borrow` mapping to
  `'debt'` (joining `repayment`, which already maps there) — `debt`
  becomes the first category that can show more than one item.
- `UNAVAILABLE_FILTER_REASONS.leverage`'s existing Conflict #29-citing
  text is **replaced** with an actionable, per-portfolio-state message —
  since the category is no longer permanently blocked, a static
  "blocked by Conflict #29" string would become actively wrong the moment
  a user configures their Loop preferences. Its replacement reuses the
  Store's own per-item `unavailableReasons.loop` (§6.3) rather than a
  second, independently-maintained copy of similar text — the same "one
  place a reason is worded" discipline this codebase already applies (see
  `recommendationTaxonomy.ts`'s own note about not duplicating the
  Engine's `UNAVAILABLE_CATEGORIES` strings unnecessarily).
- `debt` gains no new `UNAVAILABLE_FILTER_REASONS` entry — it is never
  wholly unavailable (repayment is always present once `targetHealthFactor`
  is set), so a category-level "unavailable" banner is inappropriate;
  instead, when `borrow` specifically is unavailable, its *own* item-level
  reason is shown wherever `RecommendationList` would otherwise render a
  Borrow row (§8's List behavior below).

**`RecommendationList.tsx`**:
- `ITEM_ORDER` extends to `['repayment', 'additionalCollateral', 'borrow',
  'loop']` — matching the Engine's own `DECISION_PRIORITY_ORDER`-informed
  ranking already used for the existing two items (`services/recommendation/recommendations.ts:76-82`),
  since `borrow`'s `decisionPriority` is `'Improve Capital Efficiency'`
  and `loop`'s is also `'Improve Capital Efficiency'` — both slot after
  `additionalCollateral`'s `'Maintain Target Health Factor'` tier in the
  existing `SEVERITY_BY_DECISION_PRIORITY` mapping, requiring no new
  severity-tier logic.
- The list only ever renders items present in `items` (§6) — an
  unconfigured Borrow/Loop is not shown as a disabled or greyed-out row;
  instead, a compact, dismissable-free informational line appears once
  per unavailable item within its filter category, using
  `unavailableReasons[id]` verbatim, matching the existing "Not available
  for this category" pattern (`RecommendationList.tsx:217-221`) but scoped
  per item rather than per whole category (since `debt` can be partially
  available).
- `allHealthy`'s existing "no action needed" banner logic
  (`RecommendationList.tsx:190-205`) extends naturally — `allItems` now
  potentially includes up to 4 entries, and the banner's own
  `isActionableRecommendation` check already generalizes to `borrow`/`loop`
  once `recommendationTaxonomy.ts`'s `isActionableRecommendation` (§8.1
  below) is extended.

**`recommendationTaxonomy.ts`'s `isActionableRecommendation`** extends its
existing two-way switch to four ways:
```ts
export function isActionableRecommendation(id, recommendation): boolean {
  if (id === 'repayment') return recommendation.relevantValues.requiredRepayment > 0;
  if (id === 'additionalCollateral') return recommendation.relevantValues.requiredUsd > 0;
  if (id === 'borrow') return !recommendation.relevantValues.debtRatioOk /* i.e. NOT acceptable */
    ? false /* "do not borrow" is itself the actionable-avoidance signal, see below */
    : true; // "Borrowing is acceptable" — see presentation note
  // loop: analogous
}
```
**This needs a specification decision of its own, made here explicitly**:
unlike Repayment/Additional Collateral (where "no action" means a `0`
required amount — an unambiguous, already-Engine-computed signal), Borrow
and Loop are binary accept/reject recommendations with no numeric
"how much" to check. **Decision: `borrow`/`loop` are always classified
`'Informational'`-tier severity when their own condition evaluates to
"acceptable"/"loop recommended" (nothing the user needs to act on — the
current state is fine), and their existing `decisionPriority`-derived tier
("Improve Capital Efficiency" → `'Medium'`) only when the condition
evaluates to "not acceptable"/"stop looping"** — mirroring
`severityFor`'s existing "a confirmation must never sit at the same tier
as a real action" principle (`recommendationTaxonomy.ts:99-113`), applied
to Borrow/Loop's own binary shape rather than Repayment/Additional
Collateral's zero-amount shape. This is a UI severity-tiering decision,
not a change to any `relevantValues` or Engine output.

**`RecommendationDetailPanel.tsx`**:
- `labels` (currently `selectedItemId === 'repayment' ?
  REPAYMENT_VALUE_LABELS : ADDITIONAL_COLLATERAL_VALUE_LABELS`) extends to
  a lookup over all four ids, with two new label maps —
  `BORROW_VALUE_LABELS` (`healthFactor`, `userMinHealthFactor`,
  `availableBorrow`, `debtRatio`, `targetDebtRatio` — F-061's exact
  `relevantValues` keys, `calculateBorrowRecommendation.ts:106-112`) and
  `LOOP_VALUE_LABELS` (`newHealthFactor`, `targetHealthFactor`,
  `availableBorrow`, `annualInterestCost`, `maxAcceptableAnnualInterestCost`
  — F-064's exact keys, `calculateLoopRecommendation.ts:88-94`) — following
  the existing exhaustive, explicit-label-map precedent, not a generic
  formatter.
- `RELATED_TOOL_BY_ITEM` gains `loop: 'Loop Builder'` — the direct,
  honest mapping M7-034's own named example ("Review leverage") implies,
  and the only planning tool in this codebase that models an additional
  loop step at all. **For v1.18.0, this is navigation only, not a
  prefill** — Loop Builder's own strategy inputs (minHealthFactor,
  targetBorrowPercentage, maxLoops — a multi-step strategy) do not map
  1:1 onto F-064's single-step "one more loop" question, and inventing an
  approximate prefill mapping would risk misrepresenting the
  recommendation's own scope. `borrow` gets **no related tool** ("Related
  Strategy Tool" section renders "No related planning tool for this
  recommendation.") — there is no "borrow more without adding collateral"
  planning tool anywhere in this application to honestly link to; Loop
  Builder loops collateral and debt together, not debt alone. Inventing a
  mapping here would be exactly the kind of false-precision this
  specification's own governing instructions warn against.
- The "Assumptions" section's existing text
  (`RecommendationDetailPanel.tsx:357-372`) extends to also name
  `recommendationPreferences` for `borrow`/`loop` items specifically —
  e.g. "Uses this portfolio's own configured minimum Health Factor and
  target Debt Ratio from Portfolio Settings → Recommendation Preferences,"
  mirroring the existing targetHealthFactor sentence's own phrasing and
  pointing to §7's new fieldset by name.
- **Presentation text** (the headline shown instead of raw
  `recommendation.suggestedAction`/`triggeringCondition` for `borrow`/`loop`)
  is defined in §10, not here — this section only specifies *where* it
  renders (same slots: "Triggering Condition," "Suggested Action").

**Confidence/data-quality presentation**: unchanged — the existing
`RecommendationConfidence`/`explainTargetHealthFactorActions` machinery
(V1.1 Batch 5) is scoped to `repayment`/`additionalCollateral` only today
and stays that way for v1.18.0; extending quantified-impact explanations
to `borrow`/`loop` is **out of scope** (§16) — F-061/F-064 do not go
through `buildPortfolioActionApplyProposal` today, and building that
integration is a materially separate piece of work from resolving
Conflict #29's sourcing gap.

**Before preferences are configured**: a user visiting the Recommendation
Center who has not yet set `recommendationPreferences` sees exactly
today's shipped experience — two items, `debt`/`collateral`/`safety`/
`interest`/`exitReadiness`/`leverage` filters behaving as they do today,
except `leverage`'s reason text now says "configure your Loop preferences
in Portfolio Settings" instead of citing Conflict #29 by number (§8's
taxonomy change above) — a **strict UX improvement** with zero behavior
regression for a user who never touches the new fieldset.

---

## 9. Dashboard behavior

**Decision: v1.18.0 does NOT extend Dashboard's recommendation summary to
include Borrow/Loop. It stays limited to the Recommendation Center.**

**Audit of the existing Dashboard architecture**: `RecommendationSummarySection`
(`app/DashboardPageClient.tsx:682-683`) renders `buildRecommendationSummary(record.portfolio)`,
whose own header comment already states its scope decision explicitly —
"Only shown when a target Health Factor is configured, and only the items
that are actually actionable" — and that decision was made *for the same
Conflict #29 reason* this document resolves
(`features/dashboard/utils/buildRecommendationSummary.ts:1-11`).

**Why not extend it anyway, now that the blocker is resolved**:
1. **No configuration surface exists on the Dashboard.** `RecommendationSummarySection`
   is a passive summary — there is no Dashboard-level form, and this
   specification deliberately does not add one (§7 places configuration
   on Portfolio Details only). A user could see Borrow/Loop items
   silently appear or disappear on the Dashboard with no proximate
   explanation of *why*, unlike the Recommendation Center, which has
   `UNAVAILABLE_FILTER_REASONS`/`unavailableReasons` machinery built
   specifically to explain exactly that (§8).
2. **`HealthFactorStatus`/`LiquidationRiskPanel`** (M5-007/M5-009) — the
   Dashboard's own "Required action to restore target" panels — made the
   identical scoping choice for the identical reason
   (`features/dashboard/types/healthFactorStatus.ts:18`,
   `features/dashboard/types/liquidationRiskPanel.ts:20`), and this
   specification does not have new evidence to override an
   already-deliberate, already-documented Dashboard architecture decision
   made across three separate files.
3. **Not required by any task**: no `06_TASKS.md` M5-xxx task names
   Borrow/Loop specifically as required Dashboard content — M5-015's own
   DoD ("Recommendations are transparent and traceable to deterministic
   rules") is already satisfied by the two items it shows today, and
   remains satisfied unchanged.

Per the roadmap audit's own standing instruction ("Do not expand
Dashboard semantics merely for parity if the existing contract doesn't
support it"), this specification does not expand it. A future,
independently-scoped batch could extend `buildRecommendationSummary` to
call `calculateRecommendationActions` (§6.1) once a Dashboard-appropriate
"why is this missing" affordance is separately designed — that design
question is **not** answered by this document (§16, non-goal).

---

## 10. User-facing language contract

**ENGINE OUTPUT / TRACEABILITY** (unchanged, always available, never
hidden): `Recommendation.triggeringCondition`, `.suggestedAction`,
`.expectedEffect`, `.relevantValues`, `.decisionPriority`,
`.formulaReferences` — F-061/F-064's own literal computed strings and
values, exactly as `engine/recommendation/calculateBorrowRecommendation.ts`/
`calculateLoopRecommendation.ts` already produce them. These remain fully
inspectable — the "Formula IDs" and "Current Values" sections of
`RecommendationDetailPanel.tsx` continue to show the raw Engine
`relevantValues`/`formulaReferences` verbatim, satisfying M7-033's own
"Every recommendation is understandable and traceable" DoD.

**USER-FACING PRESENTATION** (new, UI-layer only, additive): a small
presentation function — `presentationTextFor(id, recommendation):
{ headline: string; detail: string }` in `recommendationTaxonomy.ts`,
the same file already hosting `severityFor`/`filterCategoryFor` — used by
`RecommendationList`/`RecommendationDetailPanel` **only for the
"Triggering Condition"/"Suggested Action" display slots of `borrow` and
`loop` items**. `repayment`/`additionalCollateral`'s existing copy
("Repay $X to reach...", "Add $X in collateral...") is **not changed** —
it already reads as a conditional restatement of the user's own target,
not a naked directive, and Owner Decision 3 scoped the language concern
specifically to F-061/F-064's phrasing.

**Proposed wording** (implementation-ready; the raw Engine strings remain
available in the Detail Panel's "Current Values"/"Formula IDs" sections
regardless of which of these renders as the primary headline):

| Item | Condition | Raw Engine `suggestedAction` (unchanged, still traceable) | Proposed presentation |
|---|---|---|---|
| Borrow | acceptable | "Borrowing is acceptable." | "Based on your configured minimum Health Factor and target Debt Ratio, an additional borrow currently stays within your configured limits." |
| Borrow | not acceptable | "Do not recommend additional borrowing." | "An additional borrow would currently exceed at least one of your configured limits — minimum Health Factor or target Debt Ratio." |
| Loop | recommended | "Loop One More Time." | "Based on your configured Loop preferences, one more loop step currently stays within your configured Health Factor, borrow-capacity, and interest-cost limits." |
| Loop | not recommended | "Stop Looping." | "One more loop step would currently exceed at least one of your configured Loop limits — target Health Factor, available borrow capacity, or maximum acceptable interest cost." |

**Design rule these follow**: every presented sentence attributes the
threshold to "your configured" preference, never states an unqualified
imperative ("borrow more," "loop again," "stop"), and names which
specific configured value(s) the condition depends on — satisfying Owner
Decision 3's "make clear that recommendations are deterministic outputs
based on the user's configured preferences and current portfolio inputs"
requirement directly, without altering `triggeringCondition`'s own value
(still shown, unrelabeled, in "Current Values") or any `relevantValues`
number.

**No legal research, no disclaimer language, invented here** — per
instruction, this is a tone/register change only, not a legal-disclaimer
addition. No "not financial advice" text is introduced by this
specification; if the owner wants one, that is a separate, explicit future
decision, not implied by this document.

---

## 11. Formula traceability

| Output | Formula ID | Inputs | Changed by this spec? |
|---|---|---|---|
| Borrow recommendation | F-061 | Collateral, debt, market, protocol, `userMinHealthFactor`, `targetDebtRatio` | **No** — `engine/recommendation/calculateBorrowRecommendation.ts` is not modified |
| Repayment recommendation | F-062 | Collateral, debt, market, protocol, `targetHealthFactor` | **No** — `calculateRepaymentRecommendation.ts` is not modified |
| Additional Collateral recommendation | F-063 | Collateral, debt, market, protocol, `targetHealthFactor` | **No** — `calculateAdditionalCollateralRecommendation.ts` is not modified |
| Loop recommendation | F-064 | Collateral, debt, market, protocol, `targetHealthFactor`, `loopBorrowPercentage`, `maxAcceptableAnnualInterestCost` | **No** — `calculateLoopRecommendation.ts` is not modified |

**Confirmed**: F-061, F-062, F-063, F-064 are unchanged by every
requirement in this document — every `relevantValues` key, every
`formulaReferences` array, every triggering condition and equation stays
exactly as `docs/02_Formulas.md` and the existing Engine code define them.
This specification only supplies a *source* for parameters those
functions already declared as required inputs.

**No new Formula ID is assigned.** The new Service function
(`calculateRecommendationActions`, §6.1) is a task-level orchestrator, the
same class of function as `calculateLoopStrategy` (F-018, tagged with an
existing ID as its "primary" formula per established convention) or
`calculateTargetHealthFactorActions` (no ID at all, since it composes
existing Formula-ID-bearing functions without adding new mathematics).
Following the latter, closer precedent: `calculateRecommendationActions`
composes F-061/F-062/F-063/F-064 without adding any new equation of its
own, so it is not assigned a Formula ID — consistent with this
engagement's established "only frozen `02_Formulas.md` content gets a
Formula ID; project-specific derived Service logic does not" rule.

---

## 12. V3/V4 isolation

**The four preference fields themselves are fully protocol-neutral** —
user-entered numbers with no relationship to Aave protocol version,
exactly like `targetHealthFactor` today. No V3/V4 branching is needed for
persistence, schema, or the UI form (§4, §7).

**The Engine calls made from them are not** — this is the one place a
naive implementation could silently regress V4 correctness, and this
specification calls it out explicitly. `generateRecommendationSet`'s
existing V4 dispatch (`services/recommendation/recommendations.ts:107-194`)
already performs, in order, before ever calling `calculateBorrowRecommendation`/
`calculateLoopRecommendation`:
1. An anchor `calculateCollateralValue` call for real Engine metadata
   (`sourceStatus`/`engineVersion` provenance).
2. `checkAaveV4DebtStateAvailable` — fails closed if a V4 portfolio has no
   synced `v4DebtState` (never compute from stale legacy `debt.balance`).
3. `checkAaveV4DebtAssetPriceAvailable` — fails closed for a live V4
   debt-asset with no oracle price.
4. `checkAaveV4CollateralRiskAvailable` — fails closed if V4 risk
   parameters aren't synced.
5. `deriveAaveV4EffectiveBorrowRate` substitution into
   `engineInput.protocol.borrowApr`, for V4's real effective rate instead
   of the legacy V3-shaped scalar (needed by Loop's interest-cost check).
6. `resolveRiskCapacityFraction` substitution into both
   `liquidationThreshold` and `maxLoanToValue`, since V4 has no separate
   LTV/liquidation-threshold split.

**Requirement: `calculateRecommendationActions` (§6.1) must reuse this
exact same six-step dispatch sequence**, not skip it, for its `borrow`/
`loop` branches — calling `calculateBorrowRecommendation`/
`calculateLoopRecommendation` directly without it would silently compute a
V4 portfolio's Borrow/Loop recommendation from V3-shaped/stale inputs,
exactly the class of regression `services/portfolio/mapping.ts`'s guard
functions exist to prevent. This is not a new V4 rule — it is reusing the
same guard functions (`checkAaveV4DebtStateAvailable`,
`checkAaveV4DebtAssetPriceAvailable`, `checkAaveV4CollateralRiskAvailable`,
`deriveAaveV4EffectiveBorrowRate`, `resolveRiskCapacityFraction`, all
already exported from `services/portfolio/mapping.ts`) the existing
`generateRecommendationSet` and `calculateTargetHealthFactorActions`
already both call — no new V4 logic is invented, only correctly reused.

**No V3/V4 normalization or semantic leakage**: the preference fields
never appear in, and are never derived from, any V3- or V4-specific type
(`AaveV4PositionIdentity`, `AaveV4DebtState`, `AaveV4CollateralRiskConfig`,
`ProtocolParameters`). They remain pure user input, identical in shape and
meaning regardless of which protocol version the portfolio uses.

---

## 13. Validation/error behavior

| Case | Behavior |
|---|---|
| Invalid HF (`userMinHealthFactor <= 0`, non-finite, `NaN`) | Rejected at the schema boundary (`z.number().finite().positive()`, §4) before persistence — matches `calculateBorrowRecommendation`'s own `validatePositive` bound exactly, so a value the schema accepts can never later fail the Engine call for the same reason |
| Invalid ratio (`targetDebtRatio` or `loopBorrowPercentage` outside `[0, 1]`, non-finite) | Rejected at the schema boundary (`z.number().finite().min(0).max(1)`) — matches `validatePercentage` exactly |
| Invalid/negative interest-cost limit (`maxAcceptableAnnualInterestCost <= 0`, non-finite) | Rejected at the schema boundary (`z.number().finite().positive()`) — matches `validatePositive` exactly |
| `NaN`/`Infinity` in any of the four fields | Rejected by `.finite()` on every field — no field in this schema accepts a non-finite value, consistent with every other numeric field in `portfolio.schema.ts` |
| Incomplete preference sets (one of a rule's fields set, the other absent) | **Not a validation error** — each field is independently optional at the schema level; §5 governs this as an *availability* state (the item stays unavailable), not a rejected input. The form (§7) does not require both fields of a pair together — a user is free to fill in one field and leave the page, and it persists exactly as entered |
| Corrupted imported values (out-of-range, wrong type, `NaN` inside a JSON import) | Rejected by the same `persistedPortfolioPayloadSchema` validation `previewImport`/`applyValidatedImport` (`services/import`) already runs against every other field — a corrupted `recommendationPreferences` value fails import validation identically to a corrupted `safetyTargets` value today; no field-specific import logic is added |

**No silent fallback anywhere in this table** — every invalid or
incomplete case either is rejected outright (persistence/import) or
results in an explicit "unavailable, here's why" state (§5, §8), never a
substituted, clamped, or defaulted value.

---

## 14. Compatibility and migration

**A v1.17.0 portfolio, loaded by v1.18.0, step by step:**

1. **Load**: `settings.recommendationPreferences` is `undefined` — the
   updated `portfolioSettingsSchema`/`persistedPortfolioPayloadSchema`
   parse the record exactly as before, since the new field is optional at
   every nesting level (§4). No parse error, no migration step runs.
2. **F-062/F-063 (Repayment/Additional Collateral)**: continue showing
   exactly as they do today, if `settings.safetyTargets.targetHealthFactor`
   is set — `calculateRecommendationActions`'s steps 1–2 (§6.1) are
   byte-identical in logic to today's `calculateTargetHealthFactorActions`
   call.
3. **F-061/F-064 (Borrow/Loop)**: show as **unavailable**, with the
   specific "configure your preferences in Portfolio Settings" reason
   (§6.1 steps 3–4, §8) — never silently computed from a substituted or
   invented value, and never an error state (§5's table, row 2).
4. **No change to the user's financial intent**: nothing about this
   portfolio's collateral, debt, market data, protocol parameters, or
   existing `safetyTargets`/`executionCostAssumptions` is read, written,
   or reinterpreted by loading it under v1.18.0. The only new state is an
   `undefined` object that behaves identically to "not present" everywhere
   it's read.
5. **The user must take an explicit action** (filling in the new §7
   fieldset) before Borrow/Loop recommendations ever appear for this
   portfolio — there is no implicit opt-in, migration-generated value, or
   inferred preference (Owner Decision 1's "must NOT receive silent
   product defaults," enforced structurally by §5/§6's design, not by
   convention alone).

---

## 15. Testing requirements

**Schema tests** (`tests/unit/types/portfolio.schema.test.ts` or
sibling): `recommendationPreferencesSchema` accepts a fully-populated
object, accepts each field independently absent, rejects each field's
documented out-of-range/non-finite value individually, accepts the whole
`recommendationPreferences` object absent, round-trips through
`portfolioInputSchema`/`persistedPortfolioPayloadSchema` unchanged for a
payload that never sets it.

**Persistence/import tests**: a full JSON backup/restore round-trip
preserves all four fields exactly (including the fully-absent case); an
import payload with an out-of-range value for one of the four fields is
rejected with the same class of error `previewImport` already produces
for an out-of-range `safetyTargets` value.

**Store/service tests** (`tests/unit/services/recommendation/recommendationActions.test.ts`,
new; `tests/unit/stores/recommendationCenterStore.test.ts`, extended):
every row of §5's table as an individual test case (none configured, only
borrow, only loop, partial borrow, partial loop, all configured); a V4
portfolio missing `v4DebtState`/`v4CollateralRisk` still fails closed for
`borrow`/`loop` exactly as it already does for `repayment`/
`additionalCollateral` (§12); `calculateTargetHealthFactorActions`'s own
existing test suite is unmodified and still passes (proving Dashboard's
path is untouched, §9).

**Recommendation Center component tests**
(`tests/unit/features/recommendations/*`, extended; new for the two new
label maps and `presentationTextFor`): `RecommendationList`/
`RecommendationDetailPanel` render `borrow`/`loop` rows correctly once
available, render the correct per-item unavailable reason when not,
`leverage` filter category transitions from "always unavailable" to
"available once configured" across a test that sets preferences mid-test;
`presentationTextFor`'s four proposed strings (§10) are asserted
per-condition, and the raw Engine `suggestedAction` remains separately
assertable (proving the two are decoupled, not that one replaced the
other).

**Dashboard tests**: a regression test asserting
`buildRecommendationSummary`'s output is unchanged for a portfolio that
now also has `recommendationPreferences` fully configured — proving §9's
"Dashboard stays scoped to two items" decision holds even when the new
capability exists.

**V3 tests**: a V3 portfolio with `recommendationPreferences` fully
configured produces `borrow`/`loop` recommendations using
`resolveRiskCapacityFraction`'s existing V3 branch, unchanged from how
`generateRecommendationSet`'s own existing V3 tests already verify this.

**V4 tests**: mirroring `generateRecommendationSet`'s and
`calculateTargetHealthFactorActions`'s own existing V4 test suites —
`borrow`/`loop` fail closed for missing `v4DebtState`/missing oracle
price/missing `v4CollateralRisk`, and succeed with the correct
dispatched risk-capacity fraction and effective borrow rate once V4 state
is fully synced (§12).

**Partial-configuration tests**: covered by the Store/service test list
above — every row of §5's table, not just the two endpoints.

**Accessibility tests**: extend the existing Portfolio Details form
accessibility test coverage (whatever test currently exercises the
"Safety target settings" fieldset) to also cover the new "Recommendation
preferences" fieldset — same assertions (label association, error
association, no color-only signaling), applied to the four new fields.

**E2E tests**: extend `tests/e2e/portfolioWorkflows.spec.ts` (or add a
sibling) covering the full v1.18.0 golden path: configure all four
preferences on Portfolio Details → navigate to Recommendation Center →
see Borrow and Loop items appear → verify the presented (not raw) text
renders. **Fold in the previously identified Starting-Value Baseline
E2E/axe gap** (the v1.18.0 roadmap audit's own OPTION C Batch 1 finding)
as a **separate, independent E2E addition in the same validation pass** —
it does not touch Recommendation preferences and expands no product
semantics of its own, so bundling its test-writing into this release's
quality-validation plan is consistent with "fold in... if it can be done
without expanding product semantics," without pretending it is part of
this specification's own scope (§16 keeps it a distinct, already-scoped
item).

**Explicitly not padded**: no test is proposed above solely to raise a
count. Every listed test corresponds to a row in §5's table, a guard in
§12, a schema bound in §3/§13, or an already-existing suite this change
must not silently break.

---

## 16. Explicit non-goals

This specification, and the v1.18.0 batches built from it, do **not**:

- Resolve Conflict #1 (Health Factor risk-band canonicalization).
- Resolve Conflict #11 (Exit readiness Formula ID).
- Resolve Conflict #12 (F-067 Simple Portfolio Score component formulas).
- Define F-065's "Expected Annual Portfolio Growth" figure or unlock the
  Interest Cost recommendation category.
- Define cost basis, P&L, total return, or transaction-lot accounting in
  any form (the deferred Model D question from the v1.17.0/v1.18.0
  research phases).
- Change ProfitPilot's deployment posture (cloud sync, production
  hosting) in any way — Path B is unaffected.
- Invent any recommendation default, preset, or "balanced"/"conservative"/
  "aggressive" preference value (Owner Decision 4) — no such value exists
  anywhere in this document, and none should be added by an implementing
  batch without a separate, explicit owner decision.
- Extend Dashboard's recommendation summary to include Borrow/Loop (§9).
- Extend the Quantified Impact / `RecommendationExplanation` machinery to
  Borrow/Loop (§8).
- Extend CSV portfolio export to include `safetyTargets`/
  `recommendationPreferences` (§4).
- Add a "not financial advice" or any other legal disclaimer (§10).

---

## 17. Conflict #29 closure criteria

`PROJECT_STATUS.md` entry 29 may be marked resolved once an implementing
batch produces **all** of the following, verifiable directly against the
repository:

1. `RecommendationPreferences` exists on `PortfolioSettings`
   (`types/portfolio.ts`), matching §4's shape exactly, with a
   corresponding Zod schema (`types/portfolio.schema.ts`) enforcing
   exactly §3's bounds.
2. `calculateRecommendationActions` (or an equivalently-named Service
   function meeting §6's contract) exists, is exported from
   `services/recommendation/index.ts`, and is the function
   `recommendationCenterStore.recalculate` calls.
3. A portfolio with all four preference fields configured produces real,
   non-null `borrow` and `loop` `Recommendation` objects, sourced from the
   unmodified `calculateBorrowRecommendation`/`calculateLoopRecommendation`
   Engine functions, visible in the Recommendation Center UI.
4. A portfolio with none, or only some, of the four fields configured
   behaves exactly per §5's table — verified by the partial-configuration
   test suite (§15).
5. `engine/recommendation/calculateBorrowRecommendation.ts` and
   `engine/recommendation/calculateLoopRecommendation.ts` are
   byte-identical to their v1.17.0 versions (or differ only in
   non-semantic formatting) — proving §11's "F-061/F-064 unchanged"
   requirement held throughout implementation.
6. `docs/RECOMMENDATION_ENGINE_PREFERENCES_SPEC.md` (this document) is
   referenced by name in the implementing batch's `PROJECT_STATUS.md`
   reconciliation entry, and Conflict #29's own entry is updated to point
   to that reconciliation rather than restating resolution details
   in-line — matching `docs/STARTING_VALUE_BASELINE_SPEC.md` §17's own
   traceability precedent.
7. `pnpm validate` (or the project's equivalent full gate) passes with the
   new schema/service/store/component tests included, and the existing
   `generateRecommendationSet`/`calculateTargetHealthFactorActions` test
   suites pass unmodified.

Until all seven are true, Conflict #29 remains open — a partially-built
batch (e.g. schema only, no UI) does not close it.

---

## 18. Proposed implementation batches

Proposed only — not authorized for implementation by this document.

### Batch 1 — Data model, schema, and preference source

- **Objective**: make the four preference fields real, persisted,
  validated `Portfolio` data, with zero UI and zero behavior change to
  any existing recommendation.
- **Files/subsystems**: `types/portfolio.ts` (`RecommendationPreferences`
  interface), `types/portfolio.schema.ts`
  (`recommendationPreferencesSchema`, added to `portfolioSettingsSchema`).
  `services/persistence/schemas/portfolio.schema.ts` requires no direct
  edit (inherits via `portfolioSettingsSchema`) — verify this during the
  batch rather than assuming it.
- **Schema/persistence impact**: additive only, per §4.
  `STORAGE_SCHEMA_VERSION` unchanged.
- **Tests**: §15's schema tests, persistence round-trip tests.
- **Validation gate**: `pnpm validate` (or focused schema/persistence
  suites first, full gate before batch sign-off).
- **Explicit scope boundary**: no Service, Store, or UI file is touched.
  No recommendation becomes newly visible to any user in this batch.

### Batch 2 — Service integration (Borrow/Loop become computable)

- **Objective**: `calculateRecommendationActions` exists and correctly
  implements §5's partial-configuration table and §12's V4 dispatch
  reuse, callable and testable, but not yet wired into any Store.
- **Files/subsystems**: `services/recommendation/recommendationActions.ts`
  (new), `services/recommendation/index.ts` (export).
- **Schema/persistence impact**: none beyond Batch 1's.
- **Tests**: §15's Store/service tests (all of §5's table, V3, V4, guard
  reuse).
- **Validation gate**: focused `services/recommendation` test suite, then
  full `pnpm validate`.
- **Explicit scope boundary**: `generateRecommendationSet`,
  `calculateTargetHealthFactorActions`,
  `calculateBorrowRecommendation`/`calculateLoopRecommendation` are not
  modified — only called. No UI file is touched.

### Batch 3 — Recommendation Center wiring and UI configuration surface

- **Objective**: `recommendationCenterStore` calls the new Service
  function; `RecommendationList`/`RecommendationDetailPanel`/
  `recommendationTaxonomy.ts` render `borrow`/`loop` per §8; the new
  Portfolio Details fieldset (§7) exists.
- **Files/subsystems**: `stores/recommendationCenterStore.ts`,
  `features/recommendations/utils/recommendationTaxonomy.ts`,
  `features/recommendations/components/RecommendationList.tsx`,
  `features/recommendations/components/RecommendationDetailPanel.tsx`,
  `app/portfolio/PortfolioPageClient.tsx` (new fieldset).
- **Schema/persistence impact**: none beyond Batch 1's (this batch only
  reads/writes through the existing form-submission path).
- **Tests**: §15's Recommendation Center component tests, accessibility
  tests for the new fieldset.
- **Validation gate**: focused component/store suites, then full
  `pnpm validate`.
- **Explicit scope boundary**: Dashboard files are not touched (§9). No
  Quantified Impact/`RecommendationExplanation` extension.

### Batch 4 — Presentation language, E2E coverage, and Baseline E2E fold-in

- **Objective**: `presentationTextFor` (§10) implemented and wired for
  `borrow`/`loop` display slots; E2E coverage for the full v1.18.0 golden
  path; the previously identified Starting-Value Baseline E2E/axe gap
  closed in the same pass (§15).
- **Files/subsystems**: `features/recommendations/utils/recommendationTaxonomy.ts`
  (or a new sibling file for presentation text specifically),
  `tests/e2e/portfolioWorkflows.spec.ts` and/or
  `tests/e2e/accessibility.spec.ts` (both the new Recommendation
  preferences flow and the Starting-Value Baseline gap).
- **Schema/persistence impact**: none.
- **Tests**: §15's E2E requirements; presentation-text unit tests.
- **Validation gate**: full `pnpm validate` plus full Playwright suite.
- **Explicit scope boundary**: no new financial semantics; this batch is
  test- and copy-only.

---

## 19. Specification self-audit

Audited against the live repository at the verified baseline
(`dfad725824cd81f10bd0279ee8f80f5715560e9c` = `origin/main` = `v1.17.0`),
not against memory of it:

- Every field bound in §3 was re-verified against the exact `validate.ts`
  call the corresponding Engine function makes (`validatePositive`/
  `validatePercentage`), not assumed from the earlier Conflict #29
  analysis.
- The persistence-model decision (§4) was checked against the *existing*
  `ExecutionCostAssumptionsSettings` precedent by reading its real
  location in `types/portfolio.ts` and its schema counterpart in
  `types/portfolio.schema.ts`, confirming it is genuinely a sibling
  object, not a field folded into `PortfolioSafetyTargets` — this
  grounds §4's "semantic cohesion" reasoning in a real, checked precedent
  rather than an assumed one.
- §6's integration design was checked against the actual current shape of
  `TargetHealthFactorActions`, `RecommendationItemId`, and every UI file
  that indexes on it (`RecommendationList.tsx`, `RecommendationDetailPanel.tsx`,
  `recommendationTaxonomy.ts`) — all three were read in full this phase,
  not inferred, to confirm exactly which literal-keyed structures would
  need to generalize from two to four items.
- §12's V4 dispatch requirement was checked against the real,
  already-implemented six-step sequence in
  `services/recommendation/recommendations.ts:107-194`, confirming it is
  a reuse instruction, not a new design.

**Remaining ambiguity, surfaced rather than resolved by guessing:**

1. **§8's Borrow/Loop severity-tiering rule** (binary accept/reject → a
   `'Informational'`/`'Medium'` split, proposed in §8) is this
   specification's own judgment call, not derived from an existing
   documented rule the way Repayment/Additional Collateral's zero-amount
   severity check was. It does not invent any financial semantics or
   threshold — it only decides which existing UI severity label a
   already-computed boolean condition maps to — but it is worth the
   owner's explicit awareness that this one small piece of §8 is a
   specification-author judgment call, not a re-derivation of documented
   product behavior. If the owner disagrees with the proposed mapping, it
   can be corrected without touching any other part of this document.
2. **§8's "no related tool for Borrow" decision** is similarly this
   document's own judgment (favoring honesty over completeness), not a
   pre-existing rule. An owner could instead decide a future batch should
   build a dedicated "borrow more" planning surface — that would be new
   scope, not a correction to this document, and is not proposed here.

Neither of these two items requires inventing financial semantics, a
numeric threshold, or a default value — both are presentation/UX
judgment calls within the bounds Owner Decisions 1–4 already set. Per
instruction, they are surfaced rather than silently decided past the
owner's attention; nothing else in this document depends on either being
resolved differently for the batches in §18 to proceed.

---

## 20. Final verdict

**SPEC READY — implementation may begin**, subject to the owner reading
§19's two surfaced (non-blocking) judgment calls and raising any
objection before Batch 3 (§18) — the only batch that touches either.
Batches 1 and 2 (§18) depend on neither and may begin immediately once
this document is approved.

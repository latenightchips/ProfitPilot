# Accessibility Conformance Report

`06_TASKS.md` M9-028 ("Document Accessibility Conformance"). Dependencies:
M9-022–M9-027. Priority P1, Effort M. Include: "Standards targeted, Tools
used, Manual workflows reviewed, Known limitations." DoD: "Accessibility
status is transparent and reviewable before release."

This document is that record, written after M9-022–M9-027's own audit and
fix work (Milestone 9 Batch 5), not before it.

## 1. Standards targeted

**WCAG 2.1 Level AA**, the same target established and reused since
Milestone 5/6's own accessibility work:

- `01_PRD.md` REQ-008-F / REQ-011-E: "WCAG AA Compliance... Target WCAG
  AAA where practical."
- `03_UI.md`'s own "ACCESSIBILITY" section: "Minimum Target: WCAG AA."
  Support items named there: Keyboard Navigation, Screen Readers, High
  Contrast, Scalable Fonts.
- `04_BUILD_GUIDE.md`'s own "ACCESSIBILITY" line is a single checklist
  tick with no further content — not treated as authoritative; see
  `tests/e2e/accessibility.spec.ts`'s own header comment for the same
  finding, re-confirmed for this batch.

AAA is targeted "where practical" per REQ-008-F, not claimed outright —
no AAA-specific automated check (e.g. 7:1 contrast) runs anywhere in this
suite; every automated scan below is scoped to `wcag2a`/`wcag2aa` tags
only.

## 2. Tools used

| Tool | What it checks | Where |
|---|---|---|
| `@axe-core/playwright` | Automated WCAG 2.1 A/AA rule scans (landmarks, labels, contrast, duplicate IDs, ARIA validity, heading order, and more) against a real, compiled, running app | `tests/e2e/accessibility.spec.ts` — 25 pre-existing scans (Milestone 5/6) + 8 new this batch (Portfolios list, Create Portfolio, Portfolio edit ×2, Settings ×2, Sign In, Sign Up, Reset Password) |
| Scripted keyboard-reachability checks | Every interactive control on a page is reachable via repeated `Tab` presses alone, asserted by name | Same file — 10 pre-existing + 5 new this batch |
| Direct code audit | Color-only meaning, motion/animation usage, form field↔error association, required-field marking, `aria-hidden`/`role="dialog"`/`role="menu"` presence | Manual, this batch (§4–§6 below) |
| TypeScript strict + ESLint | Structural correctness (no unused ARIA props, no invalid JSX) | `pnpm typecheck` / `pnpm lint`, run every batch |

No manual screen-reader session (JAWS, NVDA, VoiceOver) was recorded —
see §7, "Known limitations."

## 3. M9-022 — Automated accessibility audit

Review items per `06_TASKS.md`: Landmarks, Labels, Heading structure,
Contrast, Duplicate IDs, Accessible names, Form errors, ARIA usage.

**Coverage before this batch**: Dashboard, Simulation Workspace, Loop
Builder, Exit Planner, Recommendation Center — 25 axe scans across varied
states (empty, error, warning, validation-error, confirmation-panel-open).

**Gap closed this batch**: `docs/DOD_COMPLIANCE_AUDIT.md`'s own
re-check (re-confirmed again at the start of this batch) named 6 routes
with zero axe coverage — `/portfolios`, `/portfolios/new`, `/portfolio`,
`/settings`, `/sign-in`, `/sign-up`, `/reset-password` (`/portfolios/new`
and `/portfolio` are two distinct routes bringing the count to 7 covered
surfaces). Each now has at least one axe scan against a representative,
non-trivial state (a validation error, an open confirm panel, an open
import-conflict checklist), not just the bare empty page.

**Genuine violation found and fixed**: a WCAG AA "link-in-text-block"
failure on the Sign In and Sign Up pages — `<a class="text-primary
hover:underline">Sign in</a>` embedded inline inside
`text-muted-foreground` body text relied on color alone (1.06:1 contrast,
hover-only underline) to be distinguished from surrounding text. Fixed by
making the underline permanent (`hover:underline` → `underline`) across
all 6 occurrences on the 3 auth pages. `AppHeader.tsx`'s own,
differently-colored `hover:underline` links were deliberately left
unchanged — inspected directly and confirmed they never trigger this
rule across dozens of pre-existing Dashboard scans (different color
token, sufficient contrast on its own).

**Result**: zero unresolved axe violations across all 33 scans, all 12
routes, satisfying M9-022's own DoD.

## 4. M9-023 — Keyboard navigation audit

Review items: Logical tab order, Visible focus, Dialog focus trapping,
Menu operation, Form completion, Table interaction, Expandable content,
Route changes.

| Item | Finding |
|---|---|
| Logical tab order / Form completion | Verified per-route via scripted `Tab`-press reachability checks (15 tests total) — every critical control (submit buttons, form fields, list-row actions) is reachable and, where applicable, operable without a pointer. |
| Visible focus | Covered by a pre-existing dedicated test (`Cover: focus is always visibly indicated`) scanning for any reachable element with `outline: none` and no compensating focus style — zero found. |
| **Dialog focus trapping / Menu operation** | **N/A — confirmed, not assumed.** A direct search (`role="dialog"`, `<dialog`, `role="menu"`) across `app/`, `components/`, `features/` returns zero matches. Every "confirm" interaction in this application (portfolio delete, import replace-all, clear local data) is an inline, non-modal expand-to-confirm panel — `app/portfolios/page.tsx`'s own header comment documents this as a deliberate M4-012 design choice, not an oversight. No dialog or menu widget exists to trap focus in or operate. |
| Table interaction | Every table in this codebase is either pure static data display (covered by the `scope="col"` check, §5 below) or `LoopStepTable.tsx`'s own per-row `<details>/<summary>` disclosure — the one genuinely interactive table element, covered as "Expandable content" below. |
| Expandable content | `LoopStepTable.tsx`'s `<details>/<summary>` is native and keyboard-operable by design (`Space`/`Enter` toggles a focused `<summary>`) — verified directly with a dedicated test (focus, `Enter` to open, `Enter` to close), not assumed from "it's a native element." |
| Route changes | Next.js App Router's built-in `#__next-route-announcer__` announces `document.title` on every client-side navigation. Verified end-to-end: navigating Dashboard → Simulation → Settings updates `document.title` to the correct per-route value at each step (see M9-024 below for why this needed a real fix, not just a check). |

**Result**: every M9-023 Verify item is either covered by an automated
test or recorded as a confirmed structural N/A, satisfying its own DoD
("Every critical action is reachable and operable without a pointer
device").

## 5. M9-024 — Screen reader review

Review items: Page titles, Headings, Status messages, Warnings, Form
errors, KPI labels, Table headers, Chart alternatives, Modal
announcements.

**Genuine defect found and fixed — page titles.** Before this batch,
every route rendered the same static `<title>ProfitPilot</title>` (the
root layout's default metadata); a screen-reader user navigating between
routes had nothing distinguishing to hear from the route announcer.

The initial fix attempt — an imperative `document.title = ...` set from
a `useEffect` inside each page's Client Component — does not work in
Next.js App Router: the framework's own internal metadata-sync effect
lives higher in the component tree and, because React commits effects
child-before-parent on mount, always runs *after* a child page's own
effect, silently reverting the title. Confirmed empirically (console-log
instrumentation showed the hook's effect did run and did set
`document.title`, yet `page.title()` still reported the stale value; a
control test setting the title via `page.evaluate()` from outside React
persisted correctly, ruling out a periodic revert).

**Fix**: every one of the 12 routes was split into a thin, non-`'use
client'` `page.tsx` exporting Next.js-native `metadata: Metadata`, which
renders a Client Component (`<Name>PageClient.tsx`) containing the
route's entire original implementation, unchanged. This is the
idiomatic, framework-supported mechanism for a static per-route title,
and does not fight the framework's own effect ordering. Verified
end-to-end (§4 above) and confirmed to require zero changes to any of
the 167 existing page-level unit tests, since every route's default
export keeps the exact name those tests already import.

| Item | Finding |
|---|---|
| Headings | Every page has exactly one `<h1>`; section headings follow a logical, non-skipping order — covered incidentally by every axe scan's own heading-order rule. |
| Status messages | `role="status"` used consistently for non-urgent updates (autosave "Saved," import success) — an established convention (`SaveSimulationForm.tsx`), not `aria-live` used directly. |
| Warnings / Form errors | Rendered as visually-adjacent `<span role="alert">`/plain destructive-colored text; M9-026 (§6 below) adds the missing programmatic `aria-describedby`/`aria-invalid` association for per-field form errors. |
| KPI labels | Every KPI card pairs a numeric value with a visible text label in the same DOM region — no bare numbers without context. |
| Table headers | Every `<th>` in every table already carries `scope="col"` — verified by a pre-existing dedicated test, re-confirmed this batch. |
| Chart alternatives | Both recharts components (`ScenarioCharts.tsx`, `ScenarioTimeline.tsx`) already wrap each chart in a container with `role="img"` and a computed `aria-label` summarizing its values as text — not relying on recharts' own SVG output, which has no built-in accessible name. |
| Modal announcements | N/A — no modal/dialog exists (§4 above). |

## 6. M9-025 — Color and risk communication audit

Review items: Health Factor zones, Warnings, Positive/negative
comparisons, Sync state, Validation errors, Charts, Recommendations.

A direct audit found **no color-only-meaning violation anywhere in this
codebase.** Every meaningful status already pairs color with text,
independent of this batch's own work:

- Health Factor is displayed as a plain formatted number with a text
  label; this codebase has no colored "risk zone" bands to audit (no
  such banding is implemented — Health Factor is shown numerically, not
  as a colored gauge).
- Warnings render as text banners (`role="alert"` or plain destructive
  text), never a bare color swatch.
- Positive/negative comparisons (e.g. Simulation deltas) are rendered as
  signed numeric text (`+`/`-` prefix), not color alone.
- Sync/save state (`role="status"`) is always a text label ("Saved,"
  "Saving…"), never an icon-only or color-only indicator.
- Validation errors are always paired with visible message text next to
  the field (and now, per M9-026, programmatically associated with it).
- Charts (`ScenarioCharts.tsx`/`ScenarioTimeline.tsx`) use a single
  foreground color for all series — no color-coded legend to be
  colorblind-inaccessible in the first place.
- Recommendation severity (e.g. "High") is rendered as visible text, not
  a color-only badge.

**Result**: no code change was required for M9-025 — this section is
the audit record itself, satisfying its own DoD ("Text, symbols, labels,
or patterns communicate every meaningful status").

## 7. M9-026 — Form accessibility audit

Review items: Persistent labels, Helpful descriptions, Programmatic
error association, Error summaries where appropriate, Required-field
identification, Input units, Keyboard-friendly controls, No inaccessible
custom widgets.

**Baseline (found by direct audit, confirmed before fixing)**: every
form in this codebase used real, persistent `<label>` elements and plain
native `<input>`/`<select>`/`<textarea>` controls (no custom widgets to
begin with) — but zero `aria-describedby`/`aria-invalid` existed
anywhere, and required-field indicators existed only on the 3 auth forms
(via native `required`), absent from the portfolio create/edit forms
despite their fields being schema-required. This gap was investigated
and explicitly deferred once already, during Milestone 6 Batch 21's own
M6-022 review (`ScenarioBuilder.tsx`'s header comment recorded the
decision at the time) — this batch is that deferred, codebase-wide fix.

**Fixed, across every form with field-level validation errors**
(`app/portfolios/new/NewPortfolioPageClient.tsx`,
`app/portfolio/PortfolioPageClient.tsx` — 3 forms,
`features/loop-builder/components/LoopStrategyControls.tsx`,
`features/exit-planner/components/ExitTargetForm.tsx`,
`features/simulation/components/ScenarioBuilder.tsx`):

- Every field with a conditional error message now has a unique `id`,
  `aria-invalid="true"` when its own error is present, and
  `aria-describedby` pointing at that error message's own `id` — a real
  programmatic link a screen reader can follow, not just visual
  adjacency.
- Required fields on the two portfolio forms (previously the only forms
  missing any required-field indicator) now carry a visible, decorative
  `*` (`aria-hidden="true"`, so it is never announced as a bare
  character) paired with `aria-required="true"` on the input itself —
  the actual screen-reader-facing signal. Deliberately not the native
  `required` attribute: these forms validate entirely through
  `zodResolver` on submit/change, and native constraint validation would
  intercept submission with browser-native error UI before React Hook
  Form's own handler — and its own existing, tested Zod-message error
  text — ever runs.
- A first implementation used plain `sr-only` text ("(required)") next
  to the asterisk instead of `aria-required`; this was reverted after it
  silently broke 30 existing `getByLabelText('Portfolio name')`-style
  unit test queries by becoming part of each label's computed
  accessible name. `aria-required="true"` on the input carries the same
  information to assistive technology without touching the label's own
  text.

**Not changed / not applicable**:

- Error summaries (a single list of all errors, typically at the top of
  a long form) were not added — every form here is short enough (under
  10 fields) that inline, per-field errors next to each control are the
  more direct, already-established pattern; adding a redundant summary
  would not improve on it.
- Input units are already stated in every numeric field's own label text
  ("(USD)," "(0–1)," "(days)," "(%)") — no separate change needed.
- No inaccessible custom widget exists anywhere in this codebase (same
  finding as the "No inaccessible custom widgets" Review item) — every
  control is a native HTML form element.

**Result**: "Users can complete and correct every critical form
accessibly" (M9-026's own DoD) — every field with a validation error is
now both visually and programmatically identifiable, and every
schema-required field is identified before submission is attempted.

## 8. M9-027 — Motion and visual stability audit

Requirements: Respect reduced-motion preferences, Avoid distracting
metric animation, Avoid large layout shifts, Keep loading states stable.

**Baseline (found by direct audit)**: zero `prefers-reduced-motion`
usage anywhere in the codebase; `animate-pulse` loading skeletons
(`DashboardSkeleton.tsx`, `KpiCard.tsx`); `transition-colors` hover
states (3 files); recharts' default mount/update SVG animations never
disabled.

**Fixed**:

- `app/globals.css` gained a global `@media (prefers-reduced-motion:
  reduce)` rule collapsing every CSS `animation-duration` and
  `transition-duration` to near-zero, plus `scroll-behavior: auto`.
  Global and rule-based, not per-component, so every current and future
  `animate-*`/`transition-*` Tailwind utility is covered automatically —
  no need to hunt down and annotate each usage individually.
- `ScenarioCharts.tsx` and `ScenarioTimeline.tsx` (the only two
  components using recharts) now set `isAnimationActive={false}` on
  every `<Bar>`/`<Line>` — recharts' animation system is a separate,
  non-CSS SVG animation layer the `prefers-reduced-motion` media query
  above cannot reach, so it needed a direct, component-level fix.

**Not changed**: loading-state layout stability was already sound —
`DashboardSkeleton.tsx` renders fixed-size placeholder blocks matching
the loaded layout's own dimensions, so no additional layout-shift fix
was needed; this was confirmed by inspection, not assumed.

**Result**: "Motion does not interfere with comprehension or
accessibility" (M9-027's own DoD) — a user with `prefers-reduced-motion`
set sees near-instant transitions and static charts, codebase-wide.

## 9. Known limitations

- **No live screen-reader session was recorded** (JAWS, NVDA, VoiceOver
  running against the real, compiled app with a human or scripted
  listener). Every screen-reader-facing claim in this document is
  verified structurally — correct ARIA attributes, correct roles,
  correct accessible names, confirmed via axe-core's own rule engine and
  direct DOM inspection — not by an actual assistive-technology session.
  This is the same category of gap `docs/CROSS_BROWSER_REVIEW.md`
  documents for Firefox/Safari: a real constraint of this environment
  (no AT software available here), not a silently skipped check.
- **Automated tools (axe-core) cannot catch everything** — this file's
  own §2 names this directly; keyboard operability and focus visibility
  specifically needed the separate scripted checks this batch (and
  Milestone 5/6 before it) already added precisely because axe alone
  cannot verify them.
- **AAA-level criteria are not systematically checked** — REQ-008-F asks
  for AAA "where practical," not as a hard requirement, and no
  AAA-specific automated rule (e.g. 7:1 contrast, sign-language
  alternatives) runs anywhere in this suite.
- **Dialog focus trapping and Menu operation are recorded as N/A**, not
  "passed" — if a future milestone introduces a real dialog or menu
  widget, this document's own finding (§4) no longer applies and that
  widget needs its own dedicated audit before this conformance claim can
  be considered current for it.

## 10. Resolved defects this batch (summary)

1. Page titles — every route now announces a distinct, correct
   `document.title` (M9-024).
2. WCAG AA "link-in-text-block" violation on Sign In/Sign Up (M9-022).
3. Missing `aria-invalid`/`aria-describedby` on every form with
   field-level validation errors, codebase-wide (M9-026).
4. Missing required-field identification on the portfolio create/edit
   forms (M9-026).
5. No `prefers-reduced-motion` support anywhere (M9-027).
6. recharts animations never disabled (M9-027).
7. 6 routes (7 counting `/portfolios/new` and `/portfolio` separately)
   with zero automated accessibility/keyboard coverage (M9-022/M9-023).

## 11. Deferred improvements

- A live assistive-technology session (§9) — recommended before a public
  release, not achievable from inside this environment.
- Error summaries for forms, if a future milestone adds a form
  significantly longer than the current ones (§7) — not needed for any
  form as it exists today.

# ProfitPilot — Project Status

Last updated: 2026-07-23
Current milestone: **Milestone 2 — Formula Engine** (per `docs/06_TASKS.md`), Batch 2 of 9 complete

This file is maintained by the implementation process (not part of the
`docs/` specification set) and tracks real build status, deviations, and
open documentation conflicts. It is not a specification document.

---

## Completed tasks

| Task                                  | Status  | Notes                                                                                                                                                                                                                                                    |
| ------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1-001 Create Next.js Project         | ✅ Done | Next.js 15.5.21, App Router, TypeScript, Turbopack dev/build                                                                                                                                                                                             |
| M1-002 Install Core Dependencies      | ✅ Done | All packages from the documented list installed (see "Dependency versions" below)                                                                                                                                                                        |
| M1-003 Create Repository Structure    | ✅ Done | `app/ components/ features/ engine/ services/ stores/ hooks/ types/ utils/ constants/ providers/ styles/ tests/ supabase/ docs/` created per Build Guide's M1-003 directory list; empty dirs hold `.gitkeep`                                             |
| M1-004 Configure Code Quality         | ✅ Done | ESLint (flat config) + Prettier + `eslint-config-prettier` + `eslint-plugin-simple-import-sort`; TypeScript strict mode (already on from scaffold); path alias `@/*`. **Not done:** committed editor "format-on-save" config — declined; see Deviations. |
| M1-005 Configure Testing              | ✅ Done | Vitest (jsdom, v8 coverage, `tests/unit/`) + Playwright (`tests/e2e/`, Chromium via sandbox-installed browser). 6 unit tests / 2 e2e tests passing.                                                                                                      |
| M1-006 Create Application Layout      | ✅ Done | `AppShell`/`AppHeader`/`AppSidebar` (03_UI.md page 2 layout), dark theme default, Inter font, 6 placeholder routes (`/`, `/portfolio`, `/simulation`, `/loop-builder`, `/exit-planner`, `/settings`). No business logic.                                 |
| M1-007 Configure Environment          | ✅ Done | `.env.example` + `utils/env.ts` (Zod-validated, all fields optional/defaulted so Manual Mode runs with zero external config, per REQ-010).                                                                                                               |
| M1-008 Configure CI Pipeline          | ✅ Done | `.github/workflows/ci.yml`: install → lint → typecheck → format check → unit tests (coverage) → build. Not yet run on GitHub (no push performed).                                                                                                        |
| M1-010 Create Developer Documentation | ✅ Done | `CONTRIBUTING.md`: setup, dev/test commands, structure, contribution workflow.                                                                                                                                                                           |

**Deferred:**

| Task                              | Status     | Notes                                                                                                                                                                                                                     |
| --------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1-009 Deploy Initial Application | ⏸ Deferred | Explicitly excluded from this pass per instruction. Project builds cleanly and is deployable to Vercel with zero extra config, but **no Vercel project has been created and none should be until explicitly instructed.** |

---

## Validation results — Milestone 1 (historical, at time of completion)

| Command                                           | Result                                                                                            |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`                                  | ✅ Pass, no errors                                                                                |
| `pnpm lint`                                       | ✅ Pass, no errors (after autofix of import ordering)                                             |
| `pnpm format:check`                               | ✅ Pass (spec docs excluded from Prettier scope — see below)                                      |
| `pnpm test` (Vitest, 6 tests)                     | ✅ Pass                                                                                           |
| `pnpm test:coverage`                              | ✅ Pass, 100% on covered files (`utils/cn.ts`, `utils/env.ts` — the only files with logic so far) |
| `pnpm exec playwright test --list` (config check) | ✅ Valid, discovers 2 tests                                                                       |
| `pnpm exec playwright test` (actual run, bonus)   | ✅ Pass, 2/2                                                                                      |
| `pnpm build` (production, Turbopack)              | ✅ Pass, 6 routes statically prerendered                                                          |
| `pnpm validate` (full pipeline, mirrors CI)       | ✅ Pass end-to-end                                                                                |

No test, lint, or build failures were left unresolved.

---

## Milestone 2 progress

Implementation order follows the sequence proposed in the Milestone 2 review
(Foundation → Portfolio → Risk → Interest → Loop → Simulation → Exit →
Recommendations → Verification), one batch at a time, tests run after each
batch, commit only when a batch passes.

### Batch 1 — Engine Foundation (M2-001 through M2-005)

| Task                                         | Status  | Notes                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M2-001 Create Formula Engine Foundation      | ✅ Done | `engine/{portfolio,health,liquidation,interest,loop,simulation,exit,recommendation,validation,shared}/` + `engine/index.ts` public entry point. No framework dependencies.                                                                                                                                                                                                                                             |
| M2-002 Implement Shared Financial Types      | ✅ Done | `engine/shared/types.ts` — `MarketPrices`, `CollateralPosition`, `DebtPosition`, `ProtocolParameters`, `PortfolioInput`. Single-asset (BTC collateral / one stablecoin debt), per `01_PRD.md` REQ-003 v0.1 scope — see conflict #5 below. Simulation/Exit-plan/Recommendation input types deferred to the batches that implement those modules, so their shapes come from real formulas rather than being guessed now. |
| M2-003 Configure Decimal Arithmetic          | ✅ Done | `engine/shared/decimal.ts` — Decimal.js configured globally (34-digit precision, `ROUND_HALF_UP`), `toDecimal`/`roundForDisplay`/`toOutputNumber` conversion helpers, `DISPLAY_PRECISION` table. See conflict #6 (Health Factor decimal places).                                                                                                                                                                       |
| M2-004 Create Standard Formula Result Model  | ✅ Done | `engine/shared/result.ts` — `FormulaResult<T>` discriminated union (`FormulaSuccess`/`FormulaFailure`), `FormulaWarning`, `FormulaError`, `FormulaMetadata`, `createSuccess`/`createFailure` constructors.                                                                                                                                                                                                             |
| M2-005 Implement Engine Validation Utilities | ✅ Done | `engine/validation/validate.ts` — `validateFinite/NonNegative/Positive/Percentage/Price/TokenQuantity/Rate/Threshold/TimePeriod`, plus composite `validateProtocolParameters` (also enforces the documented invariant maxLTV ≤ liquidationThreshold).                                                                                                                                                                  |

**Framework-independence audit (post-implementation, pre-commit)**: confirmed
zero imports of React/Next.js/Zustand/Supabase/UI anywhere in `engine/`. The
audit did surface two things that reached outside "Decimal.js + its own
shared modules + TypeScript stdlib" without being on that explicit forbidden
list, both fixed:

- `engine/shared/result.ts` imported the host app's `../../package.json` for
  `engineVersion`. Replaced with a hardcoded `ENGINE_VERSION` constant; a new
  test (`tests/unit/engine/shared/result.test.ts`) guards against it drifting
  from `package.json`'s real version.
- `engine/validation/validate.ts` imported its sibling `engine/shared/*`
  modules via the `@/...` path alias, which only resolves via this app's
  `tsconfig.json`. Changed to relative imports (`../shared/...`) so the
  Engine's internal module graph doesn't depend on the host app's build
  configuration — relevant if the Engine is ever extracted as an independent
  package (04_BUILD_GUIDE.md).

**Validation — Batch 1**

| Command              | Result                                                          |
| -------------------- | --------------------------------------------------------------- |
| `pnpm typecheck`     | ✅ Pass                                                         |
| `pnpm lint`          | ✅ Pass                                                         |
| `pnpm format:check`  | ✅ Pass                                                         |
| `pnpm test`          | ✅ Pass, 51/51 (45 new)                                         |
| `pnpm test:coverage` | ✅ 100% statements/branches/functions/lines on all Batch 1 code |
| `pnpm build`         | ✅ Pass                                                         |

No test, lint, or build failures were left unresolved.

**Sync status**: committed as `4315a41`, exported as patch/bundle, applied
locally, and confirmed present on `origin/main` (re-derived hashes `2cf8c1a`
Milestone 1 / `226876a` Batch 1 — expected from patch reapply, content
identical). Verified by fetching `origin/main` directly and walking its
ancestry from this session.

### Batch 2 — Portfolio Mathematics (M2-006 through M2-008)

| Task                                          | Status  | Notes                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M2-006 Implement Portfolio Value Calculations | ✅ Done | `engine/portfolio/{calculateCollateralValue,calculateDebtValue,calculatePortfolioValue,calculateNetWorth}.ts` — F-001, F-002, F-003, F-004. "Asset/debt allocation percentages" sub-bullets skipped: no Formula ID, and trivially 100% under the approved single-asset/single-debt scope.                                                                                        |
| M2-007 Implement Loan-to-Value Calculations   | ✅ Done | `engine/portfolio/calculateLoanToValue.ts` (F-020); `engine/loop/calculateBorrowCapacity.ts` adds `calculateMaximumBorrowLimit` (F-021) and `calculateAvailableBorrow` (F-013). "Weighted maximum LTV" sub-bullet skipped: multi-collateral only, N/A under approved scope.                                                                                                      |
| M2-008 Implement Leverage Calculations        | ✅ Done | `engine/portfolio/{calculateExposure,calculateEffectiveLeverage}.ts` — F-010, F-011 ("Equity" reuses F-004). "Debt-to-equity ratio" and "Collateral multiplier" sub-bullets skipped: no Formula ID in `02_Formulas.md`, would mean inventing a formula. "Effective BTC exposure" is documented as equal to F-010 under single-asset scope rather than given a separate function. |

**Formula ID duplication found and handled**: `02_Formulas.md` documents the
identical equation (Collateral Value × Max LTV) twice — F-012 "Borrow
Capacity" (Leverage & Loop chapter) and F-021 "Maximum Borrow Limit" (Aave
Risk chapter). Implemented once (`computeBorrowCapacity`, private) with two
public, correctly-tagged wrappers (`calculateBorrowCapacity` for F-012,
`calculateMaximumBorrowLimit` for F-021), so both Formula IDs have a
canonical, traceable implementation without duplicating the math.

**Framework-independence**: re-audited after Batch 2 — still zero
React/Next.js/Zustand/Supabase/UI imports, and no `@/...` alias usage inside
`engine/` (all internal imports are relative).

**Validation — Batch 2**

| Command              | Result                                                          |
| -------------------- | --------------------------------------------------------------- |
| `pnpm typecheck`     | ✅ Pass                                                         |
| `pnpm lint`          | ✅ Pass                                                         |
| `pnpm format:check`  | ✅ Pass                                                         |
| `pnpm test`          | ✅ Pass, 89/89 (38 new)                                         |
| `pnpm test:coverage` | ✅ 100% statements/branches/functions/lines on all Batch 2 code |
| `pnpm build`         | ✅ Pass                                                         |

Every test asserts against a worked example from `02_Formulas.md` (or, where
noted, the "UNIT TEST EXAMPLES" scenarios in the Leverage & Loop chapter)
wherever one exists, plus edge/invalid-input cases per the M2 Testing
Requirements. No test, lint, or build failures were left unresolved.

**Traceability audit (Batch 2, pre-commit)**: every public function carries
its Formula ID in both a doc comment and its runtime `FormulaResult`
metadata; all 10 implemented Formula IDs (F-001, F-002, F-003, F-004, F-010,
F-011, F-012, F-013, F-020, F-021) have an explicit
`metadata.formulaId`-asserting test; no Formula ID called for by M2-006
through M2-008 was omitted.

**Finding: F-005–F-008 (Equity Ratio, Debt Ratio, Portfolio Gain, Portfolio
Return — the rest of `02_Formulas.md`'s Portfolio Metrics chapter) have no
task assigned anywhere in `06_TASKS.md`** — confirmed by a full-document
search, zero matches. Not a Batch 2 omission (never assigned to M2-006 or
any other task). **Decision: intentionally not implemented at this time.**
Treated as an unassigned documentation gap, to be picked up at the Formula
Traceability Audit milestone (M2-032) or whenever `06_TASKS.md` is updated
to assign them — not implemented speculatively now.

---

## Unresolved documentation conflicts

These are **not** resolved in code. They are flagged for a product/engineering
decision before the milestone that depends on them.

### 1. Health Factor risk-band thresholds disagree across four documents — BLOCKS Milestone 2 (Risk classification, Formula F-026/F-060) and Milestone 5 (Dashboard)

| Source                                         | Bands                                                                                                              |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| README.md / `01_PRD.md` REQ-001 Dashboard card | HF>2.0 Green Safe · 1.50–2.00 Yellow Monitor · 1.20–1.50 Orange Elevated · <1.20 Red Critical · ≤1.00 Liquidation  |
| `01_PRD.md` REQ-005 Risk Engine categories     | SAFE >2.50 · MONITOR 2.00–2.50 · ELEVATED 1.50–2.00 · HIGH RISK 1.20–1.50 · LIQUIDATION RISK ≤1.20                 |
| `02_Formulas.md` F-026 Risk Category           | HF≥2.00 Very Safe · 1.70–1.99 Safe · 1.50–1.69 Moderate · 1.30–1.49 High Risk · 1.10–1.29 Critical · <1.10 Extreme |
| `02_Formulas.md` F-060 Recommendation rules    | HF≥2.00 Excellent · 1.80–2.00 Healthy · 1.60–1.80 Good · 1.40–1.60 Caution · 1.20–1.40 High Risk · <1.20 Critical  |

No canonical set is designated. This does not block Milestone 1 (no risk logic
exists yet) but **must be resolved before implementing F-026/F-060 or any
Dashboard risk-category UI.** Action needed: pick one banding scheme (or
explicitly define which doc governs which context) before Milestone 2's risk
classification work begins.

### 2. Two `04_BUILD_GUIDE.md` pages are referenced but missing content

The file's own "NEXT" footers announce **Page 4 — "Database Design, Data
Models & State Management"** and **Page 7 — "Frontend Implementation,
Components, Forms & Responsive Behavior,"** but neither page body exists in
the file (content jumps from page-labeled-3 to page-labeled-5, and
page-labeled-6 to page-labeled-8). No content was invented to fill this gap,
per instruction. State-management/data-model design for Milestone 3/4 and
detailed frontend/component/form conventions for Milestone 4+ will need this
content supplied, or will have to be inferred from `01_PRD.md` REQ-009
(State Management) and `03_UI.md` when those milestones start — flagging now
so it isn't a surprise later.

### 3. `01_PRD.md` REQ-001 through REQ-017 sequencing vs. version scope (v0.1–v1.0)

The PRD's per-page "Blocking Dependencies" chain reads as strictly
sequential (each REQ blocked on _all_ prior REQs), but REQ-015's actual v0.1
feature scope is narrow while REQ-012 (Security), REQ-013 (DevOps/CI-CD),
REQ-014 (AI framework), REQ-016 (Governance) read as full-project, ongoing
concerns. No document maps REQ numbers to version milestones. Not a
Milestone-1 blocker; noted for whoever plans Milestone 8+ (Security/DevOps
hardening) scope.

### 4. Minor / non-blocking

- `06_TASKS.md` M1-006 places an application-shell/placeholder-pages task in
  Milestone 1, before the Formula Engine (Milestone 2) exists. Implemented as
  specified (explicitly "no business logic"), consistent with the task text,
  but technically precedes the Engine — noted per the repository review.
- `06_TASKS.md`'s own summary claims "250+ tasks"; actual count across
  M1–M10 is ~325. Cosmetic.
- `04_BUILD_GUIDE.md` pins "Next.js 15, React 19"; `06_TASKS.md` M1-001 says
  "latest stable version of Next.js." Resolved by using **Next.js 15.5.21 /
  React 19.1.0** (latest 15.x/19.x — both fully available, no compatibility
  deviation was required). Flagging the wording mismatch between the two docs
  rather than silently picking a side.

### 5. Single-asset vs. multi-asset collateral/debt scope — RESOLVED for Milestone 2 in favor of single-asset

Several `06_TASKS.md` Milestone 2 task descriptions imply multi-asset support
(M2-006 "by asset" / allocation percentages, M2-007 "weighted maximum LTV",
M2-009 "weighted liquidation threshold", M2-028 "multiple collateral assets" /
"multiple debt assets"), but `01_PRD.md` REQ-003 is explicit: _"Version 0.1
assumes Bitcoin only"_ (collateral) and _"Version 0.1 assumes one
stablecoin"_ (debt), and every one of `02_Formulas.md`'s F-001–F-069 is
written single-asset. Batch 1's shared types (`engine/shared/types.ts`) were
built single-asset, following the PRD's explicit v0.1 scope and the
documented Formula IDs, since building multi-asset aggregation now would mean
inventing formulas that don't exist in `02_Formulas.md` — which conflicts
with "do not invent functionality." **This decision was made without
explicit confirmation and should be reviewed** — if multi-asset support is
actually wanted for Milestone 2, `engine/shared/types.ts` will need
revisiting before Batch 2 (Portfolio Mathematics) builds on it.

### 6. Health Factor display precision: 2 decimals vs. 3 decimals

`02_Formulas.md` "PRECISION STANDARD" (page 1) states Health Factor uses 3
decimals; `01_PRD.md` REQ-002 "PRECISION REQUIREMENTS" states 2 decimals.
`engine/shared/decimal.ts`'s `DISPLAY_PRECISION.healthFactor` uses **3**,
following `02_Formulas.md` as the document of record for calculations. This
is a single constant and trivially reversible if the intended value is 2.

---

## Deviations from a literal reading of the docs (all mechanical, none touch business logic or specification content)

- **shadcn/ui**: the `shadcn` CLI's `init` command calls `ui.shadcn.com`,
  which this sandbox's network policy blocks (`403` at the proxy). Ran the
  equivalent manual setup instead — `components.json` (classic schema),
  `utils/cn.ts` (the `cn()` helper), `class-variance-authority` / `clsx` /
  `tailwind-merge` / `tw-animate-css` installed, CSS variables added to
  `app/globals.css`. No shadcn components have been generated yet (none were
  needed for Milestone 1); the next component added via the CLI should work
  normally assuming the same network restriction doesn't apply then, or can
  be added by hand following the same convention.
- **Editor format-on-save**: `06_TASKS.md` M1-004 lists "Format-on-save" as
  a deliverable. This is normally committed as `.vscode/settings.json`;
  that step was declined during implementation, so format-on-save is
  documented in `CONTRIBUTING.md` (`pnpm format`) but not enforced via a
  committed editor config.
- **`vite-tsconfig-paths`**: initially added for path-alias resolution in
  Vitest, then removed in favor of Vitest 4's native `resolve.tsconfigPaths`
  option once it became clear the plugin was redundant. One fewer
  dependency than a literal reading of "install Vitest" might imply; not a
  documented package, so no conflict.
- **pnpm ignored build scripts**: `sharp`, `unrs-resolver`, and
  `@sentry/cli` have native postinstall scripts that pnpm blocks by default
  (security default, not an error). Left unapproved — lint/build/test all
  pass without them, and running `@sentry/cli`'s installer isn't needed
  without a configured Sentry project.

## Explicitly not done (per instruction)

- **No Vercel project created or modified** (M1-009 deferred).
- **No Supabase project/account created.** `@supabase/supabase-js` is
  installed (M1-002) but not initialized anywhere; `supabase/` directory is
  an empty placeholder for Milestone 8.
- **No Sentry project/account created.** `@sentry/nextjs` is installed
  (M1-002) but not initialized/configured; no DSN, no `sentry.*.config.ts`,
  no `next.config.ts` wrapping.
- **No specification document (`docs/*.md`, `README.md`) was modified.**
  Both are explicitly excluded from Prettier's scope (`.prettierignore`) so
  tooling can never reformat them as a side effect.
- **No commit or push performed.** The working tree contains only unstaged
  changes.

---

## Next task

1. **M1-009 (Deploy Initial Application)** remains deferred — no Vercel
   project created, per instruction.
2. **This pass stops here for approval** of Batch 2 before committing, per
   instruction.
3. Once approved and committed: **Batch 3 — Risk Mathematics
   (M2-009 through M2-011)** — Health Factor (F-022), Liquidation Price/
   Distance/Buffer (F-023–F-025), Target Health Factor (F-027). **This is
   where the Health Factor risk-band conflict (item 1 above) actually needs
   resolving** — specifically M2-009's "Health Factor status classification"
   sub-item (F-026), which cannot be implemented correctly without a chosen
   banding scheme. The rest of M2-009/010/011 (the numeric HF/liquidation
   formulas themselves) can proceed regardless.
4. The compound-interest scope gap (see the Milestone 2 review) doesn't
   block Batch 3 — it matters starting at Batch 4 (Interest Mathematics,
   M2-013).

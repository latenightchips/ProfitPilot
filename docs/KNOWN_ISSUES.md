# Known Issues

`06_TASKS.md` M10-015 ("Document Known Issues") — Milestone 10 Batch 2.
Dependencies: M10-014. Description: "Maintain a Version 1 known issues
list." DoD: "Known limitations remain transparent."

This document reorganizes evidence already established elsewhere
(`docs/DEFECT_CLASSIFICATION.md` §6, `docs/CHANGELOG.md`'s "Known
limitations," `PROJECT_STATUS.md`) into five distinct categories, so a
reader can immediately tell an intentional design decision from an
actual defect from a documentation inconsistency — conflating any of
these would misrepresent Version 1.0.0. **Nothing below is invented**;
every item cites where its underlying evidence already lives. See
`docs/SUPPORT_PLAYBOOK.md` if you're troubleshooting a specific problem
rather than browsing this list.

**Release-blocker status (Milestone 9 Quality Sign-Off, M9-064,
`docs/DEFECT_CLASSIFICATION.md` §6): zero open P0 defects, zero open P1
defects.** Nothing in this document is a release blocker — every item
below is either an intentional scope decision, a documented operational
deferral, a non-blocking process gap with a workaround, or a
documentation-only inconsistency.

## A. Product limitations (intentional Version 1.0.0 scope — not defects)

- **No wallet connection, real position import, or transaction
  execution — a decision-support tool, not a live account.**
  ProfitPilot never reads a real Aave position and never executes a
  real transaction. This is the permanent, intentional Version 1.0.0
  scope boundary — not "Manual Mode" in the sense of having no live
  data at all (see below), a distinction `docs/CHANGELOG.md` did not
  draw clearly and this entry corrects. Reading your real Aave
  position/wallet balance directly is Version 2 scope
  (`docs/VERSION_2_BACKLOG.md`'s "Live portfolio imports").
- **BTC price and Aave V3 protocol parameters (max LTV, liquidation
  threshold, borrow/supply APR) are live by default, read-only, and
  refresh on page load — not manually entered.** `hooks/useAaveLiveSync.ts`
  fetches these from Aave V3's own on-chain oracle/pool contracts with
  no configuration required. Aave V4 support is separate and opt-in:
  entering an on-chain address enables a live read of that position's
  debt state and collateral risk factor (V3 and V4 support are not
  identical — V4 has no manual-price toggle of its own once opted in).
  All of this is read-only in every case — nothing here ever
  constructs, signs, or submits a transaction. What remains genuinely
  manual: collateral quantity and debt balance (position size), which
  only you can enter — see `docs/USER_GUIDE.md` for the full
  live-vs-manual breakdown.
- **No wallet connection, no transaction execution.** ProfitPilot never
  reads a real Aave position and never executes a real transaction —
  this is a decision-support tool by design, not a gap.
- **Single-copy, device-local data model.** No cross-device sync exists
  or is coming for Version 1.0.0 — see category E below (Cloud Sync is
  cancelled, not deferred). A lost device or cleared browser profile has
  no recovery beyond a previously exported backup
  (`docs/DISASTER_RECOVERY.md`'s "Device unavailable"/"Deleted local
  browser data").
- **Ordinary Delete has no automatic snapshot.** Only a
  `Replace selected`/`Replace all local data` import triggers an
  automatic Recovery Snapshot. A deleted portfolio, loop strategy, exit
  plan, or simulation is gone unless a coincidentally-timed snapshot or
  backup already covers it (`docs/DISASTER_RECOVERY.md`'s "User
  deletion") — Archive is the reversible alternative for portfolios
  specifically; a deliberate design choice, not an oversight.
- **Health Factor risk-band classification (F-026/F-060) is not
  implemented.** No canonical risk-banding scheme is defined across the
  4 disagreeing source documents (Conflict #1, `PROJECT_STATUS.md`); the
  UI honestly shows "Not available" rather than fabricating a scheme
  (`docs/DEFECT_CLASSIFICATION.md` §6). Not a defect — no incorrect
  output exists, and this is correctly the alternative to guessing.
- **33 of 69 Formula IDs are out of scope** (multi-asset collateral/
  debt, compound interest, swap fees/slippage/gas, several
  Recommendation Engine formulas) — each with a recorded reason
  (Conflicts #5, #7, #8, #9, #10, #11, #12, #15, `PROJECT_STATUS.md`)
  and explicitly Version 2 scope. `tests/fixtures/formulaCoverage.ts` is
  the canonical, source-verified registry.

## B. Operational/deployment limitations (deferred by explicit product/release decision)

- **No publicly operated production deployment exists for Version
  1.0.0.** A deliberate release decision (Milestone 10 Batch 1;
  `docs/RELEASE_NOTES.md`), not an oversight — ProfitPilot is
  self-hostable with no single owned production domain by design. See
  `docs/PRODUCTION_READINESS.md` for exactly what is and isn't
  repository-ready.
- **No live, hosted monitoring exists.** Error-monitoring infrastructure
  is fully built and tested (`docs/OBSERVABILITY.md`,
  `services/observability/`) but reports nothing unless a deployer
  configures `NEXT_PUBLIC_SENTRY_DSN` against their own real Sentry
  project — none exists for Version 1.0.0 itself. Deferred, same
  disposition as hosted deployment above, not "N/A."
- **Optional Authentication is dormant by default.** Signing in never
  changes how portfolio data is stored; it requires a deployer to
  configure their own real Supabase project, which this project's own
  default configuration does not do (`CONTRIBUTING.md`'s "Optional
  authentication").
- **No persistence migration has ever shipped.** `REGISTERED_MIGRATIONS`
  is empty; the chain-walking mechanism is fully tested against a
  synthetic registry and wired into the real app-boot path, but has
  never run against real prior-version data, because no prior version
  has existed yet (`docs/VERSIONING_STRATEGY.md`).

## C. Development/CI limitations (non-blocking, documented workaround exists)

- **CI does not run the full end-to-end (Playwright) test suite on
  every PR — classified P2, substantially resolved post-M10 (R1-3,
  R2-4).** `.github/workflows/ci.yml` now runs a small, blocking
  production smoke suite (`tests/e2e/productionSmoke.spec.ts`) against a
  real `pnpm build && pnpm start` server on every PR/push, proving the
  built production application actually starts and serves its critical
  routes (R1-3, "Runtime Pinning + Production CI Smoke Gate"). The
  broader 150-test suite (including all 43 accessibility tests) is
  wired into a separate, manual `workflow_dispatch` workflow
  (`.github/workflows/e2e-full.yml`, R2-4, "Dependency Security
  Follow-up + Release E2E Policy") — a deliberate release gate, not
  blocking on every push, since its own ~2.5-minute runtime doesn't
  justify making it a required check the way the fast smoke gate is.
  `productionSmoke.spec.ts` is deliberately excluded from that full-suite
  workflow's own test selection: it already runs independently in
  `ci.yml`, and running it again inside the large suite collides with
  the R1-2 Aave API rate limiter's documented process-local, in-memory
  fallback client identity (no reverse-proxy `x-forwarded-for` header in
  this environment means the whole suite's `/api/aave/*` traffic shares
  one bucket) — not a flaky test, a deterministic, understood
  interaction, excluded rather than hidden. **Do not describe this as
  "CI has no E2E coverage"** — it has blocking smoke coverage on every
  push and full-suite coverage on demand before release. See
  `docs/DEFECT_CLASSIFICATION.md` §6 and `docs/PRODUCTION_READINESS.md`
  §7 for the full record.
- **1 `pnpm audit --prod` finding (1 high, 0 moderate, 0 critical) —
  current as of R2-4 ("Dependency Security Follow-up + Release E2E
  Policy"), down from the original 18-instance full-tree count.** The
  original 18-instance figure (11 high, 7 moderate — still accurate as
  the *full* dependency tree, including dev/lint/test-only tooling, per
  the one-time M9-029 audit) is not the ongoing release-gate metric;
  `pnpm audit --prod` (production dependency tree only) is. That
  narrower command found 9 findings, of which `package.json`'s
  `pnpm.overrides` (`postcss`/`nanoid`/`brace-expansion`/`fast-uri`)
  closed 8 — verified by a real `pnpm install` + `pnpm audit --prod` +
  full `pnpm validate` re-run, not assumed safe. The 1 remaining finding
  (`sharp`, transitive via `next`'s optional image-optimization
  dependency) is confirmed unused — a repository-wide search finds zero
  `next/image` usage anywhere in this application — and deliberately not
  overridden (`sharp` ships native, platform-specific binaries; the
  installation/ABI-compatibility risk of forcing its version outweighs a
  security benefit this application cannot be exposed to). Tracked as
  **TRACK / WAIT FOR UPSTREAM**, revisited if `next` bumps its own
  `sharp` dependency or if this application ever adopts `next/image`.
  See `docs/SECURITY_REVIEW.md`'s M9-029 "R2-4 update" section for the
  full per-package table and the standing ongoing policy, and
  `docs/MAINTENANCE_SCHEDULE.md`'s "Security updates" section for how a
  future finding gets triaged.
- **Automated cross-browser test coverage is Chromium-only.** Firefox
  and Safari are covered by code-level review
  (`docs/CROSS_BROWSER_REVIEW.md`), not automated tests — no Firefox/
  WebKit binary is available in this project's development
  environment. This remains true as of Milestone 10 Batch 2; not
  claimed otherwise.
- **No live assistive-technology (screen reader) session recorded.**
  Structural ARIA/role/name verification via axe-core and direct DOM
  inspection substitutes (`docs/ACCESSIBILITY_CONFORMANCE.md` §9) — no
  AT software available in this development environment.
- **No license-audit tooling configured.** A manual, one-time scan
  found no GPL/AGPL-family license among direct dependencies
  (`docs/SECURITY_REVIEW.md` M9-029) — not automated or repeatable.
- **Per-layer (Engine/Services/UI/Stores) coverage breakdown uses a
  line-coverage proxy**, not an exact statement-count breakdown — the
  blended, exact statement figure (96.33%) already clears every
  `04_BUILD_GUIDE.md` tier; only the *per-layer* breakdown is a proxy
  (`docs/DOD_COMPLIANCE_AUDIT.md` §1). Documentation precision only.

## D. Documentation/specification conflicts (not code defects)

- **Conflict #38 — specification documents' own declared `Version`
  field is internally and cross-document inconsistent.** `README.md`
  and `01_PRD.md`'s own header both declare `0.1.0`; `01_PRD.md`'s own
  footer and the other five spec documents (`02_Formulas.md` through
  `06_TASKS.md`) all declare `1.0` — found while verifying the
  "Documentation version" axis (Milestone 10 Batch 1, M10-003;
  `PROJECT_STATUS.md`). **This is a documentation-version inconsistency
  only** — it does not affect application behavior, financial
  correctness, or any runtime version constant (`package.json`/
  `APP_VERSION`/`ENGINE_VERSION` are internally consistent at `1.0.0`).
  Not resolved — `README.md`/`docs/0X_*.md` are frozen, protected
  specification documents this project's convention does not edit as
  part of ordinary work.
- **`01_PRD.md`/`04_BUILD_GUIDE.md` disagree on financial-accuracy
  tolerance, coverage-target framing, and one Simulation performance
  figure** (Conflicts #35, #36, #37, `PROJECT_STATUS.md`) —
  `docs/QUALITY_PLAN.md` §7 already records the working precedent
  followed (the Build Guide's more implementation-precise figures); no
  incorrect behavior results from either reading.
- **34 other recorded specification conflicts** (`PROJECT_STATUS.md`'s
  "Unresolved documentation conflicts" section, Conflicts #1–#37 minus
  the three named above) — pre-existing documentation ambiguities found
  across Milestones 2–9, each already resolved by a stated precedent or
  left explicitly open for a future product decision; none reflects
  incorrect shipped behavior.

## E. Cancelled/out-of-scope capabilities (permanent, not deferred)

- **Cloud Database — cancelled by product decision** (Milestone 8;
  `docs/MILESTONE_8_SCOPE_CHANGE.md`; `PROJECT_STATUS.md` Conflict #34).
  Not built, not planned, not deferred to a later Version 1.0.x patch —
  a permanent scope decision. Distinct from category B above: nothing
  here is "not yet operated," it is "will not be built under the
  current architecture."
- **Cloud Synchronization — cancelled by product decision**, same
  source. No sync conflict, no cross-device data, no cloud backup exists
  or is coming under this decision.
- **Row-Level Security — not applicable**, same source — there is no
  cloud-backed table for a policy to protect.

## Facts preserved for release-note accuracy (do not restate differently elsewhere)

- P0 defects: **0**. P1 defects: **0** (`docs/DEFECT_CLASSIFICATION.md`
  §6, Milestone 9 M9-064 Quality Sign-Off).
- CI Playwright automation gap: **P2, substantially resolved — blocking
  smoke gate on every PR/push, manual full-suite release gate on demand**
  (category C above).
- Publicly operated production deployment: **deferred** (category B).
- Live, hosted monitoring: **deferred** (category B).
- Cloud Database/Cloud Sync: **cancelled**, not deferred (category E).
- Conflict #38 (documentation-version inconsistency): **documentation
  only, not a runtime/product defect** (category D).
- Firefox/Safari automated verification: **not claimed** — code-level
  review only (category C).
- Dependency audit: **full dependency tree, 18 instances (11 high / 7
  moderate, 0 critical), all build/lint/test-tooling dependency paths,
  none reachable from runtime application code — one-time M9-029
  figure, unchanged. Production dependency tree (the ongoing release-gate
  metric, `pnpm audit --prod`): 1 finding (`sharp`, confirmed unused,
  TRACK / WAIT FOR UPSTREAM), down from 9 after R2-4's `pnpm.overrides`**
  (category C).
- Application-level Aave API rate limiting (R1-2): **repository-level
  control (process-local, in-memory), not a substitute for
  infrastructure-level/distributed throttling** — see
  `docs/PRODUCTION_READINESS.md` §7 (category B/C boundary — the
  mechanism is implemented and verified, but coordinated
  fleet-wide throttling remains an operated-deployment concern).

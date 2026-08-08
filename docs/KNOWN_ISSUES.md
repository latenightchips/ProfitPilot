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

- **Manual Mode only.** No live BTC price feed, no live Aave connection
  — every number is only as current as the last time a user updated it
  by hand. Permanent, intentional Version 1.0.0 scope
  (`docs/CHANGELOG.md`); a live price feed is Version 2 scope
  (`01_PRD.md`'s own repeated "belongs to Version 2" framing).
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

- **CI does not run the end-to-end (Playwright) test suite
  automatically — classified P2.** The 151-test suite (including all 43
  accessibility tests) exists, is current, and passes; it is run
  manually before every release (exactly what every Milestone 9/10 batch
  in this project has actually done) rather than wired into
  `.github/workflows/ci.yml`. Non-blocking, documented workaround exists
  — `docs/DEFECT_CLASSIFICATION.md` §6.
- **18 `pnpm audit` advisory instances (11 high, 7 moderate, 0
  critical).** Every advisory is a build-time/lint-time/test-time
  tooling dependency path (`sharp`, `postcss`, `brace-expansion`,
  `undici`, `fast-uri`, `js-yaml`, `nanoid` — transitive dependencies of
  `next`, `eslint-config-next`, `@sentry/nextjs`, `@tailwindcss/postcss`,
  or `vitest`'s own `jsdom`), **none reachable from client-shipped
  runtime code**, verified by dependency path
  (`docs/SECURITY_REVIEW.md` M9-029, `docs/DEFECT_CLASSIFICATION.md`
  §6). Not a runtime application vulnerability.
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
- CI Playwright automation gap: **P2, non-blocking, documented
  workaround** (category C above).
- Publicly operated production deployment: **deferred** (category B).
- Live, hosted monitoring: **deferred** (category B).
- Cloud Database/Cloud Sync: **cancelled**, not deferred (category E).
- Conflict #38 (documentation-version inconsistency): **documentation
  only, not a runtime/product defect** (category D).
- Firefox/Safari automated verification: **not claimed** — code-level
  review only (category C).
- Dependency audit: **18 instances, 11 high / 7 moderate, 0 critical —
  all build/lint/test-tooling dependency paths, none reachable from
  runtime application code** (category C).

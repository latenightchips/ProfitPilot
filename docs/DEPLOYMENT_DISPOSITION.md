# Deployment & Monitoring Disposition (M10-005–M10-011)

`06_TASKS.md` Page 10 "Production Deployment" (M10-005–M10-008) and
"Production Monitoring" (M10-009–M10-011) — Milestone 10 Batch 6.

**Why this document exists**: these seven tasks form one cohesive
cluster, all of them chained (directly or transitively) on M10-006
("Deploy Version 1"), and none of the existing documents maps cleanly
onto all seven — `docs/PRODUCTION_READINESS.md` already covers M10-005
alone (Milestone 10 Batch 1); `docs/OPERATIONAL_RUNBOOK.md` covers
rollback and diagnostics generally, not mapped to M10-008's specific
Include list; `docs/OBSERVABILITY.md` covers the Sentry/diagnostic
wiring, not mapped to M10-009/010/011's specific Monitor/Verify/Review
lists. This document provides that mapping, requirement by requirement,
citing existing evidence rather than duplicating it. It does not
replace any of those documents.

## Governing decision (unchanged, restated precisely)

ProfitPilot Version 1.0.0 is a completed, quality-signed-off,
self-hostable software release. An operated, publicly hosted production
deployment is **not** part of Version 1's completion requirement — no
Vercel project, production domain, Supabase project, or Sentry project
has been or will be created as part of this batch; no production
traffic, uptime, incident, monitoring dashboard, alert, log
aggregation, or rollback history is invented anywhere below.

Every requirement below that depends on operated infrastructure is
classified, verbatim: **"Deferred by explicit product/release decision
— no operated production deployment exists for Version 1.0.0."** Cloud
Database and Cloud Synchronization are a different, permanent
disposition — **cancelled**, not deferred (Milestone 8,
`docs/MILESTONE_8_SCOPE_CHANGE.md`) — and are labeled N/A, not
"Deferred," wherever they appear below.

**Classification legend** used per requirement: **A** — implemented/
validated repository readiness. **B** — can be completed locally
without operated infrastructure (and has been). **C** — deferred by
the explicit product/release decision above. **D** — N/A, cancelled
product scope (Cloud Database/Cloud Sync). **E** — genuine unresolved
blocker. **F** — requires owner/external action this development
process cannot take.

No task below is marked "complete" merely because some of its
requirements are locally satisfied — each requirement is classified
individually, and each task's own Definition of Done is evaluated
against the *whole* requirement set, not the locally-satisfiable part
alone.

## Update (post-M10 hardening — R1/R2, V1 documentation reconciliation)

Two rounds of production-readiness and security hardening (R1, R2—
`docs/CHANGELOG.md`'s "Post-M10 hardening (R1/R2)" entry,
`PROJECT_STATUS.md`'s "Post-Milestone-10 Hardening" section) were
completed after this document was originally written. **The governing
decision below is unchanged and not reopened by any of that work**:
repository engineering — now including R1/R2's own additions — is
V1-ready; a real, operated production deployment remains intentionally
deferred; **no update in this document, or in any document touched by
this reconciliation, is evidence that a production deployment
happened.** No Vercel project, production domain, Supabase project, or
Sentry project exists today, exactly as before.

The one classification-relevant change: R1-2 ("Aave API Rate Limiting")
added `middleware.ts` at the repository root. `docs/PRODUCTION_READINESS.md`
§6 previously stated no `middleware.ts` existed anywhere in the
repository — that statement is now false and has been corrected there
(§6–7). It does **not** change M10-005's own classification below:
`middleware.ts` is a standard, portable Next.js primitive applying a
narrow, repository-owned rate-limit boundary to `/api/aave/*` only, not
a platform-specific deployment file — the "Build configuration"
requirement remains classified **A**, on stronger evidence than before,
not a new gap. It likewise does not change M10-006's classification:
"Version 1 is available in production" still requires an operated
deployment that does not exist, and application-level rate limiting
(itself explicitly documented as a process-local, in-memory control,
not a substitute for infrastructure-level/distributed throttling — see
`docs/PRODUCTION_READINESS.md` §7) is not read as evidence otherwise.

## M10-005 — Configure Production Environment

Dependencies: M10-002 (complete). DoD: "Production configuration
matches Build Guide requirements."

| Requirement | Class | Evidence |
|---|---|---|
| Environment variables | **A** | `docs/PRODUCTION_READINESS.md` §1 — every variable in `.env.example` cross-checked against `utils/env.ts`'s schema, all optional |
| Supabase configuration (code path) | **A** | §2 — graceful degradation confirmed (`SUPABASE_NOT_CONFIGURED`) |
| Supabase configuration (a real project) | **F** | §2 — creating a real Supabase project is owner/external action; Path B does not permit this development process to create one |
| Deployment secrets | **F** | §3 — no hosting secrets exist because no hosting target is chosen; owner/external action |
| Security headers | **A** | §4 — verified against a real local production build/server |
| Caching | **A** | §5 — verified, Next.js defaults confirmed correct |
| Build configuration | **A** | §6 — verified portable, no vendor lock-in |

**Task status**: everything this repository itself controls matches
the Build Guide (already true since Batch 1, re-confirmed here by
citation, not re-run). The two external-infrastructure requirements
remain **F**. `docs/PRODUCTION_READINESS.md`'s own closing line already
states this precisely: "Everything this repository controls is
production-ready. The remaining gap between 'production-ready' and 'in
production' is entirely external infrastructure this release
deliberately does not include." Not marked fully complete — the DoD's
own "matches Build Guide requirements" is satisfied only for the
repository-controllable scope.

## M10-006 — Deploy Version 1

Dependencies: M10-005. DoD: **"Version 1 is available in production."**

| Requirement | Class | Evidence |
|---|---|---|
| Immutable build | **B** | Every commit on `origin/main` is immutable by construction (git); `pnpm build` is reproducible and already verified locally (`docs/PRODUCTION_READINESS.md` §6) |
| Tagged release | **F** | `CONTRIBUTING.md`'s "Release identification" section documents the exact `git tag -a v1.0.0 <sign-off-commit-sha>` procedure; the tag has **not** been created, locally or on the remote (`git ls-remote --tags origin` returns nothing) — this development process has no push access, and per this batch's own explicit instruction, **the tag is not created or pushed here without separate, explicit approval** |
| Production database migrations | **D** | Cloud Database is cancelled (Milestone 8) — there is no production database to migrate. **Distinct from local storage-schema migration**, which is real: `STORAGE_SCHEMA_VERSION`/`REGISTERED_MIGRATIONS`/the chain-walking mechanism are fully built, tested, and wired into the real app-boot path (`docs/VERSIONING_STRATEGY.md`) — classified **A**, but this is local-storage migration, not the "production database migrations" this requirement names |
| Production assets | **B** (local build only) | `pnpm build` output already verified locally (`docs/PRODUCTION_READINESS.md`); deploying those assets to a live, operated host is **C** |

**Task status: DoD not satisfied, and not represented as satisfied.**
"Version 1 is available in production" requires an operated production
deployment, which does not exist by explicit Path B decision. **M10-006
remains explicitly deferred — "Deferred by explicit product/release
decision — no operated production deployment exists for Version
1.0.0."** Local `pnpm build && pnpm start` verification (already
performed, `docs/PRODUCTION_READINESS.md`) is **not** reinterpreted as
satisfying this DoD — it is repository-readiness evidence for a future
deployment, not evidence a deployment happened.

## M10-007 — Verify Production Deployment

Dependencies: M10-006 (deferred). DoD: "Production behaves identically
to the approved release candidate."

There is no production deployment to verify against — this task's own
dependency is unmet. What can honestly be documented is **local
production-mode verification** (`pnpm build && pnpm start` against a
real local server, not a hosted one), already performed in Milestone 10
Batch 1:

| Verify item | Class | Evidence |
|---|---|---|
| Application startup | **B** | Local production-mode server starts and serves `200` on every route (`docs/PRODUCTION_READINESS.md`) |
| Dashboard, Portfolio management, Simulation, Loop Builder, Exit Planner, Import/export | **B** | Covered by the 151-test Playwright suite run against a real browser, plus manual local production-mode smoke checks |
| Authentication | **B** (dormant path) / **F** (a real Supabase project) | Dormant-but-functional path fully tested; a real project to sign in against does not exist |
| Synchronization | **D** | Cloud Sync is cancelled — nothing to verify |

**Task status**: not complete. **Local production-mode verification is
not hosted deployment verification** — the task's own DoD compares
"production" against "the approved release candidate," and there is no
"production" to compare. Classified **C** overall, with the individual
Verify items above documented as repository-readiness (**B**) evidence
for whenever a real deployment exists.

## M10-008 — Create Rollback Package

Dependencies: M10-006 (deferred). DoD: "Rollback can be initiated
immediately if required."

| Include item | Class | Evidence |
|---|---|---|
| Previous deployment | **C** | No ProfitPilot-operated deployment has ever existed — there is no "previous deployment" artifact to package, because there has never been a first one |
| Migration strategy | **A** | `docs/VERSIONING_STRATEGY.md`'s storage-migration policy, `REGISTERED_MIGRATIONS`'s chain-walking mechanism (fully tested), and `docs/OPERATIONAL_RUNBOOK.md`'s "Application rollback procedure" (cites the real `UNSUPPORTED_SCHEMA_VERSION` safe-rejection behavior — no automatic data downgrade is promised) |
| Recovery documentation | **A** | `docs/DISASTER_RECOVERY.md` (all 10 named scenarios), `docs/OPERATIONAL_RUNBOOK.md` (backup/restore/recovery-snapshot procedures), `CONTRIBUTING.md`'s release/tag identification policy |

**Task status, nuanced rather than collapsed**: this is the closest of
the seven to being genuinely satisfiable without operated
infrastructure. For a **self-hosting operator** (the only kind of
deployer this product actually has), a rollback can be initiated
immediately today: pull a previous commit/tag, rebuild, restart — the
documented procedure, migration safety guarantee, and release-
identification convention are all real and already exist. What
specifically does not exist is a *ProfitPilot-operated* previous
deployment to roll back — because no ProfitPilot-operated deployment
has ever launched. The rollback *package* (documentation +
migration strategy + recovery documentation) is genuinely complete;
the "previous deployment" artifact is **C**, not because the package is
incomplete but because there is nothing ProfitPilot-operated yet to
have a "previous" version of.

## M10-009 — Enable Production Monitoring

Dependencies: M9-049 (complete, Milestone 9 Batch 9). DoD: "Critical
production issues become visible quickly."

| Monitor item | Class | Evidence |
|---|---|---|
| Application errors | **A** (wiring) / **C** (live enablement) | `docs/OBSERVABILITY.md` M9-049 — `captureError`/`initErrorMonitoring` fully wired and tested against a mocked SDK; genuinely dormant until `NEXT_PUBLIC_SENTRY_DSN` is set to a real project |
| Provider failures | **D** | No live `PriceProvider`/`ProtocolProvider` adapter exists (Manual Mode) — nothing to monitor |
| Synchronization failures | **D** | Cloud Sync cancelled |
| Import failures | **A** (wiring) / **C** (live enablement) | `logDiagnosticEvent` wired on both import failure paths (`SettingsPageClient.tsx`), tested |
| Unexpected crashes | **A** (wiring) / **C** (live enablement) | `app/error.tsx`/`app/global-error.tsx` call `captureError`, tested |

**Task status: not complete.** "Enable" means activating monitoring
against a real, live Sentry project — Path B does not permit creating
one. **A configured Sentry SDK is not active hosted monitoring.** The
underlying capability (M9-049) is genuinely complete and tested; the
"enable in production" action itself is **C** — deferred by explicit
product/release decision.

## M10-010 — Verify Production Logging

Dependencies: M10-009. DoD: "Logs support troubleshooting without
exposing user financial data."

| Verify item | Class | Evidence |
|---|---|---|
| Error identifiers | **A** | `DiagnosticEvent.code`, `app/error.tsx`'s `generateDiagnosticId()` — both tested |
| Version identifiers | **A** | `DiagnosticEvent.appVersion` (`APP_VERSION`) — tested |
| Formula version | **A** | `DiagnosticEvent.formulaVersion` — populated when a caller has real `FormulaResult.metadata`, correctly omitted otherwise — tested |
| Engine version | **A** | `DiagnosticEvent.engineVersion` — tested |
| Sanitized context | **A** | `scrubForTelemetry` — redacts any credential-shaped key, applied to every event before it is ever logged or forwarded; tested (`tests/unit/services/observability/`) |

**Task status: deferred/partially satisfied under Path B — not fully
satisfied.** This task's title is "Verify **Production** Logging," and
no production environment exists to verify logging *in*. Precisely:

- **Structured diagnostic-logging mechanism**: implemented and
  validated — **A**. `services/observability/diagnosticEvent.ts` exists
  and is fully tested.
- **Required fields and privacy/sanitization behavior** (the five
  Verify items in the table above): validated **locally**, against the
  browser console — **A**, but local, not production.
- **Production-environment verification** (logs actually observed
  coming from a real, operated deployment): **C — deferred**. No
  operated production deployment exists to generate a real log to
  verify.
- **Centralized hosted log aggregation**: **not implemented, not
  claimed**. `logDiagnosticEvent` writes to the browser console — the
  one real, always-available structured log this local-first,
  client-only application has (`docs/OBSERVABILITY.md`'s own words) —
  which is explicitly not a centralized, hosted log platform; none
  exists because no live Sentry project exists.

**This does not redefine "Production Logging" as "local console
diagnostics."** The underlying logging mechanism and its privacy
behavior are genuinely, honestly validated — that is real,
repository-level evidence. But M10-010's own canonical DoD, read
literally, is a production-environment verification this batch cannot
honestly claim to have performed, because there is no production
environment. M10-010 remains **deferred overall**, alongside the other
six tasks in this cluster — it is not marked complete.

## M10-011 — Review Production Health

Dependencies: M10-009. DoD: "No unexpected production issues remain
after launch."

| Review item | Class | Evidence |
|---|---|---|
| Error rate | **C** | No production traffic exists to measure a rate from |
| Performance | **C** (production) | `docs/PERFORMANCE_BASELINE.md` exists but measures `localhost` only, by its own explicit statement — not production performance |
| Availability | **C** | No operated deployment exists to have uptime |
| Successful synchronization | **D** | Cloud Sync cancelled |
| Provider stability | **D** | No live provider adapter exists (Manual Mode) |

**Task status: not complete, and cannot honestly be evaluated.** There
has been no launch, so "no unexpected production issues remain after
launch" has no real-world evidence to check against. Classified **C**
throughout — a known, already-approved deferral, not an unresolved
problem (**E** does not apply; this is a deliberate decision, not a
blocker). Console/diagnostic logging (M10-010) is not evidence of
production log aggregation, and a successful local build is not
evidence of production health under real traffic — neither is claimed
here.

## Release tag disposition

`v1.0.0` is required by M10-006's own "Tagged release" requirement.
The procedure is fully documented (`CONTRIBUTING.md`), the exact
sign-off commit is identified (`865d9d5cdcdd88f2714f8bd14389e7b43f83feed`,
`PROJECT_STATUS.md`), and this batch confirms via
`git ls-remote --tags origin` that no `v1.0.0` tag exists on the
remote. **Classified F — owner/external action.** Not created or
pushed here; requires the repository owner's own explicit action
(this development process has no push access), and, per this batch's
own instruction, requires separate explicit approval even when push
access is available.

## Stale Settings UI copy — scope determination

`docs/TECHNICAL_DEBT.md` (Milestone 10 Batch 5) already identifies
`app/settings/SettingsPageClient.tsx`'s "does not yet sync to the
cloud" copy as stale/misleading user-facing text. **Determination**:
this does not belong to M10-005–M10-011's canonical scope — none of the
seven tasks' own Include/Verify/Review/Monitor lists (read directly
from `docs/06_TASKS.md`, reproduced above) mention Settings UI copy,
general UI text accuracy, or Cloud Sync messaging. Fixing it here would
be scope expansion, not disposition of these seven tasks. **Left
untouched** — no runtime code was modified in this batch; it remains
tracked technical debt (`docs/TECHNICAL_DEBT.md`, Priority 1) for a
Batch 7 closure review or a specifically approved follow-up.

## Summary

| Task | Repository-readiness portion | External/deferred portion | Overall status |
|---|---|---|---|
| M10-005 | Complete (env vars, headers, caching, build config) | Real Supabase project, deployment secrets (**F**) | Not fully complete — external portion outstanding |
| M10-006 | Local build/immutability (**B**) | Operated deployment, tag, production DB migration (**C**/**F**/**D**) | **Not complete — explicitly deferred** |
| M10-007 | Local production-mode smoke verification (**B**) | No production to compare against (**C**) | **Not complete — explicitly deferred** |
| M10-008 | Migration strategy + recovery docs (**A**) | "Previous deployment" artifact (**C**) | Repository portion complete; task not fully complete |
| M10-009 | SDK wiring, fully tested (**A**) | Live enablement (**C**); Provider/Sync monitoring (**D**) | **Not complete — explicitly deferred** |
| M10-010 | Structured, privacy-scrubbed local logging mechanism, fully validated (**A**) | Production-environment verification (**C**); hosted log aggregation does not exist and is not claimed | **Not complete — deferred/partially satisfied under Path B** |
| M10-011 | N/A | Entirely dependent on real production traffic (**C**/**D**) | **Not complete — explicitly deferred, cannot be evaluated** |

**No task above is described as operationally executed.** Version
1.0.0's software release and quality sign-off remain complete;
self-hostable repository readiness is complete where evidenced above;
operated public deployment and live hosted monitoring remain deferred;
Cloud Database/Cloud Sync remain cancelled.

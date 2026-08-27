# Maintenance Schedule

`06_TASKS.md` M10-020 ("Create Maintenance Schedule") — Milestone 10
Batch 4. Dependencies: M10-019. Description: "Define bug-fix releases,
security updates, dependency updates, documentation reviews." DoD:
"Maintenance expectations are documented."

**Scope, read honestly**: ProfitPilot has no company, no support
organization, no on-call rotation, and no operated production
deployment (`docs/INCIDENT_RESPONSE.md`'s own scoping paragraph
applies identically here). This document does not commit to a release
calendar or an SLA neither this project nor this development process
has any authority to promise — it defines **triggers**, not dates: what
event causes maintenance work to happen, using this project's own
already-established practices (`docs/VERSIONING_STRATEGY.md`'s version
rules, `docs/INCIDENT_RESPONSE.md`'s severity-driven urgency,
`docs/SECURITY_REVIEW.md`'s own recorded follow-ups) as the evidence
base, not invented policy.

## Bug-fix releases

A bug-fix release is a `PATCH` version bump under
`docs/VERSIONING_STRATEGY.md`'s own semantic-versioning rules — "an
approved release fix only... a genuine defect, a documentation
correction, a dependency/security patch," the same definition
`CONTRIBUTING.md`'s "Version 1.0.0 scope freeze" section already uses,
with a regression test per this project's own standing practice.

**Trigger, not calendar, and not automatic**: a found defect does not by
itself cause a release — urgency, and whether a fix ships on its own or
is batched into the next planned work, follows
`docs/INCIDENT_RESPONSE.md`'s own Classification table
(`docs/DEFECT_CLASSIFICATION.md`'s P0–P3 definitions): a P0 (data loss,
security breach, incorrect critical financial result, unusable
application) is worked and released immediately, on its own; a P1 is
worked before the next release, whenever that is; a P2 ships with a
documented workaround in the meantime and is fixed opportunistically,
not urgently (see `docs/KNOWN_ISSUES.md` category C for this project's
own current P2s, none of which has triggered an off-cycle release); a
P3 is scheduled normally, batched into whatever release is next. Every
fix — regardless of how it was scheduled — follows the full validation
pipeline (`pnpm validate`) before release, the same standing
requirement every batch in this engagement has already followed.

## Security updates

Two distinct triggers, both already established by prior work rather
than newly invented here:

1. **Reactive, already-recorded standing follow-up**
   (`docs/SECURITY_REVIEW.md` M8-054/M9-029, unchanged): re-run
   `pnpm audit` whenever `next`, `eslint-config-next`, `@sentry/nextjs`,
   `@tailwindcss/postcss`, or `vitest` — the five direct dependencies
   every currently-known advisory transits through — is next upgraded,
   to confirm whether the advisory count has actually changed.
2. **Release-triggered**: `pnpm audit` runs as part of `pnpm validate`
   at every release-preparation step regardless of the above, the same
   practice already followed at every Milestone 9/10 batch in this
   engagement (see `docs/DOD_COMPLIANCE_AUDIT.md`'s own repeated
   re-runs of this exact check).

A newly-found advisory is triaged the same way `docs/INCIDENT_RESPONSE.md`'s
"Critical dependency vulnerability" section already describes:
classified by whether the affected package actually ships to the
browser (reachability, the same distinction `docs/SECURITY_REVIEW.md`'s
own audit table already draws) before deciding urgency — a
newly-found, runtime-reachable advisory is a P0/P1 candidate and is
triaged under "Bug-fix releases" above; a build/lint/test-time-only
advisory is tracked, not treated as an emergency, and carries no
remediation deadline.

**This is a triage process for a newly-discovered advisory — it is not
a claim that a remediation is currently owed.** This project's current,
already-documented dependency-audit baseline (`docs/KNOWN_ISSUES.md`
category C, `docs/DEFECT_CLASSIFICATION.md` §6: 18 `pnpm audit`
advisory instances across the *full* dependency tree, 11 high / 7
moderate / 0 critical) is not an open runtime vulnerability list —
every one of those 18 is a build/lint/test-time-only tooling-dependency
path, verified unreachable from client-shipped runtime code, and
already classified P2/non-blocking. This schedule's job is only to
define how a *future* advisory gets triaged, not to reopen or restate
that existing finding differently.

**Update — `pnpm audit --prod` is the ongoing release-gate command
(established R2-4, "Dependency Security Follow-up + Release E2E
Policy").** The full-tree 18-instance figure above is a one-time,
broader audit (M9-029) that also covers dev/lint/test-only tooling —
too broad for a repeatable *release* gate, which only needs to know
what actually ships in the built application. `pnpm audit --prod`
(production dependency tree only) is that narrower, repeatable command:
run it before cutting a release, and whenever `next`, `@sentry/nextjs`,
`@supabase/supabase-js`, or any other direct production dependency is
upgraded — in addition to, not instead of, the full-tree trigger above.
As of R2-4, it reports exactly 1 finding (`sharp`, confirmed unused,
tracked — see below), down from 9 after `package.json`'s
`pnpm.overrides` closed 8.

**Severity alone does not decide urgency — reachability and remediation
availability do.** `docs/SECURITY_REVIEW.md`'s M9-029 "R2-4 update"
section is the authoritative, detailed triage policy (its own **FIX
NOW** / **TRACK / WAIT FOR UPSTREAM** / **NOT RUNTIME-REACHABLE** /
**FALSE/IRRELEVANT FOR CURRENT PRODUCT USAGE** categories) — this
schedule does not duplicate it, only points to it: for every finding,
trace the actual dependency path (`pnpm why <package>`) and ask whether
attacker-controlled input ever reaches it in this application's own
runtime, not just what its CVSS/severity label says. A finding that is
both runtime-reachable *and* has no safe override/upgrade available is
what blocks a release; nothing in the current 1-finding set meets both
conditions. **An accepted transitive risk needs an explicit revisit
condition, not an open-ended "accepted forever."** The current
accepted risk (`sharp`) has one: revisit if `next` itself bumps its own
`sharp` dependency, or if this application ever adopts `next/image`
(`docs/SECURITY_REVIEW.md`'s own words) — a condition to re-check, not
a promise of a fixed date.

## Dependency updates

Broader than security alone — `docs/SECURITY_REVIEW.md` M9-029's own
"Unmaintained packages"/"Unnecessary packages" review categories are
the model for a periodic freshness check, not only a vulnerability
response. **Trigger**: reviewed at each release-preparation step (the
same point security updates are checked), and whenever a dependency
bump is otherwise motivated (a needed feature, a security patch) — a
dependency is never bumped merely because a newer version exists.

**No blind or automatic upgrades.** Every dependency bump is a
deliberate, individually-reviewed change, not a bulk or automatic
update — this repository has no automated update tooling (e.g.
Dependabot/Renovate) configured today, and none is implied to exist; a
real, currently-manual gap, stated honestly rather than glossed over.
A bump updates `package.json` and regenerates `pnpm-lock.yaml` together
in the same change (`pnpm install`, never a hand-edited lockfile), so
the two never drift — the same lockfile-consistency discipline
`pnpm install --frozen-lockfile` already enforces in this project's own
CI and release-preparation steps. Any dependency bump — security-
motivated or not — requires the full validation pipeline
(`pnpm typecheck`/`lint`/`format:check`/`test`/`build`) to pass before
it ships, the same standing requirement this engagement has followed
for every change.

## Documentation reviews

This engagement's own demonstrated practice — not a new invention — is
release-triggered, not calendar-triggered: `docs/06_TASKS.md` M10-016
("Review Documentation Set") was itself performed this way (Milestone
10 Batch 3), and every batch throughout this entire project has begun
with a documentation re-read before implementation (`PROJECT_STATUS.md`'s
own repeated "documentation review, as instructed" notes).

**Triggers** — the living documentation set (`PROJECT_STATUS.md`'s own
list of non-frozen documents) is re-checked for consistency whenever:

- a **user-visible behavior change** ships (a new capability, a changed
  workflow, a changed UI label);
- an **architecture or configuration change** ships (a new environment
  variable, a changed dependency, a changed build/deploy step);
- a **release or version change** happens (any of the four independent
  version axes `docs/VERSIONING_STRATEGY.md` tracks moves);
- an **operational or security change** happens (a new/changed incident
  type, a new security mitigation, a changed threat-model finding); or
- a **factual inconsistency is newly discovered**, whether found during
  one of the triggers above or incidentally while working on something
  else (the same way Conflicts #1–#39 were each actually found).

**Evidence/review required**: a documentation review's own findings are
recorded in `PROJECT_STATUS.md` — either as a fix to the specific living
document found inconsistent, or, if the finding is a frozen-document
conflict, as a new numbered conflict entry rather than a silent edit.
Frozen specification documents (`README.md`, `docs/0X_*.md`) are read
for consistency checking but are not edited as part of this process
(`CONTRIBUTING.md`'s "Specification documents" section) — a
documentation review finds and records a frozen-document conflict; it
does not resolve one by silently editing frozen text, and it does not
rewrite frozen historical evidence to make it agree with current living
documentation.

## What this schedule is not

- **Not a release calendar.** No fixed cadence ("every N weeks/months")
  is promised — every trigger above is event-driven, matching this
  project's own real, demonstrated history (every prior release in this
  project has been prepared when its own batch of work was ready, never
  on a calendar date).
- **Not an SLA.** No response-time commitment is made to any external
  party — the same "no support email, help desk, ticketing system, or
  SLA" framing `docs/SUPPORT_PLAYBOOK.md` already states applies here.
- **Not automated.** No CI job currently enforces any trigger above
  (e.g., a scheduled dependency-audit workflow) — every trigger is
  presently a manual practice, honestly stated as such rather than
  implied to be automatic.

# Incident Response Procedure

`06_TASKS.md` M9-052 ("Create Incident Response Procedure"). Dependencies:
M9-049. Description: "Document response steps for production incidents."
Include: "Incorrect financial output, Data loss report, Security issue,
Cloud outage, Broken import, Failed migration, Critical dependency
vulnerability." DoD: "The team has a defined escalation, mitigation,
communication, and rollback process."

**Scoped honestly to what this project actually is** — the same
discipline `docs/DISASTER_RECOVERY.md`/`docs/CROSS_BROWSER_REVIEW.md`
already establish for their own scope. ProfitPilot is a self-hostable,
local-first, single-maintainer-model application with no company, no
on-call rotation, no status page, and (in this environment) no live
Sentry project or production deployment. "Escalation" below means
"how a maintainer notices and prioritizes," not "who gets paged" — an
honest description of this project's real operational model, not an
invented enterprise process that doesn't fit it. One of the seven named
incident types (**Cloud outage**) is permanently not applicable for the
same reason `docs/DISASTER_RECOVERY.md`'s own "Unavailable Supabase"/
"Sync conflict" sections are — Cloud Database and Cloud Synchronization
are cancelled (`docs/MILESTONE_8_SCOPE_CHANGE.md`).

## Incorrect financial output

**Detection**: A user-reported number that disagrees with `02_Formulas.md`,
or a failing case in `tests/fixtures/formulaCoverage.ts`/the Golden
Reference Portfolio suite (`tests/unit/engine/`) that wasn't caught
before release.

**Escalation**: Treat as the single highest-priority defect class this
project has — `01_PRD.md`'s own "Fail Secure" philosophy and this
engagement's own standing rule ("Do not change financial formulas unless
explicitly required by the specification") both make a wrong number a
correctness emergency, not a cosmetic bug. Reproduce with a minimal,
real portfolio input before touching any code.

**Mitigation**: Fix at the Engine layer (`engine/`) only — never patch a
wrong result in a Service/Store/UI layer, which would hide the same bug
recurring through a different call path. Add the reproducing case to
`tests/fixtures/formulaCoverage.ts`/`tests/unit/engine/formulaBoundaryTests.test.ts`
as a permanent regression test before considering the fix complete —
this project's own established practice throughout every batch of this
engagement.

**Communication**: If already released, correct `docs/CHANGELOG.md`
(when it exists — `docs/DOD_COMPLIANCE_AUDIT.md`'s own Batch 1 finding
notes none exists yet) with an explicit, dated correction entry, not a
silent fix — a user who acted on the wrong number deserves to know it
was wrong, per `01_PRD.md`'s own "every displayed number must have a
documented origin" principle.

**Rollback**: `git revert` the specific commit that introduced the
regression once identified via `git bisect` against the Golden Reference
Portfolio suite, which exists exactly to make this bisectable
(deterministic, fixture-based, no external dependency).

## Data loss report

**Detection**: A user reports missing or corrupted data (a portfolio, a
saved strategy) after using the application.

**Escalation**: First confirm which `docs/DISASTER_RECOVERY.md` scenario
this actually is — "Malformed local storage," "Failed migration,"
"Failed import," "Deleted local browser data," "Import replacement
mistake," or "User deletion" all present as "data is gone" from a user's
point of view but have different real causes and different recovery
paths. Do not guess; ask what the user did immediately before noticing
the loss.

**Mitigation**: Walk the user through `docs/DISASTER_RECOVERY.md`'s own
matching section — Recovery Snapshots (`/settings` → **Recovery
Snapshots**) for anything import/migration-related, a previously
exported backup for anything else. If the report reveals a genuine code
defect (e.g. a migration step that doesn't actually preserve data, or a
Recovery Snapshot that fails to restore correctly), that is itself a
regression to fix and cover with a test in
`tests/unit/services/persistence/`, not just a one-off support response.

**Communication**: Be explicit about what `docs/DISASTER_RECOVERY.md`
already states plainly for the scenario that applies — including its
honest limitations (e.g. an ordinary `delete` has no automatic snapshot;
"Device unavailable"/"Deleted local browser data" have no recovery
inside the browser at all). Overpromising a recovery this application
cannot actually perform is worse than an honest "this cannot be
recovered."

**Rollback**: Not applicable to the user's own data (there is nothing to
roll back a local delete/corruption to, beyond the mechanisms above) —
if the root cause was a code defect, the fix follows the same
`git revert`/regression-test path as "Incorrect financial output."

## Security issue

**Detection**: A vulnerability report (a dependency advisory via
`pnpm audit`, a code-level finding, or an external report), or a genuine
gap found during a future security review beyond `docs/SECURITY_REVIEW.md`'s
own Milestone 9 Batch 6 baseline.

**Escalation**: Classify against `docs/SECURITY_THREAT_MODEL.md`'s own 9
named threats first — is this a new threat class, or a new instance of
one already documented and mitigated? A report matching an already-
mitigated threat (e.g. another CSV-formula-injection variant) is a
regression-test-and-fix, not a new investigation from scratch.

**Mitigation**: For a dependency vulnerability, `pnpm audit` + `pnpm
update` the specific package, re-run the full validation pipeline
(`docs/SECURITY_REVIEW.md`'s own M9-029 table already distinguishes
build/lint/test-time-only advisories, which are real but not runtime-
exploitable, from ones that would need an immediate patch — re-triage
against that same distinction). For a code-level finding, fix at the
layer the threat model identifies as the mitigation's own owner (e.g. a
new sensitive-field name goes in `services/shared/sensitiveFields.ts`'s
own list, not a one-off filter elsewhere).

**Communication**: Update `docs/SECURITY_REVIEW.md`/`docs/SECURITY_THREAT_MODEL.md`
with the finding and its fix, dated, in the same style every prior batch
in this document already uses ("Genuine defect found and fixed") — never
silently patch security-relevant code without a durable record of what
the exposure was.

**Rollback**: If a security fix itself causes a regression, `git revert`
it and re-assess rather than shipping a broken mitigation — a mitigation
that breaks core functionality is not actually a net improvement (the
same tradeoff `next.config.ts`'s own CSP `'unsafe-inline'` reasoning
already documents making deliberately).

## Cloud outage — *not applicable*

Cloud Database and Cloud Synchronization are cancelled by product
decision (`docs/MILESTONE_8_SCOPE_CHANGE.md`) — this application has no
cloud backend in its critical path for persistence, so there is no cloud
outage that could take core functionality down. Authentication
optionally uses Supabase independently of persistence
(`services/auth/supabaseClient.ts`'s own header comment); if a deployer's
own configured Supabase project is unreachable, the dormant Auth feature
simply becomes unavailable — `authService.ts`'s existing
`SUPABASE_NOT_CONFIGURED`/network-failure handling (Milestone 9 Batch 8,
M9-047) already covers this as a safe, non-blocking failure, not a
whole-application outage.

## Broken import

**Detection**: `docs/DISASTER_RECOVERY.md`'s own "Failed import" section
covers the expected, already-tested failure shapes
(`INVALID_IMPORT_FILE`, a partial-apply failure). "Broken" here means
something outside that already-covered set — e.g. a previously-working
import file format that now fails after a schema change, or a genuine
defect in `services/import/`.

**Escalation**: Reproduce with the exact file if the reporting user can
share one (safe to do — `services/shared/sensitiveFields.ts`'s own M8-051
guarantee means a legitimate export never contains credential-shaped
data); otherwise construct the smallest file that reproduces the
reported shape. Milestone 9 Batch 9's own `logDiagnosticEvent` wiring
(`app/settings/SettingsPageClient.tsx`) means a configured deployment
already has the failing `code`/`operation` in its own diagnostic
events/Sentry messages — check there first before asking the user to
reproduce manually.

**Mitigation**: Fix in `services/import/ImportValidator.ts`/`apply.ts`,
whichever actually owns the failing step; add the reproducing file shape
as a permanent case in `tests/unit/services/import/ImportValidator.test.ts`/
`apply.test.ts`. `apply.ts`'s own automatic pre-import Recovery Snapshot
means a broken import can never leave a user's data in a partially-
applied state while this is being fixed — confirm that guarantee itself
wasn't what broke, as the first triage step.

**Communication**: If the break was caused by an intentional schema
change (`STORAGE_SCHEMA_VERSION` bump), confirm the corresponding
migration step was actually registered in
`services/persistence/migrations/migrate.ts`'s `REGISTERED_MIGRATIONS` —
a forgotten migration step is the single most likely root cause for
"this used to import fine."

**Rollback**: `git revert` the change that broke the import path;
re-validate against the full `tests/unit/services/import/` suite before
re-releasing.

## Failed migration

**Detection**: `runLocalDataMigration`
(`services/persistence/migrations/localDataMigration.ts`) reports
`status: 'restored-after-failure'`, or a user reports the application
appears to have reverted to older data after an update.

**Escalation**: `docs/DISASTER_RECOVERY.md`'s own "Failed migration"
section already documents that this is a safe-by-design failure — the
pre-migration snapshot is restored automatically, so the user's data was
never actually lost or corrupted, only left un-upgraded. Escalate as
"migration path needs a fix," not as a data-loss emergency.

**Mitigation**: Identify the exact prior `storageSchemaVersion` the
failure occurred on, and confirm whether `REGISTERED_MIGRATIONS`
(`services/persistence/migrations/migrate.ts`) actually has a step
covering it — `MISSING_SCHEMA_VERSION`/`UNSUPPORTED_SCHEMA_VERSION`/
`MIGRATION_CYCLE` each point at a different real cause (no version field
at all, a genuinely newer version this build predates, or a build-time
defect in the registered steps themselves — the third is the only one
requiring a code fix). Add the failing prior-version case to
`tests/unit/services/persistence/migrations/localDataMigration.test.ts`.

**Communication**: If the fix requires a new application release, state
plainly that affected users should update before their data can migrate
— `docs/DISASTER_RECOVERY.md`'s own existing guidance for "Unsupported
future schema" already covers the inverse case (an older build opening
newer data) with the same "update to the version that understands this
schema" resolution.

**Rollback**: A migration-step defect found before wide release should
be fixed and re-tested, not shipped and reverted later — `MIGRATION_CYCLE`
in particular is a build-time defect Milestone 9 Batch 2's own formula/
migration test coverage is designed to catch before release, not after.

## Critical dependency vulnerability

**Detection**: `pnpm audit` (already run as part of `docs/SECURITY_REVIEW.md`'s
own M9-029 baseline and re-run per the "Security issue" section above),
or a direct advisory for a package this application actually ships to
the browser (as opposed to the build/lint/test-time-only tooling
dependencies `docs/SECURITY_REVIEW.md`'s own table already distinguishes
as non-runtime-reachable).

**Escalation**: A vulnerability in a package this application's own
production bundle ships (`next`, `react`, `zustand`, `zod`,
`@supabase/supabase-js`, `@sentry/nextjs`, `decimal.js`, or any
Radix-derived UI primitive) is the priority tier above a build-tool-only
advisory — it is reachable by an actual user, not only by a developer's
own machine during `pnpm install`/`pnpm lint`.

**Mitigation**: `pnpm update <package>` to the patched version; if no
patched version exists yet, evaluate whether the vulnerable code path is
actually reachable in this application's own usage (the same reachability
analysis `docs/SECURITY_REVIEW.md`'s own table already performs for every
currently-known advisory) — document the reasoning either way rather
than leaving it unstated. Re-run the full validation pipeline
(`pnpm typecheck`/`lint`/`format:check`/`test`/`test:coverage`/`build`)
after any dependency bump, the same standing requirement every batch in
this engagement already follows.

**Communication**: Update `docs/SECURITY_REVIEW.md`'s own dependency
audit table with the new advisory count/detail and the resolution,
dated — the same living-document convention that table already
maintains across every batch that has touched it.

**Rollback**: If a dependency update itself introduces a regression
(a breaking API change, a new failing test), `git revert` the update
commit and re-triage — do not leave a known-vulnerable version installed
while working out the breaking change; pin to the last patched-and-
compatible version instead, or apply a narrower workaround
(`pnpm.overrides` in `package.json`) until a clean upgrade path exists.

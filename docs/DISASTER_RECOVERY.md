# Disaster Recovery Procedure

06_TASKS.md M8-050 ("Document Disaster Recovery Procedure"). Dependencies:
M8-013, M8-044, M8-046. DoD: "Developers and users have a documented
recovery path for supported failure modes."

This document covers the failure modes M8-050 names, scoped honestly to
what this application version can actually exhibit. Milestone 8 Batches
1–4 (Persistence Foundation, Local Storage, Import/Export, Backup and
Recovery) are implemented; Authentication and Cloud Synchronization are
not. Two of the seven failure modes below (**Sync conflict**,
**Unavailable Supabase**) therefore cannot occur yet — each is still
documented, with the recovery path this document commits to writing once
that batch ships, rather than describing behavior nothing in this version
produces.

## Malformed local storage

**Symptom**: A stored record fails to load. `PersistenceService.read`/
`list`/`listEnvelopes` return `{ ok: false }` with error code
`INVALID_PERSISTED_RECORD` (`services/persistence/validate.ts`) — the
JSON in `localStorage` under a `profitpilot:v1:...` key parses, but its
envelope or payload shape doesn't match what `validatePersistedRecord`
expects (hand-edited, corrupted by another process, or truncated by a
storage-quota failure mid-write).

**User-facing recovery**: The affected Store surfaces the error the same
way any other load failure is shown (see each Store's own `errors` field
and the page-level error banners in `app/*/page.tsx`). From
`/settings` → **Recovery Snapshots**, restore the most recent snapshot
older than when the corruption began. If no usable snapshot exists,
import a previously exported full backup (`/settings` → **Import**).

**Developer recovery**: Reproduce by writing a malformed value directly
under a `profitpilot:v1:<recordType>:<id>` key and reloading. Confirm the
Store's own error path (not a raw exception) surfaces the failure —
covered by each Store's own `*.test.ts` "invalid stored data" cases and
`tests/unit/services/persistence/validate.test.ts`.

## Failed migration

**Symptom**: `runLocalDataMigration` (`services/persistence/migrations/
localDataMigration.ts`) cannot bring a stored record to
`STORAGE_SCHEMA_VERSION`. Error codes: `MISSING_SCHEMA_VERSION` (no
`storageSchemaVersion` field at all), `UNSUPPORTED_SCHEMA_VERSION` (a
version with no registered migration step forward — including any
version newer than this application build knows, e.g. data written by a
future release), `MIGRATION_CYCLE` (a registered migration step loops
without reaching the current version — a build-time defect, not a user
data problem).

**User-facing recovery**: `runLocalDataMigration` restores the
pre-migration snapshot automatically on any failure (`status:
'restored-after-failure'` in its own `LocalMigrationReport`) — the
application continues on the prior, still-valid data rather than
partially migrating. If the underlying version genuinely has no
migration path (e.g. the browser profile is newer than the installed
application build), update ProfitPilot to the version that introduced
that schema version, or restore an older exported backup compatible with
the currently installed build.

**Developer recovery**: `tests/unit/services/persistence/migrations/
localDataMigration.test.ts` exercises the restore-on-failure path with a
synthetic registry and prior version (no real migration has run in
production yet — `STORAGE_SCHEMA_VERSION` is still `'1.0.0'`, this
application's first-ever version). When a second schema version ships,
extend `REGISTERED_MIGRATIONS` (`services/persistence/migrations/
migrate.ts`) with the new step and add the equivalent real-registry test.

## Failed import

**Symptom**: A file selected in `/settings` → **Import** is rejected —
either at the file level (`INVALID_IMPORT_FILE`: unparsable JSON, wrong
outer shape, wrong `app` identifier — `services/import/ImportValidator.ts`)
or an individual apply step fails partway through
(`services/import/apply.ts`'s `applyImport`).

**User-facing recovery**: A file-level rejection changes nothing —
nothing was written. A partial-apply failure is rolled back automatically:
`applyImport` snapshots the whole dataset in memory before writing
anything and restores that exact snapshot on any failure at any step, for
every merge mode. Re-export a fresh backup from the source and retry, or
try a narrower merge mode (e.g. `addAsNew` instead of `replaceAll`).

**Developer recovery**: `tests/unit/services/import/apply.test.ts`'s
"rollback on failure" cases use a `createFailingBulkWriteAdapter` test
double to force a failure partway through and assert the pre-import
dataset is exactly restored, across multiple record types.

## Sync conflict — *not yet reachable*

Requires Cloud Synchronization (Milestone 8, a later batch — 06_TASKS.md
"CLOUD SYNCHRONIZATION" section, M8-026 onward), not yet implemented.
Once that batch ships, this section will document: how a conflict is
detected, the merge/last-write-wins/user-choice strategy it resolves
with, and how a user recovers if resolution itself fails.

## Unavailable Supabase — *not yet reachable*

Requires Cloud Database / Cloud Synchronization (Milestone 8, later
batches), not yet implemented. `04_BUILD_GUIDE.md`'s own "DISASTER
RECOVERY" section already states the intended behavior once cloud sync
exists: continue using the local portfolio, display a synchronization
warning, retry automatically, allow manual export — "External failures
should not prevent portfolio analysis." This section will document the
concrete implementation once that batch ships.

## Deleted local browser data

**Symptom**: The browser's own storage for this site was cleared (user
action, browser storage-pressure eviction, private-browsing session
ended, different browser/device). `PersistenceService.checkAvailability()`
reports `{ available: false }` if `localStorage` itself is unreachable;
if it's reachable but empty, every `list`/`listEnvelopes` call simply
returns zero records — this application cannot distinguish "never had
data" from "had data, now gone," since nothing survives outside the
browser's own storage in this version (no cloud sync yet).

**User-facing recovery**: There is no recovery from *within* the browser
once its storage is gone — recovery snapshots and prior local data are
both stored in that same, now-cleared `localStorage`. The only recovery
path is a previously exported backup file (`/settings` → **Import** →
**Full Backup**), which is why `/settings` → **Clear Local Data**'s own
copy recommends exporting before clearing, and why this is the strongest
reason to export a backup periodically until Cloud Sync ships.

**Developer recovery**: `services/persistence/adapters/local-storage.adapter.ts`'s
own `checkAvailability` check and `tests/unit/services/persistence/adapters/
local-storage.adapter.test.ts`'s unavailable-storage cases cover the
"storage unreachable" half of this; the "storage reachable but empty"
half needs no special handling — it is the same code path a genuine
first-time install already takes.

## Unsupported future schema

**Symptom**: A stored or imported record's `storageSchemaVersion` is
newer than this application build's own `STORAGE_SCHEMA_VERSION` — for
example, data written by a newer ProfitPilot version, then opened with an
older build. `runMigrations` (`services/persistence/migrations/migrate.ts`)
returns `UNSUPPORTED_SCHEMA_VERSION` for this exact case, since "any
version newer than `currentVersion`... by definition this application
does not yet know how to read" (that function's own header comment).

**User-facing recovery**: Update ProfitPilot to a build whose
`STORAGE_SCHEMA_VERSION` matches or exceeds the data's own version. There
is no forward-compatible read path by design — guessing at an unknown
future shape risks silently misinterpreting it (01_PRD.md REQ-012's
"Fail Secure" philosophy), so this application refuses rather than
attempts a lossy read.

**Developer recovery**: Bump `STORAGE_SCHEMA_VERSION` and add a
`MigrationStep` to `REGISTERED_MIGRATIONS` covering every prior version
whenever the storage envelope or a payload schema changes — the same
discipline `services/persistence/envelope.ts`'s own header comment
already documents for `STORAGE_SCHEMA_VERSION`'s versioning.

# Versioning Strategy

`06_TASKS.md` M10-019 ("Create Versioning Strategy") — Milestone 10 Batch
1. Dependencies: M10-003. Description: "Document semantic versioning,
formula versioning, storage versioning, migration policy, deprecation
policy." DoD: "Future releases follow documented versioning rules."

This document is new — no versioning policy existed anywhere in this
repository before Milestone 10. It formalizes the version-axis reasoning
already established in `docs/CHANGELOG.md` (Milestone 9 Batches 10–11)
into forward-looking rules for future releases, rather than repeating
that document's own point-in-time record.

## The four independent axes

ProfitPilot tracks four version numbers that measure different things
and are never expected to move together. This is unchanged from
`docs/CHANGELOG.md`'s own "Version metadata" section — restated here as
policy, not just current-state fact:

| Axis | Source | What it tracks |
|---|---|---|
| Application version | `package.json` `"version"`, `APP_VERSION` (`services/persistence/envelope.ts`) | The application release itself — this policy's own subject |
| Engine version | `ENGINE_VERSION` (`engine/shared/result.ts`) | The Formula Engine package, versioned identically to the application version today because the Engine ships inside this repository, not as a separate published package (`04_BUILD_GUIDE.md`'s own framing that the Engine "remain[s]... portable enough to be published as its own package" — not yet done) |
| Formula version | `FORMULA_VERSION` (identical across every `engine/**` calculation file) | `docs/02_Formulas.md`'s own document revision — a formula's version changes only when its documented equation changes, never when the application around it changes |
| Storage schema version | `STORAGE_SCHEMA_VERSION` (`services/persistence/envelope.ts`) | The shape of data written to `localStorage` — changes only when that shape changes |

A deployer or reviewer who sees these numbers disagree should not treat
it as a bug — see the table above for what each one actually means.

## Semantic versioning (Application/Engine version)

Standard `MAJOR.MINOR.PATCH` (semver), applied as:

- **MAJOR**: a breaking change to how a user's existing local data is
  read, a removed feature, or (per the scope-freeze policy in
  `CONTRIBUTING.md`) a deliberate new-version decision like the
  `0.1.0` → `1.0.0` Quality-Sign-Off bump itself. Requires a
  `STORAGE_SCHEMA_VERSION` bump and a real `MigrationStep` (see
  "Migration policy" below) if any existing local data would otherwise
  become unreadable.
- **MINOR**: a new feature or Formula ID added within the current
  Version's approved scope, with no breaking change to existing data or
  behavior. Not permitted on the `1.0.x` line while the scope freeze
  (`CONTRIBUTING.md`) is in effect — the next MINOR bump starts a new,
  explicitly-approved scope (Version 1.1, or Version 2 per
  `docs/06_TASKS.md` Page 10's own "Version 2 Backlog" framing).
- **PATCH**: an approved release fix only — the same definition the
  scope-freeze policy already uses (a genuine defect, a documentation
  correction, a dependency/security patch), with a regression test per
  this project's own standing practice. No new feature, no formula
  change, no UI redesign.

`ENGINE_VERSION` moves in lockstep with `package.json`'s own version
(enforced by `tests/unit/engine/shared/result.test.ts`'s own "keeps its
hardcoded ENGINE_VERSION in sync with package.json" test) — bump both
together, never one without the other.

## Formula versioning

`FORMULA_VERSION` is **not** a semver string (currently `'1.0'`) and does
not follow the Application/Engine rules above. It changes only when
`docs/02_Formulas.md`'s own documented equation for a given Formula ID
changes — the same "document the formula, then implement it" discipline
this entire engagement has followed since Milestone 2. A `FORMULA_VERSION`
change must never be silent: the specific Formula ID(s) affected, the old
and new equations, and the reason for the change belong in
`docs/CHANGELOG.md` explicitly, and every affected Golden Reference
Portfolio (`tests/fixtures/goldenReferencePortfolios.ts`) must be
re-verified against the new equation before the change ships — a Formula
change is never itself an "approved release fix" under the scope-freeze
policy above; it requires the same explicit product decision a MAJOR
Application-version bump does.

## Storage versioning and migration policy

`STORAGE_SCHEMA_VERSION` changes whenever the shape of a persisted
record (`services/persistence/envelope.ts`'s `StorageEnvelope<T>`, or any
individual record type's own payload shape) changes in a way that would
make an older stored record unreadable by the new code without
transformation.

**Every `STORAGE_SCHEMA_VERSION` bump must ship with a real
`MigrationStep`** added to `REGISTERED_MIGRATIONS`
(`services/persistence/migrations/migrate.ts`) covering the exact prior
version being superseded — no schema version may ever be bumped "for
later." `REGISTERED_MIGRATIONS` is empty today because schema `1.0.0` is
the only version that has ever shipped (there is nothing to migrate
from yet); the chain-walking mechanism itself is already fully proven
against a synthetic registry (`tests/unit/services/persistence/migrate.test.ts`,
`tests/unit/services/persistence/migrations/localDataMigration.test.ts`)
and wired into the real app-boot path
(`providers/PersistenceProvider.tsx`), so the mechanism does not need to
be built when the first real migration is needed — only the migration
step itself does.

An unsupported future schema version (data written by a newer build,
opened by an older one) is always **rejected safely**, never guessed at
— `runMigrations`'s own `UNSUPPORTED_SCHEMA_VERSION` result, already
documented in `docs/DISASTER_RECOVERY.md`'s "Unsupported future schema"
section. This policy does not change that behavior; it exists to keep
that rejection rare by requiring every schema change to ship its own
forward migration.

## Deprecation policy

ProfitPilot has no deprecated feature today — this section defines the
process for when one exists, not a current list.

1. **Announce**: a feature scheduled for removal is documented as
   deprecated in `docs/CHANGELOG.md` and `docs/USER_GUIDE.md` (if
   user-facing) at least one MINOR version before removal, with the
   reason and the replacement (if any).
2. **Warn, don't break**: a deprecated feature continues to function
   through the announcing version — it is marked, not removed.
3. **Remove on a MAJOR boundary only**: an actual removal that changes
   behavior or data compatibility is a MAJOR version change (see
   "Semantic versioning" above), documented as a breaking change in
   `docs/RELEASE_NOTES.md`.
4. **Data safety first**: a deprecation that would make existing local
   data partially unreadable follows the same migration requirement
   "Storage versioning" above sets for any other schema change — a
   feature is never deprecated in a way that silently drops a user's
   already-saved data.

## Documentation version

Each specification document (`01_PRD.md` through `06_TASKS.md`,
`CODING_STYLE.md`, `TERMINOLOGY.md`) declares its own `Version` field,
independent of the application version — these track the *specification's
own* revision history, not what has actually been built from it (the
same relationship `FORMULA_VERSION` has to `docs/02_Formulas.md`). A
genuine inconsistency was found auditing this axis during Milestone 10
Batch 1: `README.md` and `01_PRD.md`'s own header both declare `0.1.0`,
while `01_PRD.md`'s own footer ("END OF DOCUMENT" block) and the other
five spec documents (`02_Formulas.md` through `06_TASKS.md`) all declare
`1.0`. This is recorded as a new specification conflict
(`PROJECT_STATUS.md`, Conflict #38) rather than silently corrected —
`README.md` and `docs/0X_*.md` are frozen, protected specification
documents this project's own convention does not edit as part of
ordinary work (`.prettierignore`'s "Specification documents" exclusion;
`CONTRIBUTING.md`'s "Specification documents" section). Future spec
revisions should keep a single document's own header and footer
consistent with each other going forward, and this project's own living
documents (`PROJECT_STATUS.md`, this file, `docs/CHANGELOG.md`) should
always cite the specific, real value found by inspection rather than
assume the spec set is internally consistent.

/**
 * Storage schema migration runner — 06_TASKS.md M8-004 ("Implement
 * Storage Schema Versioning"). Requirements: "Every stored record
 * includes a schema version. Unsupported future versions are rejected
 * safely. Older supported versions can be migrated. Version changes are
 * documented."
 *
 * **No real migration steps are registered in production
 * (`REGISTERED_MIGRATIONS` below is empty).** `STORAGE_SCHEMA_VERSION`
 * (`../envelope.ts`) is `'1.0.0'` — this batch is the very first time a
 * storage schema version has existed in this application, so there is no
 * real prior version to migrate *from* yet. Registering a fabricated
 * migration for a version that never shipped would be inventing history,
 * not documenting it. The chain-walking mechanism itself is still fully
 * exercised by `tests/unit/services/persistence/migrate.test.ts` using a
 * synthetic test-only registry, proving the "older supported versions can
 * be migrated" path works before any real migration ever needs it.
 *
 * `MigrationRegistry`/`runMigrations` are dependency-injected (the
 * registry is a parameter, not a hardcoded import) for exactly this
 * reason — tests can supply their own synthetic version history without
 * that history ever touching production code.
 */
import { z } from 'zod';

import { createApplicationError } from '@/services/shared/errors';
import type { MappingResult } from '@/services/shared/mappingResult';

export interface MigrationStep {
  from: string;
  to: string;
  migrate: (data: unknown) => unknown;
}

export interface MigrationRegistry {
  currentVersion: string;
  steps: MigrationStep[];
}

/** Only what every version of the envelope is trusted to still have — the version tag itself. */
const versionTagSchema = z.object({ storageSchemaVersion: z.string().min(1) }).loose();

export const REGISTERED_MIGRATIONS: MigrationStep[] = [];

/**
 * Walks `registry.steps` from the raw record's own `storageSchemaVersion`
 * up to `registry.currentVersion`, applying each step's `migrate` in
 * order. Already-current data passes through unchanged. A version with no
 * viable path to current — including any version newer than
 * `currentVersion`, which by definition this application does not yet
 * know how to read — is rejected rather than guessed at.
 */
export function runMigrations(raw: unknown, registry: MigrationRegistry): MappingResult<unknown> {
  const tag = versionTagSchema.safeParse(raw);
  if (!tag.success) {
    return {
      ok: false,
      errors: [
        createApplicationError(
          'persistence',
          'MISSING_SCHEMA_VERSION',
          'This record has no readable storage schema version and cannot be loaded.',
        ),
      ],
    };
  }

  let version = tag.data.storageSchemaVersion;
  let data = raw;

  if (version === registry.currentVersion) {
    return { ok: true, data };
  }

  const visited = new Set<string>();
  while (version !== registry.currentVersion) {
    if (visited.has(version)) {
      return {
        ok: false,
        errors: [
          createApplicationError(
            'persistence',
            'MIGRATION_CYCLE',
            'A cycle was detected while migrating stored data to the current schema version.',
          ),
        ],
      };
    }
    visited.add(version);

    const step = registry.steps.find((candidate) => candidate.from === version);
    if (step === undefined) {
      return {
        ok: false,
        errors: [
          createApplicationError(
            'persistence',
            'UNSUPPORTED_SCHEMA_VERSION',
            `Storage schema version "${version}" is not supported by this version of ProfitPilot.`,
          ),
        ],
      };
    }

    data = step.migrate(data);
    version = step.to;
  }

  return { ok: true, data };
}

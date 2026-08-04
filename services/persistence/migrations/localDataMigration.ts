/**
 * Local Data Migration Runner — 06_TASKS.md M8-013 ("Implement Local
 * Data Migration Runner"). Requirements: "Detect stored version. Back up
 * original data. Apply ordered migrations. Validate migrated output.
 * Restore original data on failure. Record migration result." DoD:
 * "Supported older data upgrades automatically without silent loss."
 *
 * Distinct from `./migrate.ts`'s `runMigrations` (M8-004), which
 * migrates one already-in-hand record. This orchestrates that function
 * across the *entire* local dataset at application startup: detect the
 * dataset's own last-known version (`'applicationMetadata'`'s singleton
 * record), and if it differs from `STORAGE_SCHEMA_VERSION`, migrate every
 * stored record of every type — atomically from the caller's point of
 * view: either every record ends up valid at the current version, or
 * nothing changes on disk at all.
 *
 * **No real migration has ever run in production** — `STORAGE_SCHEMA_VERSION`
 * is `'1.0.0'`, this application's first-ever storage schema version, so
 * every real install today either has no `'applicationMetadata'` record
 * yet (first run — this bootstraps it) or is already at `'1.0.0'` (a
 * no-op). `tests/unit/services/persistence/migrations/localDataMigration.test.ts`
 * exercises the real migrate/restore paths with a synthetic registry and
 * a synthetic prior version, the same "prove the mechanism honestly
 * without fabricating history" approach `./migrate.ts` already
 * established.
 *
 * "Back up" here means an in-memory snapshot held only for the duration
 * of this one migration attempt — not a persisted backup file (that is
 * M8-046 "Implement Automatic Local Recovery Snapshot," a later, more
 * durable Batch 4 mechanism building on the same idea). Writing a second
 * on-disk copy here would also spend storage quota during exactly the
 * operation most likely to be quota-constrained (an old, possibly large
 * dataset being upgraded).
 */
import { createEnvelope, STORAGE_SCHEMA_VERSION } from '../envelope';
import type { PersistedApplicationMetadata } from '../types';
import type { PersistedRecordType, PersistenceAdapter, StorageEnvelope } from '../types';
import { PERSISTED_RECORD_TYPES } from '../types';
import { validatePersistedRecordSchema } from '../validate';
import type { MigrationRegistry } from './migrate';
import { REGISTERED_MIGRATIONS, runMigrations } from './migrate';

const APPLICATION_METADATA_ID = 'singleton';

export type LocalMigrationStatus = 'noop' | 'migrated' | 'restored-after-failure';

export interface LocalMigrationReport {
  fromVersion: string | null;
  toVersion: string;
  migratedRecordCount: number;
  status: LocalMigrationStatus;
}

type Backup = Partial<Record<PersistedRecordType, StorageEnvelope<unknown>[]>>;

async function snapshotEverything(adapter: PersistenceAdapter): Promise<Backup> {
  const backup: Backup = {};
  for (const recordType of PERSISTED_RECORD_TYPES) {
    const listed = await adapter.list<unknown>(recordType);
    if (listed.ok) backup[recordType] = listed.data;
  }
  return backup;
}

async function restore(adapter: PersistenceAdapter, backup: Backup): Promise<void> {
  for (const recordType of PERSISTED_RECORD_TYPES) {
    const envelopes = backup[recordType];
    if (envelopes !== undefined && envelopes.length > 0) {
      await adapter.bulkWrite(recordType, envelopes);
    }
  }
}

/**
 * `originalInstalledAt` is `null` only for a genuine first-ever run — a
 * real prior `installedAt` (from before this migration) must never be
 * overwritten by a later migration's own timestamp, or the app's true
 * install date would silently drift forward on every future upgrade.
 */
async function recordMigrationResult(
  adapter: PersistenceAdapter,
  toVersion: string,
  originalInstalledAt: string | null,
  now: () => string,
): Promise<void> {
  const payload: PersistedApplicationMetadata = {
    currentStorageSchemaVersion: toVersion,
    installedAt: originalInstalledAt ?? now(),
    lastOpenedAt: now(),
  };
  await adapter.write(
    'applicationMetadata',
    APPLICATION_METADATA_ID,
    createEnvelope('applicationMetadata', APPLICATION_METADATA_ID, payload, { now }),
  );
}

export interface RunLocalDataMigrationOptions {
  registry?: MigrationRegistry;
  now?: () => string;
}

export async function runLocalDataMigration(
  adapter: PersistenceAdapter,
  options: RunLocalDataMigrationOptions = {},
): Promise<LocalMigrationReport> {
  const registry = options.registry ?? {
    currentVersion: STORAGE_SCHEMA_VERSION,
    steps: REGISTERED_MIGRATIONS,
  };
  const now = options.now ?? (() => new Date().toISOString());

  const metadataResult = await adapter.read<PersistedApplicationMetadata>(
    'applicationMetadata',
    APPLICATION_METADATA_ID,
  );
  const detectedVersion =
    metadataResult.ok && metadataResult.data !== null
      ? metadataResult.data.storageSchemaVersion
      : null;
  const originalInstalledAt =
    metadataResult.ok && metadataResult.data !== null
      ? (metadataResult.data.payload.installedAt ?? null)
      : null;

  if (detectedVersion === registry.currentVersion) {
    return {
      fromVersion: detectedVersion,
      toVersion: registry.currentVersion,
      migratedRecordCount: 0,
      status: 'noop',
    };
  }

  if (detectedVersion === null) {
    // First-ever run — nothing to migrate, but the dataset now has a
    // known version for every future run to detect against.
    await recordMigrationResult(adapter, registry.currentVersion, null, now);
    return {
      fromVersion: null,
      toVersion: registry.currentVersion,
      migratedRecordCount: 0,
      status: 'noop',
    };
  }

  const backup = await snapshotEverything(adapter);
  const migratedByType: Backup = {};
  let migratedRecordCount = 0;

  for (const recordType of PERSISTED_RECORD_TYPES) {
    const envelopes = backup[recordType] ?? [];
    const migratedEnvelopes: StorageEnvelope<unknown>[] = [];

    for (const raw of envelopes) {
      const migrated = runMigrations(raw, registry);
      if (!migrated.ok) {
        await restore(adapter, backup);
        return {
          fromVersion: detectedVersion,
          toVersion: registry.currentVersion,
          migratedRecordCount: 0,
          status: 'restored-after-failure',
        };
      }

      const validated = validatePersistedRecordSchema(recordType, migrated.data);
      if (!validated.ok) {
        await restore(adapter, backup);
        return {
          fromVersion: detectedVersion,
          toVersion: registry.currentVersion,
          migratedRecordCount: 0,
          status: 'restored-after-failure',
        };
      }

      migratedEnvelopes.push(validated.data);
      migratedRecordCount += 1;
    }

    migratedByType[recordType] = migratedEnvelopes;
  }

  for (const recordType of PERSISTED_RECORD_TYPES) {
    const envelopes = migratedByType[recordType] ?? [];
    if (envelopes.length > 0) {
      const written = await adapter.bulkWrite(recordType, envelopes);
      if (!written.ok) {
        await restore(adapter, backup);
        return {
          fromVersion: detectedVersion,
          toVersion: registry.currentVersion,
          migratedRecordCount: 0,
          status: 'restored-after-failure',
        };
      }
    }
  }

  await recordMigrationResult(adapter, registry.currentVersion, originalInstalledAt, now);

  return {
    fromVersion: detectedVersion,
    toVersion: registry.currentVersion,
    migratedRecordCount,
    status: 'migrated',
  };
}

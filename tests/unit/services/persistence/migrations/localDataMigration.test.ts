import { describe, expect, it } from 'vitest';

import { createMemoryAdapter } from '@/services/persistence/adapters';
import { createEnvelope, STORAGE_SCHEMA_VERSION } from '@/services/persistence/envelope';
import { runLocalDataMigration } from '@/services/persistence/migrations/localDataMigration';
import type { MigrationRegistry } from '@/services/persistence/migrations/migrate';
import type {
  PersistedApplicationMetadata,
  PersistedRecordType,
  PersistenceAdapter,
  StorageEnvelope,
} from '@/services/persistence/types';

/**
 * Local Data Migration Runner — 06_TASKS.md M8-013 ("Implement Local
 * Data Migration Runner"). No real migration has ever shipped in
 * production (`STORAGE_SCHEMA_VERSION` is still `'1.0.0'`, this
 * application's first-ever version) — this file constructs its own
 * synthetic registry and synthetic prior version to exercise the real
 * migrate/restore mechanism honestly, the same "prove the mechanism,
 * not fabricate history" approach `migrate.test.ts` already established
 * for `runMigrations` itself.
 *
 * `createEnvelope` always stamps the *current* `STORAGE_SCHEMA_VERSION`
 * onto whatever it builds, regardless of which payload version a test
 * wants to simulate — `oldEnvelope` below overrides the envelope's own
 * `storageSchemaVersion` field afterward to construct a genuinely "old"
 * record on disk.
 */
function oldEnvelope<T>(
  recordType: PersistedRecordType,
  id: string,
  payload: T,
  version: string,
  now: string,
): StorageEnvelope<T> {
  return {
    ...createEnvelope(recordType, id, payload, { now: () => now }),
    storageSchemaVersion: version,
  };
}

function oldApplicationMetadataEnvelope(
  version: string,
  now: string,
  installedAt: string,
): StorageEnvelope<PersistedApplicationMetadata> {
  return oldEnvelope(
    'applicationMetadata',
    'singleton',
    { currentStorageSchemaVersion: version, installedAt, lastOpenedAt: now },
    version,
    now,
  );
}

describe('runLocalDataMigration — first-ever run (M8-013)', () => {
  it('bootstraps applicationMetadata when none exists yet, without migrating anything', async () => {
    const adapter = createMemoryAdapter();
    const report = await runLocalDataMigration(adapter);

    expect(report).toEqual({
      fromVersion: null,
      toVersion: STORAGE_SCHEMA_VERSION,
      migratedRecordCount: 0,
      status: 'noop',
    });

    const metadata = await adapter.read<PersistedApplicationMetadata>(
      'applicationMetadata',
      'singleton',
    );
    expect(metadata.ok).toBe(true);
    if (!metadata.ok || metadata.data === null) return;
    expect(metadata.data.payload.currentStorageSchemaVersion).toBe(STORAGE_SCHEMA_VERSION);
  });
});

describe('runLocalDataMigration — already current (M8-013)', () => {
  it('is a no-op when the dataset is already at the current version', async () => {
    const adapter = createMemoryAdapter();
    const now = '2026-01-01T00:00:00.000Z';
    await adapter.write(
      'applicationMetadata',
      'singleton',
      oldApplicationMetadataEnvelope(STORAGE_SCHEMA_VERSION, now, now),
    );

    const report = await runLocalDataMigration(adapter);
    expect(report).toEqual({
      fromVersion: STORAGE_SCHEMA_VERSION,
      toVersion: STORAGE_SCHEMA_VERSION,
      migratedRecordCount: 0,
      status: 'noop',
    });
  });
});

describe('runLocalDataMigration — successful migration (M8-013)', () => {
  const now = '2026-01-01T00:00:00.000Z';
  const originalInstalledAt = '2025-06-01T00:00:00.000Z';

  /**
   * A real migration step must always advance the envelope's own
   * `storageSchemaVersion` — an identity `(data) => data` would leave
   * every migrated record permanently stamped at the old version,
   * indistinguishable from a migration that never ran.
   */
  const registry: MigrationRegistry = {
    currentVersion: '1.1.0-test',
    steps: [
      {
        from: '1.0.0-test',
        to: '1.1.0-test',
        migrate: (data) => ({
          ...(data as Record<string, unknown>),
          storageSchemaVersion: '1.1.0-test',
        }),
      },
    ],
  };

  it('migrates every stored record and records the new dataset version, preserving installedAt', async () => {
    const adapter = createMemoryAdapter();
    await adapter.write(
      'applicationMetadata',
      'singleton',
      oldApplicationMetadataEnvelope('1.0.0-test', now, originalInstalledAt),
    );
    await adapter.write(
      'preferences',
      'singleton',
      oldEnvelope('preferences', 'singleton', { developerModeEnabled: true }, '1.0.0-test', now),
    );

    const report = await runLocalDataMigration(adapter, { registry, now: () => now });

    expect(report.status).toBe('migrated');
    expect(report.fromVersion).toBe('1.0.0-test');
    expect(report.toVersion).toBe('1.1.0-test');
    expect(report.migratedRecordCount).toBeGreaterThanOrEqual(1);

    const preferences = await adapter.read('preferences', 'singleton');
    expect(preferences.ok).toBe(true);
    if (!preferences.ok || preferences.data === null) return;
    expect(preferences.data.storageSchemaVersion).toBe('1.1.0-test');

    const metadata = await adapter.read<PersistedApplicationMetadata>(
      'applicationMetadata',
      'singleton',
    );
    expect(metadata.ok).toBe(true);
    if (!metadata.ok || metadata.data === null) return;
    expect(metadata.data.payload.currentStorageSchemaVersion).toBe('1.1.0-test');
    // installedAt must survive the migration unchanged — only lastOpenedAt/currentStorageSchemaVersion advance.
    expect(metadata.data.payload.installedAt).toBe(originalInstalledAt);
  });
});

describe('runLocalDataMigration — restores original data on failure (M8-013)', () => {
  const now = '2026-01-01T00:00:00.000Z';

  it('restores every record unchanged when a migration step produces invalid data', async () => {
    const adapter = createMemoryAdapter();
    const registry: MigrationRegistry = {
      currentVersion: '1.1.0-test',
      steps: [
        {
          from: '1.0.0-test',
          to: '1.1.0-test',
          // Deliberately corrupts the payload so schema validation fails post-migration.
          migrate: (data) => ({
            ...(data as Record<string, unknown>),
            storageSchemaVersion: '1.1.0-test',
            payload: 'not an object',
          }),
        },
      ],
    };

    await adapter.write(
      'applicationMetadata',
      'singleton',
      oldApplicationMetadataEnvelope('1.0.0-test', now, now),
    );
    const originalPreferences = oldEnvelope(
      'preferences',
      'singleton',
      { developerModeEnabled: true },
      '1.0.0-test',
      now,
    );
    await adapter.write('preferences', 'singleton', originalPreferences);

    const report = await runLocalDataMigration(adapter, { registry, now: () => now });
    expect(report.status).toBe('restored-after-failure');

    const preferences = await adapter.read('preferences', 'singleton');
    expect(preferences).toEqual({ ok: true, data: originalPreferences });

    const metadata = await adapter.read<PersistedApplicationMetadata>(
      'applicationMetadata',
      'singleton',
    );
    expect(metadata.ok).toBe(true);
    if (!metadata.ok || metadata.data === null) return;
    // Dataset version was never advanced — a failed migration leaves no trace.
    expect(metadata.data.payload.currentStorageSchemaVersion).toBe('1.0.0-test');
  });

  it('restores every record unchanged when a migration step has no path to the target version', async () => {
    const adapter = createMemoryAdapter();
    const registry: MigrationRegistry = { currentVersion: '9.9.9-test', steps: [] };

    await adapter.write(
      'applicationMetadata',
      'singleton',
      oldApplicationMetadataEnvelope('1.0.0-test', now, now),
    );
    const originalPreferences = oldEnvelope(
      'preferences',
      'singleton',
      { developerModeEnabled: true },
      '1.0.0-test',
      now,
    );
    await adapter.write('preferences', 'singleton', originalPreferences);

    const report = await runLocalDataMigration(adapter, { registry, now: () => now });
    expect(report.status).toBe('restored-after-failure');

    const preferences = await adapter.read('preferences', 'singleton');
    expect(preferences).toEqual({ ok: true, data: originalPreferences });
  });
});

describe('runLocalDataMigration — adapter list failure surfaces safely', () => {
  it('does not throw when the underlying adapter fails mid-snapshot', async () => {
    const now = '2026-01-01T00:00:00.000Z';
    const inner = createMemoryAdapter();
    await inner.write(
      'applicationMetadata',
      'singleton',
      oldApplicationMetadataEnvelope('1.0.0-test', now, now),
    );

    const failingAdapter: PersistenceAdapter = {
      ...inner,
      list: async () => ({
        ok: false,
        errors: [{ category: 'persistence', code: 'SIMULATED_FAILURE', message: 'Simulated.' }],
      }),
    };

    const registry: MigrationRegistry = {
      currentVersion: '1.1.0-test',
      steps: [{ from: '1.0.0-test', to: '1.1.0-test', migrate: (data) => data }],
    };
    await expect(
      runLocalDataMigration(failingAdapter, { registry, now: () => now }),
    ).resolves.not.toThrow();
  });
});

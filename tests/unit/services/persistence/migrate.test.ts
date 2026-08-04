import { describe, expect, it } from 'vitest';

import type { MigrationRegistry } from '@/services/persistence/migrations/migrate';
import { REGISTERED_MIGRATIONS, runMigrations } from '@/services/persistence/migrations/migrate';

/**
 * Storage schema migration runner — 06_TASKS.md M8-004 ("Implement
 * Storage Schema Versioning"). Requirements: "Unsupported future
 * versions are rejected safely. Older supported versions can be
 * migrated."
 *
 * No production migration exists yet (`REGISTERED_MIGRATIONS` is empty —
 * see `migrate.ts`'s own header comment for why). This file constructs
 * its own synthetic registry to prove the chain-walking mechanism itself
 * works, without that synthetic history ever touching production code.
 */
describe('runMigrations — no-op path', () => {
  it('passes already-current data through unchanged', () => {
    const result = runMigrations(
      { storageSchemaVersion: '1.0.0', payload: { a: 1 } },
      { currentVersion: '1.0.0', steps: REGISTERED_MIGRATIONS },
    );
    expect(result).toEqual({
      ok: true,
      data: { storageSchemaVersion: '1.0.0', payload: { a: 1 } },
    });
  });
});

describe('runMigrations — missing/malformed version tag', () => {
  it('rejects a value with no readable storageSchemaVersion', () => {
    const result = runMigrations({ payload: { a: 1 } }, { currentVersion: '1.0.0', steps: [] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].code).toBe('MISSING_SCHEMA_VERSION');
  });

  it('rejects a non-object value outright', () => {
    const result = runMigrations('not an object', { currentVersion: '1.0.0', steps: [] });
    expect(result.ok).toBe(false);
  });
});

describe('runMigrations — unsupported version', () => {
  it('rejects a version with no migration path to current', () => {
    const result = runMigrations(
      { storageSchemaVersion: '0.5.0' },
      { currentVersion: '1.0.0', steps: [] },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].code).toBe('UNSUPPORTED_SCHEMA_VERSION');
  });

  it('rejects a version newer than the current supported version', () => {
    const result = runMigrations(
      { storageSchemaVersion: '2.0.0' },
      { currentVersion: '1.0.0', steps: [] },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].code).toBe('UNSUPPORTED_SCHEMA_VERSION');
  });
});

describe('runMigrations — synthetic multi-step chain (proves the mechanism, not a real history)', () => {
  const registry: MigrationRegistry = {
    currentVersion: '1.2.0',
    steps: [
      {
        from: '1.0.0',
        to: '1.1.0',
        migrate: (data) => ({ ...(data as Record<string, unknown>), addedIn1_1: true }),
      },
      {
        from: '1.1.0',
        to: '1.2.0',
        migrate: (data) => ({ ...(data as Record<string, unknown>), addedIn1_2: true }),
      },
    ],
  };

  it('walks a two-step chain from the oldest supported version to current', () => {
    const result = runMigrations({ storageSchemaVersion: '1.0.0', value: 'original' }, registry);
    expect(result).toEqual({
      ok: true,
      data: {
        storageSchemaVersion: '1.0.0',
        value: 'original',
        addedIn1_1: true,
        addedIn1_2: true,
      },
    });
  });

  it('walks a partial chain starting from an intermediate version', () => {
    const result = runMigrations({ storageSchemaVersion: '1.1.0', value: 'original' }, registry);
    expect(result).toEqual({
      ok: true,
      data: { storageSchemaVersion: '1.1.0', value: 'original', addedIn1_2: true },
    });
  });

  it('detects a cycle instead of looping forever', () => {
    const cyclicRegistry: MigrationRegistry = {
      currentVersion: '9.9.9',
      steps: [
        { from: '1.0.0', to: '1.1.0', migrate: (data) => data },
        { from: '1.1.0', to: '1.0.0', migrate: (data) => data },
      ],
    };
    const result = runMigrations({ storageSchemaVersion: '1.0.0' }, cyclicRegistry);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].code).toBe('MIGRATION_CYCLE');
  });
});

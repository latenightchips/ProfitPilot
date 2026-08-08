import { describe, expect, it } from 'vitest';

import { MAX_IMPORT_FILE_SIZE_BYTES, validateImportFile } from '@/services/import/ImportValidator';
import {
  APP_NAME,
  APP_VERSION,
  computeChecksum,
  STORAGE_SCHEMA_VERSION,
} from '@/services/persistence';

/**
 * Every fixture below carries a real `checksum`, computed the same way
 * `createEnvelope` does — not the placeholder literal this file used
 * before M9-032 wired checksum verification into
 * `validatePersistedRecordSchema`. A fixture named "valid" must
 * actually pass every real check a genuinely valid envelope would,
 * checksum included, or these tests would only be proving what they
 * claim to by accident.
 */
function validPortfolioEnvelope(id = 'portfolio-1') {
  const payload = {
    id,
    name: 'My Portfolio',
    baseCurrency: 'USD',
    collateral: { asset: 'BTC', quantity: 2 },
    debt: { asset: 'USDC', balance: 20000 },
    market: { btcPriceUsd: 50000 },
    protocol: {
      maxLoanToValue: 0.75,
      liquidationThreshold: 0.8,
      borrowApr: 0.05,
      supplyApr: 0.02,
    },
    settings: {},
    archivedAt: null,
    marketUpdatedAt: '2026-01-01T00:00:00.000Z',
    protocolUpdatedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  return {
    app: APP_NAME,
    storageSchemaVersion: STORAGE_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    recordType: 'portfolio' as const,
    recordId: id,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    checksum: computeChecksum(payload),
    payload,
  };
}

function loopStrategyEnvelopeWithSensitiveField() {
  const payload = {
    id: 'strategy-1',
    name: 'Strategy',
    portfolioId: 'portfolio-1',
    portfolioUpdatedAt: '2026-01-01T00:00:00.000Z',
    settings: {},
    result: { steps: [], wallet: { privateKey: '0xabc123' } },
    warnings: [],
    metadata: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
  return {
    app: APP_NAME,
    storageSchemaVersion: STORAGE_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    recordType: 'loopStrategy' as const,
    recordId: 'strategy-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    checksum: computeChecksum(payload),
    payload,
  };
}

function validFullBackupFile() {
  return {
    app: APP_NAME,
    storageSchemaVersion: STORAGE_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    exportedAt: '2026-03-15T12:00:00.000Z',
    kind: 'full-backup' as const,
    records: { portfolio: [validPortfolioEnvelope()] },
  };
}

describe('validateImportFile', () => {
  it('rejects unparsable JSON', () => {
    const result = validateImportFile('{not json');
    expect(result.ok).toBe(false);
  });

  /**
   * 06_TASKS.md M9-032 ("Audit Import Security"), "Oversized files" — a
   * genuine gap found and fixed this batch: no size limit existed
   * anywhere on the import path before `ImportValidator.ts`'s own
   * `MAX_IMPORT_FILE_SIZE_BYTES` check.
   */
  it('rejects an oversized file before attempting to parse it', () => {
    const oversized = 'x'.repeat(MAX_IMPORT_FILE_SIZE_BYTES + 1);
    const result = validateImportFile(oversized);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].message).toMatch(/too large/i);
  });

  it('rejects a file with the wrong outer shape', () => {
    const result = validateImportFile(JSON.stringify({ some: 'thing' }));
    expect(result.ok).toBe(false);
  });

  it('rejects a file missing the kind discriminator', () => {
    const result = validateImportFile(
      JSON.stringify({ ...validFullBackupFile(), kind: undefined }),
    );
    expect(result.ok).toBe(false);
  });

  it('rejects a file exported from a different application', () => {
    const file = { ...validFullBackupFile(), app: 'SomeOtherApp' };
    const result = validateImportFile(JSON.stringify(file));
    expect(result.ok).toBe(false);
  });

  it('accepts a valid full-backup file', () => {
    const result = validateImportFile(JSON.stringify(validFullBackupFile()));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.validRecordsByType.portfolio).toHaveLength(1);
    expect(result.data.issues).toHaveLength(0);
  });

  it('excludes a record with a corrupted payload but keeps the rest of the file valid', () => {
    const file = validFullBackupFile();
    const corrupted = { ...validPortfolioEnvelope('portfolio-2') };
    (corrupted.payload as Record<string, unknown>).name = 42;
    file.records.portfolio = [...file.records.portfolio, corrupted as never];

    const result = validateImportFile(JSON.stringify(file));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.validRecordsByType.portfolio).toHaveLength(1);
    expect(result.data.issues.some((issue) => issue.code === 'INVALID_RECORD')).toBe(true);
  });

  /**
   * 06_TASKS.md M9-032 ("Audit Import Security"), "Corrupted checksums" —
   * a genuine gap found and fixed this batch: `verifyChecksum`
   * (`services/persistence/envelope.ts`) existed and was unit-tested in
   * isolation since M8-003, but was never wired into
   * `validatePersistedRecordSchema` — an import (or a tampered
   * `localStorage` entry) with a stale checksum passed through
   * unnoticed. This test exercises that path end-to-end through the
   * public `validateImportFile` entry point, not just the isolated
   * `verifyChecksum` unit.
   */
  it('excludes a record whose checksum does not match its payload, tagged CHECKSUM_MISMATCH, keeping the rest of the file valid', () => {
    const file = validFullBackupFile();
    const tampered = {
      ...validPortfolioEnvelope('portfolio-4'),
      checksum: 'deadbeef',
    };
    file.records.portfolio = [...file.records.portfolio, tampered as never];

    const result = validateImportFile(JSON.stringify(file));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.validRecordsByType.portfolio).toHaveLength(1);
    expect(result.data.validRecordsByType.portfolio?.[0]?.recordId).toBe('portfolio-1');
    expect(
      result.data.issues.some(
        (issue) => issue.code === 'CHECKSUM_MISMATCH' && issue.recordId === 'portfolio-4',
      ),
    ).toBe(true);
  });

  /**
   * 06_TASKS.md M9-032 ("Audit Import Security"), "Deeply nested data" —
   * see `services/shared/payloadLimits.ts`'s own header comment for the
   * unbounded-recursion crash this guards against. Exercised here
   * end-to-end through `validateImportFile`, not just the isolated
   * `exceedsMaxNestingDepth`/`validatePersistedRecord` units.
   */
  it('excludes a record whose payload is nested far beyond any realistic shape, safely rather than crashing', () => {
    let deeplyNested: unknown = 'leaf';
    for (let i = 0; i < 200; i += 1) {
      deeplyNested = { nested: deeplyNested };
    }
    const payload = {
      id: 'strategy-2',
      name: 'Deeply Nested Strategy',
      portfolioId: 'portfolio-1',
      portfolioUpdatedAt: '2026-01-01T00:00:00.000Z',
      settings: {},
      result: deeplyNested,
      warnings: [],
      metadata: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const envelope = {
      app: APP_NAME,
      storageSchemaVersion: STORAGE_SCHEMA_VERSION,
      appVersion: APP_VERSION,
      recordType: 'loopStrategy' as const,
      recordId: 'strategy-2',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      checksum: computeChecksum(payload),
      payload,
    };
    const file = validFullBackupFile();
    file.records = { ...file.records, loopStrategy: [envelope] } as never;

    expect(() => validateImportFile(JSON.stringify(file))).not.toThrow();
    const result = validateImportFile(JSON.stringify(file));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.validRecordsByType.loopStrategy).toBeUndefined();
    expect(
      result.data.issues.some(
        (issue) => issue.recordId === 'strategy-2' && issue.code === 'INVALID_RECORD',
      ),
    ).toBe(true);
  });

  it('detects duplicate record ids within the file', () => {
    const file = validFullBackupFile();
    file.records.portfolio = [validPortfolioEnvelope(), validPortfolioEnvelope()];

    const result = validateImportFile(JSON.stringify(file));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.validRecordsByType.portfolio).toHaveLength(1);
    expect(result.data.issues.some((issue) => issue.code === 'DUPLICATE_RECORD_ID')).toBe(true);
  });

  it('accepts a single-record file with a bundled dependency', () => {
    const file = {
      app: APP_NAME,
      storageSchemaVersion: STORAGE_SCHEMA_VERSION,
      appVersion: APP_VERSION,
      exportedAt: '2026-03-15T12:00:00.000Z',
      kind: 'single-record' as const,
      recordType: 'portfolio' as const,
      record: validPortfolioEnvelope(),
      dependencies: {},
    };
    const result = validateImportFile(JSON.stringify(file));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.validRecordsByType.portfolio).toHaveLength(1);
  });

  it('handles a fresh-install export whose records map is entirely empty', () => {
    const file = { ...validFullBackupFile(), records: {} };
    const result = validateImportFile(JSON.stringify(file));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.validRecordsByType).toEqual({});
  });

  it('excludes a record smuggling a sensitive field inside a loose nested object (M8-051), keeping the rest of the file valid', () => {
    const file = validFullBackupFile();
    file.records = {
      portfolio: file.records.portfolio,
      loopStrategy: [loopStrategyEnvelopeWithSensitiveField()],
    } as never;

    const result = validateImportFile(JSON.stringify(file));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.validRecordsByType.portfolio).toHaveLength(1);
    expect(result.data.validRecordsByType.loopStrategy).toBeUndefined();
    expect(result.data.issues.some((issue) => issue.message.includes('prohibited field'))).toBe(
      true,
    );
  });

  /**
   * 06_TASKS.md M8-059's "Unsupported future version" — a record whose
   * `storageSchemaVersion` is newer than this build's `STORAGE_SCHEMA_VERSION`
   * is excluded with its own `UNSUPPORTED_SCHEMA_VERSION` issue code, not
   * lumped into the generic `INVALID_RECORD` a payload-shape failure gets
   * (`ImportValidator.ts`'s own header comment explains why this
   * distinction matters and how it's derived).
   *
   * M8-059's "Old supported version" counterpart is not exercised here:
   * `STORAGE_SCHEMA_VERSION` has never had a second version
   * (`services/persistence/migrations/migrate.ts`'s own header comment —
   * `REGISTERED_MIGRATIONS` is still empty in production), so there is no
   * real older version to migrate an imported record *from* yet. The
   * chain-walking migration mechanism this same code path would use is
   * already proven generically by `tests/unit/services/persistence/migrate.test.ts`'s
   * synthetic multi-step chain.
   */
  it('excludes a record with an unsupported future schema version, tagged UNSUPPORTED_SCHEMA_VERSION, keeping the rest of the file valid', () => {
    const file = validFullBackupFile();
    const fromTheFuture = {
      ...validPortfolioEnvelope('portfolio-3'),
      storageSchemaVersion: '99.0.0',
    };
    file.records.portfolio = [...file.records.portfolio, fromTheFuture as never];

    const result = validateImportFile(JSON.stringify(file));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.validRecordsByType.portfolio).toHaveLength(1);
    expect(result.data.validRecordsByType.portfolio?.[0]?.recordId).toBe('portfolio-1');
    expect(
      result.data.issues.some(
        (issue) => issue.code === 'UNSUPPORTED_SCHEMA_VERSION' && issue.recordId === 'portfolio-3',
      ),
    ).toBe(true);
  });
});

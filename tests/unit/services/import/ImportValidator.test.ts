import { describe, expect, it } from 'vitest';

import { validateImportFile } from '@/services/import/ImportValidator';
import { APP_NAME, APP_VERSION, STORAGE_SCHEMA_VERSION } from '@/services/persistence';

function validPortfolioEnvelope(id = 'portfolio-1') {
  return {
    app: APP_NAME,
    storageSchemaVersion: STORAGE_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    recordType: 'portfolio' as const,
    recordId: id,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    checksum: 'abcd1234',
    payload: {
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
    },
  };
}

function loopStrategyEnvelopeWithSensitiveField() {
  return {
    app: APP_NAME,
    storageSchemaVersion: STORAGE_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    recordType: 'loopStrategy' as const,
    recordId: 'strategy-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    checksum: 'abcd1234',
    payload: {
      id: 'strategy-1',
      name: 'Strategy',
      portfolioId: 'portfolio-1',
      portfolioUpdatedAt: '2026-01-01T00:00:00.000Z',
      settings: {},
      result: { steps: [], wallet: { privateKey: '0xabc123' } },
      warnings: [],
      metadata: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
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
});

import { describe, expect, it } from 'vitest';

import {
  buildFullBackupFile,
  buildSingleRecordExportFile,
  serializeExportFile,
} from '@/services/export/JsonExporter';
import { createMemoryAdapter } from '@/services/persistence/adapters';
import { createPersistenceService } from '@/services/persistence/persistence.service';
import type { PersistedPreferences } from '@/services/persistence/types';
import type { Portfolio } from '@/types/portfolio';

function samplePortfolio(id = 'portfolio-1'): Portfolio {
  return {
    id,
    name: 'My Portfolio',
    baseCurrency: 'USD',
    collateral: { asset: 'BTC', quantity: 2 },
    debt: { asset: 'USDC', balance: 20000 },
    market: { btcPriceUsd: 50000 },
    protocol: { maxLoanToValue: 0.75, liquidationThreshold: 0.8, borrowApr: 0.05, supplyApr: 0.02 },
    settings: {},
    archivedAt: null,
    marketUpdatedAt: '2026-01-01T00:00:00.000Z',
    protocolUpdatedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

const now = () => '2026-03-15T12:00:00.000Z';

describe('buildFullBackupFile', () => {
  it('includes every populated record type', async () => {
    const service = createPersistenceService(createMemoryAdapter());
    await service.write('portfolio', 'portfolio-1', samplePortfolio());
    const preferences: PersistedPreferences = { developerModeEnabled: true };
    await service.write('preferences', 'singleton', preferences);

    const result = await buildFullBackupFile({ service, now });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.kind).toBe('full-backup');
    expect(result.data.records.portfolio?.[0]?.recordId).toBe('portfolio-1');
    expect(result.data.records.preferences?.[0]?.payload).toEqual(preferences);
  });

  it('omits record types with no saved records', async () => {
    const service = createPersistenceService(createMemoryAdapter());
    await service.write('portfolio', 'portfolio-1', samplePortfolio());

    const result = await buildFullBackupFile({ service, now });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.records.loopStrategy).toBeUndefined();
    expect(result.data.records.exitPlan).toBeUndefined();
  });

  it('preserves the real envelope timestamps and checksum, not export-time values', async () => {
    const service = createPersistenceService(createMemoryAdapter());
    const written = await service.write('portfolio', 'portfolio-1', samplePortfolio());
    expect(written.ok).toBe(true);
    if (!written.ok) return;

    const result = await buildFullBackupFile({ service, now });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const envelope = result.data.records.portfolio?.[0];
    expect(envelope?.createdAt).toBe(written.data.createdAt);
    expect(envelope?.updatedAt).toBe(written.data.updatedAt);
    expect(envelope?.checksum).toBe(written.data.checksum);
  });

  it('produces an empty records map for a fresh install', async () => {
    const service = createPersistenceService(createMemoryAdapter());
    const result = await buildFullBackupFile({ service, now });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.records).toEqual({});
  });
});

describe('buildSingleRecordExportFile', () => {
  it('exports a portfolio record with no dependencies', async () => {
    const service = createPersistenceService(createMemoryAdapter());
    await service.write('portfolio', 'portfolio-1', samplePortfolio());

    const result = await buildSingleRecordExportFile('portfolio', 'portfolio-1', { service, now });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.kind).toBe('single-record');
    expect(result.data.recordType).toBe('portfolio');
    expect(result.data.record.recordId).toBe('portfolio-1');
    expect(result.data.dependencies).toEqual({});
  });

  function sampleStrategyPayload(portfolioId: string) {
    return {
      id: 'strategy-1',
      name: 'Strategy',
      portfolioId,
      portfolioUpdatedAt: '2026-01-01T00:00:00.000Z',
      settings: { targetLeverage: 2 },
      result: { steps: [] },
      warnings: [],
      metadata: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
  }

  it('bundles the source portfolio for a strategy-shaped record with a portfolioId field', async () => {
    const service = createPersistenceService(createMemoryAdapter());
    await service.write('portfolio', 'portfolio-1', samplePortfolio());
    await service.write('loopStrategy', 'strategy-1', sampleStrategyPayload('portfolio-1'));

    const result = await buildSingleRecordExportFile('loopStrategy', 'strategy-1', {
      service,
      now,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.dependencies.portfolio?.[0]?.recordId).toBe('portfolio-1');
  });

  it('leaves dependencies empty when the referenced portfolio no longer exists', async () => {
    const service = createPersistenceService(createMemoryAdapter());
    await service.write('loopStrategy', 'strategy-1', sampleStrategyPayload('missing-portfolio'));

    const result = await buildSingleRecordExportFile('loopStrategy', 'strategy-1', {
      service,
      now,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.dependencies).toEqual({});
  });

  it('leaves dependencies empty when the payload has no portfolioId field', async () => {
    const service = createPersistenceService(createMemoryAdapter());
    const preferences: PersistedPreferences = { developerModeEnabled: true };
    await service.write('preferences', 'singleton', preferences);

    const result = await buildSingleRecordExportFile('preferences', 'singleton', { service, now });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.dependencies).toEqual({});
  });

  it('fails when the requested record does not exist', async () => {
    const service = createPersistenceService(createMemoryAdapter());
    const result = await buildSingleRecordExportFile('portfolio', 'missing', { service, now });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]?.code).toBe('EXPORT_RECORD_NOT_FOUND');
  });
});

describe('serializeExportFile', () => {
  it('round trips through JSON.parse without losing data', async () => {
    const service = createPersistenceService(createMemoryAdapter());
    await service.write('portfolio', 'portfolio-1', samplePortfolio());
    const result = await buildFullBackupFile({ service, now });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const serialized = serializeExportFile(result.data);
    expect(JSON.parse(serialized)).toEqual(result.data);
  });
});

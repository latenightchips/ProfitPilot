import { describe, expect, it } from 'vitest';

import { exportFullBackup } from '@/services/export/ExportService';
import { applyValidatedImport, previewImport } from '@/services/import/ImportService';
import { createMemoryAdapter } from '@/services/persistence/adapters';
import { computeChecksum } from '@/services/persistence/envelope';
import { createPersistenceService } from '@/services/persistence/persistence.service';
import type { Portfolio } from '@/types/portfolio';

function samplePortfolio(): Portfolio {
  return {
    id: 'portfolio-1',
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

describe('export → import round trip', () => {
  it('a full backup exported from one instance imports cleanly into a fresh instance', async () => {
    const source = createPersistenceService(createMemoryAdapter());
    await source.write('portfolio', 'portfolio-1', samplePortfolio());

    const exported = await exportFullBackup({ service: source });
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;

    const destination = createPersistenceService(createMemoryAdapter());
    const previewResult = await previewImport(exported.data.content, 'addAsNew', {
      service: destination,
    });
    expect(previewResult.ok).toBe(true);
    if (!previewResult.ok) return;
    expect(previewResult.data.preview.counts.portfolio).toBe(1);

    const applyResult = await applyValidatedImport(previewResult.data.validation, 'addAsNew', {
      service: destination,
    });
    expect(applyResult.ok).toBe(true);
    if (!applyResult.ok) return;
    expect(applyResult.data.written).toHaveLength(1);

    const list = await destination.list<Portfolio>('portfolio');
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.data).toHaveLength(1);
    expect(list.data[0]?.name).toBe('My Portfolio');
  });

  it('a record with a smuggled sensitive field is never persisted, and therefore never reappears in a later export (M8-051)', async () => {
    const destination = createPersistenceService(createMemoryAdapter());
    const maliciousPayload = {
      id: 'strategy-1',
      name: 'Strategy',
      portfolioId: 'portfolio-1',
      portfolioUpdatedAt: '2026-01-01T00:00:00.000Z',
      settings: {},
      result: { steps: [], apiSecret: 'sk_live_abc123' },
      warnings: [],
      metadata: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const maliciousFile = {
      app: 'ProfitPilot',
      storageSchemaVersion: '1.0.0',
      appVersion: '0.1.0',
      exportedAt: '2026-03-15T12:00:00.000Z',
      kind: 'full-backup',
      records: {
        loopStrategy: [
          {
            app: 'ProfitPilot',
            storageSchemaVersion: '1.0.0',
            appVersion: '0.1.0',
            recordType: 'loopStrategy',
            recordId: 'strategy-1',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
            // A real checksum (M9-032) — this record must be rejected
            // for its smuggled sensitive field specifically, not
            // incidentally also fail a checksum check, so this test
            // keeps proving what its own name claims.
            checksum: computeChecksum(maliciousPayload),
            payload: maliciousPayload,
          },
        ],
      },
    };

    const previewResult = await previewImport(JSON.stringify(maliciousFile), 'addAsNew', {
      service: destination,
    });
    expect(previewResult.ok).toBe(true);
    if (!previewResult.ok) return;
    expect(previewResult.data.preview.counts.loopStrategy).toBeUndefined();

    const applyResult = await applyValidatedImport(previewResult.data.validation, 'addAsNew', {
      service: destination,
    });
    expect(applyResult.ok).toBe(true);
    if (!applyResult.ok) return;
    expect(applyResult.data.written).toHaveLength(0);

    const reExported = await exportFullBackup({ service: destination });
    expect(reExported.ok).toBe(true);
    if (!reExported.ok) return;
    expect(reExported.data.content).not.toContain('apiSecret');
    expect(reExported.data.content).not.toContain('sk_live_abc123');
  });
});

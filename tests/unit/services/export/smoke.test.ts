import { describe, expect, it } from 'vitest';

import { exportFullBackup } from '@/services/export/ExportService';
import { applyValidatedImport, previewImport } from '@/services/import/ImportService';
import { createMemoryAdapter } from '@/services/persistence/adapters';
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
});

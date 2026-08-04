import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  exportCsv,
  exportFullBackup,
  exportSingleRecord,
  triggerDownload,
} from '@/services/export/ExportService';
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

const now = () => new Date('2026-03-15T12:00:00.000Z');

describe('exportFullBackup', () => {
  it('returns a JSON ExportResult with a full-backup filename', async () => {
    const service = createPersistenceService(createMemoryAdapter());
    await service.write('portfolio', 'portfolio-1', samplePortfolio());

    const result = await exportFullBackup({ service, now });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.mimeType).toBe('application/json');
    expect(result.data.filename).toContain('full-backup');
    expect(JSON.parse(result.data.content).records.portfolio).toHaveLength(1);
  });
});

describe('exportSingleRecord', () => {
  it('returns a JSON ExportResult named after the record type', async () => {
    const service = createPersistenceService(createMemoryAdapter());
    await service.write('portfolio', 'portfolio-1', samplePortfolio());

    const result = await exportSingleRecord('portfolio', 'portfolio-1', 'My Portfolio', {
      service,
      now,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.filename).toContain('portfolio');
    expect(result.data.filename).toContain('My-Portfolio');
  });

  it('propagates a not-found failure from JsonExporter', async () => {
    const service = createPersistenceService(createMemoryAdapter());
    const result = await exportSingleRecord('portfolio', 'missing', undefined, { service, now });
    expect(result.ok).toBe(false);
  });
});

describe('exportCsv', () => {
  it('exports portfolio-positions as CSV', async () => {
    const service = createPersistenceService(createMemoryAdapter());
    await service.write('portfolio', 'portfolio-1', samplePortfolio());

    const result = await exportCsv('portfolio-positions', { service, now });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.mimeType).toBe('text/csv');
    expect(result.data.content).toContain('portfolio-1');
  });

  it('exports scenario-comparisons as CSV, empty dataset produces header only', async () => {
    const service = createPersistenceService(createMemoryAdapter());
    const result = await exportCsv('scenario-comparisons', { service, now });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.content.split('\n')).toHaveLength(1);
  });

  it('exports loop-steps as CSV, empty dataset produces header only', async () => {
    const service = createPersistenceService(createMemoryAdapter());
    const result = await exportCsv('loop-steps', { service, now });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.content.split('\n')).toHaveLength(1);
  });

  it('exports exit-plan-breakdowns as CSV, empty dataset produces header only', async () => {
    const service = createPersistenceService(createMemoryAdapter());
    const result = await exportCsv('exit-plan-breakdowns', { service, now });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.content.split('\n')).toHaveLength(1);
  });
});

describe('triggerDownload', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('creates a Blob URL, clicks a temporary anchor, and revokes the URL', () => {
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:mock-url');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });

    const click = vi.fn();
    const realCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = realCreateElement(tagName);
      if (tagName === 'a') element.click = click;
      return element;
    });

    triggerDownload({ filename: 'test.json', content: '{}', mimeType: 'application/json' });

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });
});

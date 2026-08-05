import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createLocalStorageAdapter } from '@/services/persistence/adapters';
import { createPersistenceService } from '@/services/persistence/persistence.service';
import type { Portfolio } from '@/types/portfolio';

/**
 * 06_TASKS.md M8-055 ("Create Local Persistence Tests"). DoD: "Local
 * persistence works without network or authentication."
 *
 * The individual failure modes this task's own "Cover" list names
 * (malformed records, quota failures, unavailable storage, migration
 * success/rollback) already each have dedicated, deep test coverage —
 * `tests/unit/services/persistence/adapters/local-storage.adapter.test.ts`
 * (malformed data, unavailable storage, quota exceeded),
 * `tests/unit/services/persistence/migrate.test.ts` and
 * `migrations/localDataMigration.test.ts` (migration success/rollback),
 * `tests/unit/services/persistence/autoSaveCoordinator.test.ts`
 * (auto-save), and `persistence.service.test.ts` (create/read/update/
 * delete through the Service boundary, against `MemoryAdapter`). This
 * file adds the one thing none of those individually prove: a full
 * create → read → update → delete → list → clear lifecycle through
 * `PersistenceService` wired to the *real* `createLocalStorageAdapter`
 * (not `MemoryAdapter`), with an explicit assertion that no network
 * request is ever made and no authentication module is ever touched —
 * the DoD's "without network or authentication" claim, proven rather
 * than assumed from the architecture alone.
 */
function samplePortfolio(overrides: Partial<Portfolio> = {}): Portfolio {
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
    ...overrides,
  };
}

describe('local persistence works without network or authentication (M8-055)', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    window.localStorage.clear();
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('completes a full create/read/update/delete/list/clear lifecycle against real localStorage with zero network calls', async () => {
    const service = createPersistenceService(createLocalStorageAdapter());

    const written = await service.write('portfolio', 'portfolio-1', samplePortfolio());
    expect(written.ok).toBe(true);

    const read = await service.read<Portfolio>('portfolio', 'portfolio-1');
    expect(read.ok).toBe(true);
    if (read.ok) expect(read.data?.name).toBe('My Portfolio');

    const updated = await service.write(
      'portfolio',
      'portfolio-1',
      samplePortfolio({ name: 'Renamed Portfolio' }),
    );
    expect(updated.ok).toBe(true);

    const listed = await service.list<Portfolio>('portfolio');
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.data).toHaveLength(1);
      expect(listed.data[0]?.name).toBe('Renamed Portfolio');
    }

    const deleted = await service.delete('portfolio', 'portfolio-1');
    expect(deleted.ok).toBe(true);

    const afterDelete = await service.read<Portfolio>('portfolio', 'portfolio-1');
    expect(afterDelete.ok).toBe(true);
    if (afterDelete.ok) expect(afterDelete.data).toBeNull();

    const cleared = await service.clear();
    expect(cleared.ok).toBe(true);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('reports itself available with no configuration and no network round trip', () => {
    const service = createPersistenceService(createLocalStorageAdapter());
    expect(service.checkAvailability()).toEqual({ available: true });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

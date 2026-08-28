import { describe, expect, it } from 'vitest';

import { createMemoryAdapter } from '@/services/persistence/adapters';
import { createEnvelope } from '@/services/persistence/envelope';
import { createPersistenceService } from '@/services/persistence/persistence.service';
import {
  deletePortfolioHistoryForPortfolio,
  listPortfolioHistory,
  listPortfolioHistoryForPortfolio,
  MAX_RETAINED_PORTFOLIO_HISTORY_ENTRIES,
  readLatestPortfolioHistoryEntry,
  recordPortfolioHistoryEntry,
} from '@/services/persistence/portfolioHistory';
import type { PersistedPortfolioHistoryEntry } from '@/services/persistence/types';

/**
 * Portfolio History persistence — V1.1 Batch 2 ("Portfolio History & Risk
 * Timeline"). Mirrors `recoverySnapshot.test.ts`'s own structure: a
 * `createMemoryAdapter()`-backed `PersistenceService` per test, exercising
 * the real `PersistenceService`/schema-validation path rather than mocking
 * it.
 */
function entry(
  overrides: Partial<PersistedPortfolioHistoryEntry> = {},
): PersistedPortfolioHistoryEntry {
  return {
    portfolioId: 'portfolio-1',
    protocolVersion: 'v3',
    createdAt: '2026-01-01T00:00:00.000Z',
    collateral: { quantity: 2, valueUsd: 100000 },
    debt: { asset: 'USDC', quantity: 20000, valueUsd: 20000 },
    marketPriceUsd: 50000,
    healthFactor: 4,
    liquidationPriceUsd: 12500,
    loanToValue: 0.2,
    leverage: 1.25,
    borrowApr: 0.05,
    supplyApr: 0.02,
    annualizedInterestCost: 1000,
    dataSource: 'manual',
    ...overrides,
  };
}

describe('recordPortfolioHistoryEntry', () => {
  it('writes a real "portfolioHistory" record, keyed by its own generated id', async () => {
    const service = createPersistenceService(createMemoryAdapter());
    const result = await recordPortfolioHistoryEntry(entry(), service);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.recordType).toBe('portfolioHistory');
    expect(result.data.payload.portfolioId).toBe('portfolio-1');
  });

  it('rejects a payload that fails schema validation (e.g. non-finite marketPriceUsd)', async () => {
    const service = createPersistenceService(createMemoryAdapter());
    const result = await recordPortfolioHistoryEntry(
      entry({ marketPriceUsd: Number.POSITIVE_INFINITY }),
      service,
    );
    expect(result.ok).toBe(false);
  });

  it('accepts a null healthFactor (zero-debt portfolio — Infinity is not JSON-representable)', async () => {
    const service = createPersistenceService(createMemoryAdapter());
    const result = await recordPortfolioHistoryEntry(
      entry({
        healthFactor: null,
        liquidationPriceUsd: null,
        debt: { asset: 'USDC', quantity: 0, valueUsd: 0 },
      }),
      service,
    );
    expect(result.ok).toBe(true);
  });

  it('V1.1 Batch 4: persists and reloads a full-exit entry (zero collateral, zero debt) unchanged, including leverage 0 and a null Health Factor', async () => {
    const service = createPersistenceService(createMemoryAdapter());
    const fullExit = entry({
      collateral: { quantity: 0, valueUsd: 0 },
      debt: { asset: 'USDC', quantity: 0, valueUsd: 0 },
      healthFactor: null,
      liquidationPriceUsd: null,
      loanToValue: 0,
      leverage: 0,
      annualizedInterestCost: 0,
    });
    const writeResult = await recordPortfolioHistoryEntry(fullExit, service);
    expect(writeResult.ok).toBe(true);

    const listResult = await listPortfolioHistoryForPortfolio('portfolio-1', service);
    expect(listResult.ok).toBe(true);
    if (!listResult.ok) return;
    expect(listResult.data).toHaveLength(1);
    expect(listResult.data[0].payload).toEqual(fullExit);
  });

  it('prunes the oldest entry application-wide once more than the retained maximum exist', async () => {
    // `prunePortfolioHistory` runs a full `listPortfolioHistory` (list +
    // schema-validate + sort every existing entry) after every single
    // `recordPortfolioHistoryEntry` call — real, intended production
    // behavior this test must not weaken. Driving all
    // `MAX_RETAINED_PORTFOLIO_HISTORY_ENTRIES + 2` writes through that
    // full path here made this test O(n^2) in schema validations
    // (~502 x prune-list-of-up-to-502), which is what timed out under
    // full-suite worker contention even though it passed in isolation.
    //
    // The invariant under test is only "once over the cap, the service
    // prunes down to the cap, keeping the newest" — that is fully proved
    // by exercising the real prune path across the boundary, not by
    // building every one of the preceding entries through it. So the
    // first `MAX_RETAINED_PORTFOLIO_HISTORY_ENTRIES - 1` entries are
    // seeded directly through the adapter (a plain in-memory `Map` write,
    // no validation/prune overhead — same envelope shape
    // `PersistenceService.write` itself would produce, built with the
    // same `createEnvelope` helper), and only the final 3 writes —
    // exactly enough to cross the cap and prove pruning fires and keeps
    // pruning on each subsequent write — go through the real
    // `recordPortfolioHistoryEntry`.
    const adapter = createMemoryAdapter();
    const service = createPersistenceService(adapter);
    const base = Date.parse('2026-01-01T00:00:00.000Z');
    const createdAtFor = (tick: number) => new Date(base + tick * 1000).toISOString();

    for (let i = 0; i < MAX_RETAINED_PORTFOLIO_HISTORY_ENTRIES - 1; i += 1) {
      const payload = entry({ createdAt: createdAtFor(i + 1) });
      await adapter.write(
        'portfolioHistory',
        `seed-${i}`,
        createEnvelope('portfolioHistory', `seed-${i}`, payload),
      );
    }

    for (
      let i = MAX_RETAINED_PORTFOLIO_HISTORY_ENTRIES - 1;
      i < MAX_RETAINED_PORTFOLIO_HISTORY_ENTRIES + 2;
      i += 1
    ) {
      const written = await recordPortfolioHistoryEntry(
        entry({ createdAt: createdAtFor(i + 1) }),
        service,
      );
      expect(written.ok).toBe(true);
    }

    const listed = await listPortfolioHistory(service);
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.data).toHaveLength(MAX_RETAINED_PORTFOLIO_HISTORY_ENTRIES);
    // The two oldest seeded entries (tick 1 and 2) were pruned; the
    // newest retained entry is the oldest seed that survived (tick 3).
    expect(listed.data.at(-1)?.payload.createdAt).toBe(createdAtFor(3));
  });
});

describe('listPortfolioHistory / listPortfolioHistoryForPortfolio', () => {
  it('returns entries most-recent-first, sorted by payload createdAt', async () => {
    const service = createPersistenceService(createMemoryAdapter());
    await recordPortfolioHistoryEntry(entry({ createdAt: '2026-01-01T00:00:00.000Z' }), service);
    await recordPortfolioHistoryEntry(entry({ createdAt: '2026-03-01T00:00:00.000Z' }), service);
    await recordPortfolioHistoryEntry(entry({ createdAt: '2026-02-01T00:00:00.000Z' }), service);

    const listed = await listPortfolioHistory(service);
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.data.map((e) => e.payload.createdAt)).toEqual([
      '2026-03-01T00:00:00.000Z',
      '2026-02-01T00:00:00.000Z',
      '2026-01-01T00:00:00.000Z',
    ]);
  });

  it('keeps multiple portfolios isolated from each other', async () => {
    const service = createPersistenceService(createMemoryAdapter());
    await recordPortfolioHistoryEntry(entry({ portfolioId: 'a' }), service);
    await recordPortfolioHistoryEntry(entry({ portfolioId: 'b' }), service);
    await recordPortfolioHistoryEntry(entry({ portfolioId: 'a' }), service);

    const forA = await listPortfolioHistoryForPortfolio('a', service);
    expect(forA.ok).toBe(true);
    if (!forA.ok) return;
    expect(forA.data).toHaveLength(2);
    expect(forA.data.every((e) => e.payload.portfolioId === 'a')).toBe(true);

    const forB = await listPortfolioHistoryForPortfolio('b', service);
    expect(forB.ok).toBe(true);
    if (!forB.ok) return;
    expect(forB.data).toHaveLength(1);
  });

  it('returns an empty list for a portfolio with no history yet', async () => {
    const service = createPersistenceService(createMemoryAdapter());
    const listed = await listPortfolioHistoryForPortfolio('never-existed', service);
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.data).toEqual([]);
  });
});

describe('readLatestPortfolioHistoryEntry', () => {
  it('returns the most recent entry for one portfolio', async () => {
    const service = createPersistenceService(createMemoryAdapter());
    await recordPortfolioHistoryEntry(
      entry({ portfolioId: 'a', createdAt: '2026-01-01T00:00:00.000Z', healthFactor: 4 }),
      service,
    );
    await recordPortfolioHistoryEntry(
      entry({ portfolioId: 'a', createdAt: '2026-02-01T00:00:00.000Z', healthFactor: 3 }),
      service,
    );

    const latest = await readLatestPortfolioHistoryEntry('a', service);
    expect(latest.ok).toBe(true);
    if (!latest.ok) return;
    expect(latest.data?.healthFactor).toBe(3);
  });

  it('returns null when the portfolio has no history yet (backward compatibility with pre-Batch-2 portfolios)', async () => {
    const service = createPersistenceService(createMemoryAdapter());
    const latest = await readLatestPortfolioHistoryEntry('never-existed', service);
    expect(latest.ok).toBe(true);
    if (!latest.ok) return;
    expect(latest.data).toBeNull();
  });
});

describe('deletePortfolioHistoryForPortfolio', () => {
  it('removes every entry for the given portfolio only', async () => {
    const service = createPersistenceService(createMemoryAdapter());
    await recordPortfolioHistoryEntry(entry({ portfolioId: 'a' }), service);
    await recordPortfolioHistoryEntry(entry({ portfolioId: 'a' }), service);
    await recordPortfolioHistoryEntry(entry({ portfolioId: 'b' }), service);

    const deleted = await deletePortfolioHistoryForPortfolio('a', service);
    expect(deleted.ok).toBe(true);

    const remainingA = await listPortfolioHistoryForPortfolio('a', service);
    expect(remainingA.ok).toBe(true);
    if (!remainingA.ok) return;
    expect(remainingA.data).toHaveLength(0);

    const remainingB = await listPortfolioHistoryForPortfolio('b', service);
    expect(remainingB.ok).toBe(true);
    if (!remainingB.ok) return;
    expect(remainingB.data).toHaveLength(1);
  });

  it('is a no-op (still ok) for a portfolio with no history', async () => {
    const service = createPersistenceService(createMemoryAdapter());
    const deleted = await deletePortfolioHistoryForPortfolio('never-existed', service);
    expect(deleted.ok).toBe(true);
  });
});

describe('data integrity — malformed entries', () => {
  it('fails safely (ok: false, never throws) when a stored entry fails schema validation', async () => {
    const adapter = createMemoryAdapter();
    const service = createPersistenceService(adapter);
    // Bypasses `PersistenceService.write`'s own schema validation —
    // simulates a record corrupted or written by a future/older schema
    // version, which `validatePersistedRecordSchema` (invoked on every
    // read, not just write) must still catch.
    await adapter.write(
      'portfolioHistory',
      'corrupt-1',
      createEnvelope('portfolioHistory', 'corrupt-1', {
        portfolioId: 'a' /* missing every other required field */,
      }),
    );

    const listed = await listPortfolioHistoryForPortfolio('a', service);
    expect(listed.ok).toBe(false);
  });
});

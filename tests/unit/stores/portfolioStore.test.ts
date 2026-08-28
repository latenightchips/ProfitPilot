import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  autoSaveCoordinator,
  calculatePortfolioSummary,
  type PortfolioApplyProposal,
} from '@/services';
import { buildLocalStorageKey } from '@/services/persistence/adapters/localStorageKeys';
import { computeChecksum } from '@/services/persistence/envelope';
import { listPortfolioHistoryForPortfolio } from '@/services/persistence/portfolioHistory';
import { usePortfolioStore } from '@/stores/portfolioStore';
import type { Portfolio } from '@/types/portfolio';

/**
 * Portfolio Store — 06_TASKS.md M4-003.
 *
 * `usePortfolioStore` is a module-level Zustand singleton, so every test
 * resets it to its own initial state first — otherwise state would leak
 * between tests in this file.
 */
const INITIAL_STATE = {
  portfolios: {},
  activePortfolioId: null,
  loadStatus: 'idle' as const,
  saveStatus: 'idle' as const,
  errors: [],
  lastSynchronizedAt: null,
};

beforeEach(() => {
  // Merge, not replace — replacing would also wipe the store's action
  // functions, which live on the same state object.
  usePortfolioStore.setState(INITIAL_STATE);
  window.localStorage.clear();
});

function validInput(overrides: Record<string, unknown> = {}) {
  return {
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
    ...overrides,
  };
}

describe('usePortfolioStore.create (M4-003)', () => {
  it('creates a portfolio, assigns identity/timestamps, and computes its summary', () => {
    const result = usePortfolioStore.getState().create(validInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.id).toEqual(expect.any(String));
    expect(result.data.name).toBe('My Portfolio');
    expect(result.data.archivedAt).toBeNull();
    expect(result.data.createdAt).toBe(result.data.updatedAt);

    const state = usePortfolioStore.getState();
    const record = state.portfolios[result.data.id];
    expect(record).toBeDefined();
    expect(record.summary.ok).toBe(true);
    if (!record.summary.ok) return;
    expect(record.summary.data.netEquity).toBe(80000);
  });

  it('rejects invalid input without adding a portfolio (M4-002 DoD)', () => {
    const invalid = { ...validInput(), name: '' };
    const result = usePortfolioStore.getState().create(invalid);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.every((error) => error.category === 'validation')).toBe(true);
    expect(Object.keys(usePortfolioStore.getState().portfolios)).toHaveLength(0);
    expect(usePortfolioStore.getState().errors).toEqual(result.errors);
  });

  it('computes a null liquidation summary for a zero-debt portfolio (conflict #20 stays resolved end to end)', () => {
    const input = { ...validInput(), debt: { asset: 'USDC', balance: 0 } };
    const result = usePortfolioStore.getState().create(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const record = usePortfolioStore.getState().portfolios[result.data.id];
    expect(record.summary.ok).toBe(true);
    if (!record.summary.ok) return;
    expect(record.summary.data.liquidation).toBeNull();
    expect(record.summary.data.healthFactor).toBe(Infinity);
  });

  it('generates a different id for each created portfolio', () => {
    const first = usePortfolioStore.getState().create(validInput());
    const second = usePortfolioStore.getState().create(validInput());
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.data.id).not.toBe(second.data.id);
  });
});

describe('usePortfolioStore.update (M4-003)', () => {
  function createValid() {
    const result = usePortfolioStore.getState().create(validInput());
    if (!result.ok) throw new Error('setup failed');
    return result.data;
  }

  it('merges a partial update and recomputes the summary', () => {
    const created = createValid();
    const result = usePortfolioStore.getState().update(created.id, { name: 'Renamed' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.name).toBe('Renamed');
    expect(result.data.collateral).toEqual(created.collateral);
    expect(result.data.createdAt).toBe(created.createdAt);
  });

  it('re-validates the merged result, rejecting an update that breaks the protocol invariant', () => {
    const created = createValid();
    const result = usePortfolioStore.getState().update(created.id, {
      protocol: {
        maxLoanToValue: 0.9,
        liquidationThreshold: 0.8,
        borrowApr: 0.05,
        supplyApr: 0.02,
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    // The original portfolio is untouched by the rejected update.
    expect(usePortfolioStore.getState().portfolios[created.id].portfolio.protocol).toEqual(
      created.protocol,
    );
  });

  it('reports a not-found error for an unknown id', () => {
    const result = usePortfolioStore.getState().update('missing-id', { name: 'X' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatchObject({ code: 'PORTFOLIO_NOT_FOUND' });
  });
});

describe('usePortfolioStore.create — marketUpdatedAt/protocolUpdatedAt (M4-014/M4-015)', () => {
  it('sets both timestamps to the creation time', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    expect(created.data.marketUpdatedAt).toBe(created.data.createdAt);
    expect(created.data.protocolUpdatedAt).toBe(created.data.createdAt);
  });
});

describe('usePortfolioStore.update — marketUpdatedAt/protocolUpdatedAt (M4-014/M4-015)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('bumps marketUpdatedAt when the price actually changes, and leaves protocolUpdatedAt alone', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');

    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.parse(created.data.marketUpdatedAt) + 60_000));
    const result = usePortfolioStore
      .getState()
      .update(created.data.id, { market: { btcPriceUsd: created.data.market.btcPriceUsd + 1000 } });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.marketUpdatedAt).not.toBe(created.data.marketUpdatedAt);
    expect(result.data.protocolUpdatedAt).toBe(created.data.protocolUpdatedAt);
  });

  it('bumps protocolUpdatedAt when a protocol field actually changes, and leaves marketUpdatedAt alone', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');

    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.parse(created.data.protocolUpdatedAt) + 60_000));
    const result = usePortfolioStore.getState().update(created.data.id, {
      protocol: { ...created.data.protocol, borrowApr: created.data.protocol.borrowApr + 0.01 },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.protocolUpdatedAt).not.toBe(created.data.protocolUpdatedAt);
    expect(result.data.marketUpdatedAt).toBe(created.data.marketUpdatedAt);
  });

  it('leaves both timestamps unchanged when neither market nor protocol is part of the update', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');

    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.parse(created.data.updatedAt) + 60_000));
    const result = usePortfolioStore.getState().update(created.data.id, { name: 'Renamed' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.marketUpdatedAt).toBe(created.data.marketUpdatedAt);
    expect(result.data.protocolUpdatedAt).toBe(created.data.protocolUpdatedAt);
  });

  it('does not bump marketUpdatedAt when the submitted price equals the current price', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');

    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.parse(created.data.marketUpdatedAt) + 60_000));
    const result = usePortfolioStore
      .getState()
      .update(created.data.id, { market: { btcPriceUsd: created.data.market.btcPriceUsd } });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.marketUpdatedAt).toBe(created.data.marketUpdatedAt);
  });
});

describe('usePortfolioStore.duplicate — marketUpdatedAt/protocolUpdatedAt (M4-014/M4-015)', () => {
  it('carries both timestamps over unchanged, since the copied values are unchanged', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    const result = usePortfolioStore.getState().duplicate(created.data.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.marketUpdatedAt).toBe(created.data.marketUpdatedAt);
    expect(result.data.protocolUpdatedAt).toBe(created.data.protocolUpdatedAt);
  });
});

describe('usePortfolioStore.select (M4-003)', () => {
  it('sets the active portfolio id', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);
    expect(usePortfolioStore.getState().activePortfolioId).toBe(created.data.id);
  });

  it('allows clearing the selection with null', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);
    usePortfolioStore.getState().select(null);
    expect(usePortfolioStore.getState().activePortfolioId).toBeNull();
  });

  it('records an error and leaves the selection unchanged for an unknown id', () => {
    usePortfolioStore.getState().select('missing-id');
    expect(usePortfolioStore.getState().activePortfolioId).toBeNull();
    expect(usePortfolioStore.getState().errors[0]).toMatchObject({ code: 'PORTFOLIO_NOT_FOUND' });
  });
});

describe('usePortfolioStore.duplicate (M4-003)', () => {
  it('creates an independent copy with a new identity and an appended name', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');

    const result = usePortfolioStore.getState().duplicate(created.data.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.id).not.toBe(created.data.id);
    expect(result.data.name).toBe('My Portfolio (Copy)');
    expect(result.data.collateral).toEqual(created.data.collateral);

    // Editing the duplicate does not affect the source.
    usePortfolioStore.getState().update(result.data.id, { name: 'Edited Copy' });
    expect(usePortfolioStore.getState().portfolios[created.data.id].portfolio.name).toBe(
      'My Portfolio',
    );
  });

  it('reports a not-found error for an unknown id', () => {
    const result = usePortfolioStore.getState().duplicate('missing-id');
    expect(result.ok).toBe(false);
  });
});

describe('usePortfolioStore.archive (M4-003, extended M4-012)', () => {
  it('sets archivedAt without removing the portfolio', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().archive(created.data.id);
    const record = usePortfolioStore.getState().portfolios[created.data.id];
    expect(record.portfolio.archivedAt).not.toBeNull();
  });

  it('clears activePortfolioId when archiving the active portfolio (M4-012: "Hide from active lists")', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);
    usePortfolioStore.getState().archive(created.data.id);
    expect(usePortfolioStore.getState().activePortfolioId).toBeNull();
  });

  it('leaves activePortfolioId unchanged when archiving a different portfolio', () => {
    const first = usePortfolioStore.getState().create(validInput());
    const second = usePortfolioStore.getState().create(validInput());
    if (!first.ok || !second.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(first.data.id);
    usePortfolioStore.getState().archive(second.data.id);
    expect(usePortfolioStore.getState().activePortfolioId).toBe(first.data.id);
  });

  it('reports a not-found error for an unknown id', () => {
    usePortfolioStore.getState().archive('missing-id');
    expect(usePortfolioStore.getState().errors[0]?.code).toBe('PORTFOLIO_NOT_FOUND');
  });
});

describe('usePortfolioStore.unarchive (M4-012)', () => {
  it('clears archivedAt, restoring the portfolio to the active list', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().archive(created.data.id);
    usePortfolioStore.getState().unarchive(created.data.id);
    const record = usePortfolioStore.getState().portfolios[created.data.id];
    expect(record.portfolio.archivedAt).toBeNull();
  });

  it('does not by itself restore activePortfolioId (archiving already cleared it)', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);
    usePortfolioStore.getState().archive(created.data.id);
    usePortfolioStore.getState().unarchive(created.data.id);
    expect(usePortfolioStore.getState().activePortfolioId).toBeNull();
  });

  it('reports a not-found error for an unknown id', () => {
    usePortfolioStore.getState().unarchive('missing-id');
    expect(usePortfolioStore.getState().errors[0]?.code).toBe('PORTFOLIO_NOT_FOUND');
  });
});

describe('usePortfolioStore.delete (M4-003)', () => {
  it('removes the portfolio from state', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().delete(created.data.id);
    expect(usePortfolioStore.getState().portfolios[created.data.id]).toBeUndefined();
  });

  it('clears activePortfolioId when deleting the active portfolio', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);
    usePortfolioStore.getState().delete(created.data.id);
    expect(usePortfolioStore.getState().activePortfolioId).toBeNull();
  });

  it('leaves activePortfolioId unchanged when deleting a different portfolio', () => {
    const first = usePortfolioStore.getState().create(validInput());
    const second = usePortfolioStore.getState().create(validInput());
    if (!first.ok || !second.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(first.data.id);
    usePortfolioStore.getState().delete(second.data.id);
    expect(usePortfolioStore.getState().activePortfolioId).toBe(first.data.id);
  });
});

describe('usePortfolioStore.load (M4-003, Conflict B, made real in M8-008)', () => {
  it('transitions loadStatus back to idle once hydration completes', async () => {
    await usePortfolioStore.getState().load();
    expect(usePortfolioStore.getState().loadStatus).toBe('idle');
  });

  it('leaves portfolios empty when local storage has nothing stored', async () => {
    await usePortfolioStore.getState().load();
    expect(usePortfolioStore.getState().portfolios).toEqual({});
  });

  it('restores a portfolio persisted through a genuine local storage round trip, surviving a simulated refresh', async () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    await autoSaveCoordinator.flushAll();

    // Simulates a page refresh: wipe in-memory state, then hydrate purely
    // from whatever `persistenceService`/local storage actually has.
    usePortfolioStore.setState(INITIAL_STATE);
    await usePortfolioStore.getState().load();

    const record = usePortfolioStore.getState().portfolios[created.data.id];
    expect(record).toBeDefined();
    expect(record.portfolio.name).toBe('My Portfolio');
    expect(record.summary.ok).toBe(true);
  });

  it('restores the active portfolio selection alongside the portfolio list', async () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);
    await autoSaveCoordinator.flushAll();

    usePortfolioStore.setState(INITIAL_STATE);
    await usePortfolioStore.getState().load();

    expect(usePortfolioStore.getState().activePortfolioId).toBe(created.data.id);
  });

  it('drops a stored active-selection id that no longer points to an existing portfolio', async () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);
    await autoSaveCoordinator.flushAll();
    usePortfolioStore.getState().delete(created.data.id);
    await autoSaveCoordinator.flushAll();

    usePortfolioStore.setState(INITIAL_STATE);
    await usePortfolioStore.getState().load();

    expect(usePortfolioStore.getState().activePortfolioId).toBeNull();
  });

  it('fails safely (loadStatus: error) when local storage holds corrupted data, without throwing', async () => {
    window.localStorage.setItem('profitpilot:v1:portfolio:corrupt', '{not valid json');

    await expect(usePortfolioStore.getState().load()).resolves.toBeUndefined();
    expect(usePortfolioStore.getState().loadStatus).toBe('error');
    expect(usePortfolioStore.getState().errors.length).toBeGreaterThan(0);
  });

  it('flushes any still-debounced write before reading, so load never clobbers an in-flight create with stale disk contents', async () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');

    // No manual flushAll here — `load()` itself must flush before reading.
    await usePortfolioStore.getState().load();

    expect(usePortfolioStore.getState().portfolios[created.data.id]).toBeDefined();
  });
});

describe('usePortfolioStore — lastSynchronizedAt honesty (M4-003, Conflict B)', () => {
  it('lastSynchronizedAt stays null after a successful create', () => {
    usePortfolioStore.getState().create(validInput());
    expect(usePortfolioStore.getState().lastSynchronizedAt).toBeNull();
  });
});

describe('usePortfolioStore — saveStatus transitions (M4-013, made real in M8-011)', () => {
  it('sets "saving" synchronously, then settles to "saved" once the debounced write lands', async () => {
    usePortfolioStore.getState().create(validInput());
    expect(usePortfolioStore.getState().saveStatus).toBe('saving');

    await autoSaveCoordinator.flushAll();
    expect(usePortfolioStore.getState().saveStatus).toBe('saved');
  });

  it('reports "error" after a create that fails validation, without ever scheduling a write', async () => {
    usePortfolioStore.getState().create({ name: '' });
    expect(usePortfolioStore.getState().saveStatus).toBe('error');

    await autoSaveCoordinator.flushAll();
    expect(usePortfolioStore.getState().saveStatus).toBe('error');
  });

  it('transitions through "saving" before settling — observable via direct subscription, not just the final getState()', async () => {
    const seen: string[] = [];
    const unsubscribe = usePortfolioStore.subscribe((state) => seen.push(state.saveStatus));
    usePortfolioStore.getState().create(validInput());
    await autoSaveCoordinator.flushAll();
    unsubscribe();
    expect(seen).toContain('saving');
    expect(seen[seen.length - 1]).toBe('saved');
  });

  it('reports "saved" after a successful update, and "error" after one that fails validation', async () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    await autoSaveCoordinator.flushAll();

    usePortfolioStore.getState().update(created.data.id, { name: 'Renamed' });
    await autoSaveCoordinator.flushAll();
    expect(usePortfolioStore.getState().saveStatus).toBe('saved');

    usePortfolioStore.getState().update(created.data.id, {
      protocol: {
        maxLoanToValue: 0.9,
        liquidationThreshold: 0.8,
        borrowApr: 0.05,
        supplyApr: 0.02,
      },
    });
    expect(usePortfolioStore.getState().saveStatus).toBe('error');
  });

  it('reports "error" for update/archive/unarchive/delete/duplicate on an unknown id', () => {
    usePortfolioStore.getState().update('missing-id', { name: 'X' });
    expect(usePortfolioStore.getState().saveStatus).toBe('error');
    usePortfolioStore.getState().archive('missing-id');
    expect(usePortfolioStore.getState().saveStatus).toBe('error');
    usePortfolioStore.getState().unarchive('missing-id');
    expect(usePortfolioStore.getState().saveStatus).toBe('error');
    usePortfolioStore.getState().delete('missing-id');
    expect(usePortfolioStore.getState().saveStatus).toBe('error');
    usePortfolioStore.getState().duplicate('missing-id');
    expect(usePortfolioStore.getState().saveStatus).toBe('error');
  });

  it('reports "saved" after a successful duplicate/archive/unarchive/delete', async () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    await autoSaveCoordinator.flushAll();

    const duplicated = usePortfolioStore.getState().duplicate(created.data.id);
    await autoSaveCoordinator.flushAll();
    expect(usePortfolioStore.getState().saveStatus).toBe('saved');
    if (!duplicated.ok) throw new Error('setup failed');

    usePortfolioStore.getState().archive(duplicated.data.id);
    await autoSaveCoordinator.flushAll();
    expect(usePortfolioStore.getState().saveStatus).toBe('saved');

    usePortfolioStore.getState().unarchive(duplicated.data.id);
    await autoSaveCoordinator.flushAll();
    expect(usePortfolioStore.getState().saveStatus).toBe('saved');

    usePortfolioStore.getState().delete(duplicated.data.id);
    await autoSaveCoordinator.flushAll();
    expect(usePortfolioStore.getState().saveStatus).toBe('idle');
  });

  it('never reaches "offline" — no network dependency exists to go offline from (conflict #28)', async () => {
    usePortfolioStore.getState().create(validInput());
    await autoSaveCoordinator.flushAll();
    expect(usePortfolioStore.getState().saveStatus).not.toBe('offline');
  });

  it('select never changes saveStatus — its own activePortfolio write is a separate, silently tracked record', async () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    await autoSaveCoordinator.flushAll();
    usePortfolioStore.setState({ saveStatus: 'idle' });

    usePortfolioStore.getState().select(created.data.id);
    await autoSaveCoordinator.flushAll();
    expect(usePortfolioStore.getState().saveStatus).toBe('idle');
  });

  it('load never changes saveStatus — hydrating is not saving', async () => {
    usePortfolioStore.setState({ saveStatus: 'idle' });
    await usePortfolioStore.getState().load();
    expect(usePortfolioStore.getState().saveStatus).toBe('idle');
  });
});

describe('usePortfolioStore — no stale-update window (M4-013 Requirement, verified not just assumed)', () => {
  it('two synchronous back-to-back updates always leave the later one in effect, never the earlier', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');

    usePortfolioStore.getState().update(created.data.id, { name: 'First' });
    usePortfolioStore.getState().update(created.data.id, { name: 'Second' });

    expect(usePortfolioStore.getState().portfolios[created.data.id].portfolio.name).toBe('Second');
  });
});

describe('usePortfolioStore — calculation failures are genuinely reachable via Zod-valid input (M4-017)', () => {
  it('caches a failed summary for zero collateral with nonzero debt (calculateLoanToValue divides by zero)', () => {
    const created = usePortfolioStore
      .getState()
      .create(validInput({ collateral: { asset: 'BTC', quantity: 0 } }));
    if (!created.ok) throw new Error('setup failed');
    expect(usePortfolioStore.getState().portfolios[created.data.id].summary.ok).toBe(false);
  });

  it('caches a failed summary when collateral value exactly equals debt value (calculateEffectiveLeverage divides by zero)', () => {
    // 1 BTC @ $20,000 collateral value === $20,000 debt value.
    const created = usePortfolioStore.getState().create(
      validInput({
        collateral: { asset: 'BTC', quantity: 1 },
        debt: { asset: 'USDC', balance: 20000 },
        market: { btcPriceUsd: 20000 },
      }),
    );
    if (!created.ok) throw new Error('setup failed');
    expect(usePortfolioStore.getState().portfolios[created.data.id].summary.ok).toBe(false);
  });

  it('caches a failed summary for a zero liquidation threshold with nonzero debt (calculateLiquidationPrice divides by zero)', () => {
    const created = usePortfolioStore.getState().create(
      validInput({
        protocol: { maxLoanToValue: 0, liquidationThreshold: 0, borrowApr: 0.05, supplyApr: 0.02 },
      }),
    );
    if (!created.ok) throw new Error('setup failed');
    expect(usePortfolioStore.getState().portfolios[created.data.id].summary.ok).toBe(false);
  });
});

describe('usePortfolioStore.recomputeSummary (M4-017)', () => {
  it('re-derives and re-caches the summary from the already-stored portfolio, changing no data', () => {
    const created = usePortfolioStore
      .getState()
      .create(validInput({ collateral: { asset: 'BTC', quantity: 0 } }));
    if (!created.ok) throw new Error('setup failed');
    expect(usePortfolioStore.getState().portfolios[created.data.id].summary.ok).toBe(false);

    usePortfolioStore.getState().recomputeSummary(created.data.id);

    // Same (still Zod-valid-but-failing) data in, same failure out —
    // this proves the recompute actually ran, not a no-op.
    const record = usePortfolioStore.getState().portfolios[created.data.id];
    expect(record.summary.ok).toBe(false);
    expect(record.portfolio).toEqual(created.data);
  });

  it('recovers once the underlying data is fixed by a real update, without a page reload', () => {
    const created = usePortfolioStore
      .getState()
      .create(validInput({ collateral: { asset: 'BTC', quantity: 0 } }));
    if (!created.ok) throw new Error('setup failed');
    expect(usePortfolioStore.getState().portfolios[created.data.id].summary.ok).toBe(false);

    usePortfolioStore
      .getState()
      .update(created.data.id, { collateral: { asset: 'BTC', quantity: 2 } });
    expect(usePortfolioStore.getState().portfolios[created.data.id].summary.ok).toBe(true);
  });

  it('reports a not-found error for an unknown id', () => {
    usePortfolioStore.getState().recomputeSummary('missing-id');
    expect(usePortfolioStore.getState().errors[0]).toMatchObject({ code: 'PORTFOLIO_NOT_FOUND' });
  });

  it('does not touch saveStatus — nothing is being saved, only re-derived', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.setState({ saveStatus: 'idle' });

    usePortfolioStore.getState().recomputeSummary(created.data.id);

    expect(usePortfolioStore.getState().saveStatus).toBe('idle');
  });
});

/**
 * `setProtocolVersion`/`setAaveV4Position` — V4 Readiness Audit §12
 * Stage 5.
 */
const VALID_V4_ADDRESS = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';

function createValidPortfolio() {
  const result = usePortfolioStore.getState().create(validInput());
  if (!result.ok) throw new Error('setup failed');
  return result.data;
}

describe('usePortfolioStore.setProtocolVersion (Stage 5)', () => {
  it('sets protocolVersion on the target portfolio', () => {
    const created = createValidPortfolio();
    usePortfolioStore.getState().setProtocolVersion(created.id, 'v4');
    expect(usePortfolioStore.getState().portfolios[created.id].portfolio.protocolVersion).toBe(
      'v4',
    );
  });

  it('clears protocolVersion back to undefined', () => {
    const created = createValidPortfolio();
    usePortfolioStore.getState().setProtocolVersion(created.id, 'v4');
    usePortfolioStore.getState().setProtocolVersion(created.id, undefined);
    expect(
      usePortfolioStore.getState().portfolios[created.id].portfolio.protocolVersion,
    ).toBeUndefined();
  });

  it('does not set or require v4Position as a side effect (no cross-inference)', () => {
    const created = createValidPortfolio();
    usePortfolioStore.getState().setProtocolVersion(created.id, 'v4');
    expect(
      usePortfolioStore.getState().portfolios[created.id].portfolio.v4Position,
    ).toBeUndefined();
  });

  it('leaves every other field untouched', () => {
    const created = createValidPortfolio();
    usePortfolioStore.getState().setProtocolVersion(created.id, 'v4');
    const updated = usePortfolioStore.getState().portfolios[created.id].portfolio;

    expect(updated.name).toBe(created.name);
    expect(updated.collateral).toEqual(created.collateral);
    expect(updated.debt).toEqual(created.debt);
    expect(updated.market).toEqual(created.market);
    expect(updated.protocol).toEqual(created.protocol);
    expect(updated.archivedAt).toBe(created.archivedAt);
    expect(updated.createdAt).toBe(created.createdAt);
  });

  it('reports a not-found error for an unknown id and does not throw', () => {
    usePortfolioStore.getState().setProtocolVersion('missing-id', 'v4');
    expect(usePortfolioStore.getState().errors[0]).toMatchObject({ code: 'PORTFOLIO_NOT_FOUND' });
  });

  it('schedules a save (saveStatus reaches "saved")', async () => {
    const created = createValidPortfolio();
    await autoSaveCoordinator.flushAll();
    usePortfolioStore.getState().setProtocolVersion(created.id, 'v4');
    await autoSaveCoordinator.flushAll();
    expect(usePortfolioStore.getState().saveStatus).toBe('saved');
  });
});

describe('usePortfolioStore.setAaveV4Position (Stage 5)', () => {
  it('sets a well-formed v4Position on the target portfolio', () => {
    const created = createValidPortfolio();
    const result = usePortfolioStore
      .getState()
      .setAaveV4Position(created.id, { userAddress: VALID_V4_ADDRESS as `0x${string}` });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.v4Position).toEqual({ userAddress: VALID_V4_ADDRESS });
    expect(usePortfolioStore.getState().portfolios[created.id].portfolio.v4Position).toEqual({
      userAddress: VALID_V4_ADDRESS,
    });
  });

  it('rejects a malformed address, leaving the portfolio unchanged', () => {
    const created = createValidPortfolio();
    const result = usePortfolioStore
      .getState()
      .setAaveV4Position(created.id, { userAddress: 'not-an-address' as `0x${string}` });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.every((error) => error.category === 'validation')).toBe(true);
    expect(
      usePortfolioStore.getState().portfolios[created.id].portfolio.v4Position,
    ).toBeUndefined();
    expect(usePortfolioStore.getState().errors).toEqual(result.errors);
  });

  it('clears v4Position back to undefined', () => {
    const created = createValidPortfolio();
    usePortfolioStore
      .getState()
      .setAaveV4Position(created.id, { userAddress: VALID_V4_ADDRESS as `0x${string}` });
    const cleared = usePortfolioStore.getState().setAaveV4Position(created.id, undefined);

    expect(cleared.ok).toBe(true);
    if (!cleared.ok) return;
    expect(cleared.data.v4Position).toBeUndefined();
    expect(
      usePortfolioStore.getState().portfolios[created.id].portfolio.v4Position,
    ).toBeUndefined();
  });

  it('does not set or require protocolVersion as a side effect (no cross-inference)', () => {
    const created = createValidPortfolio();
    usePortfolioStore
      .getState()
      .setAaveV4Position(created.id, { userAddress: VALID_V4_ADDRESS as `0x${string}` });
    expect(
      usePortfolioStore.getState().portfolios[created.id].portfolio.protocolVersion,
    ).toBeUndefined();
  });

  it('reports a not-found error for an unknown id and does not throw', () => {
    const result = usePortfolioStore
      .getState()
      .setAaveV4Position('missing-id', { userAddress: VALID_V4_ADDRESS as `0x${string}` });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatchObject({ code: 'PORTFOLIO_NOT_FOUND' });
  });

  it('schedules a save (saveStatus reaches "saved") on a successful set', async () => {
    const created = createValidPortfolio();
    await autoSaveCoordinator.flushAll();
    usePortfolioStore
      .getState()
      .setAaveV4Position(created.id, { userAddress: VALID_V4_ADDRESS as `0x${string}` });
    await autoSaveCoordinator.flushAll();
    expect(usePortfolioStore.getState().saveStatus).toBe('saved');
  });

  it('does not schedule a save on a rejected (invalid-address) set', async () => {
    const created = createValidPortfolio();
    await autoSaveCoordinator.flushAll();
    usePortfolioStore.setState({ saveStatus: 'idle' });

    usePortfolioStore
      .getState()
      .setAaveV4Position(created.id, { userAddress: 'nope' as `0x${string}` });
    await autoSaveCoordinator.flushAll();

    expect(usePortfolioStore.getState().saveStatus).toBe('error');
  });
});

describe('Portfolio identity persistence — real write/reload round trip (Stage 5)', () => {
  it('protocolVersion and v4Position both survive a genuine local storage round trip, surviving a simulated refresh', async () => {
    const created = createValidPortfolio();
    usePortfolioStore.getState().setProtocolVersion(created.id, 'v4');
    usePortfolioStore
      .getState()
      .setAaveV4Position(created.id, { userAddress: VALID_V4_ADDRESS as `0x${string}` });
    await autoSaveCoordinator.flushAll();

    // Simulates a page refresh: wipe in-memory state, then hydrate purely
    // from whatever `persistenceService`/local storage actually has —
    // before Stage 5, `persistedPortfolioPayloadSchema` silently stripped
    // both fields here (Zod drops unrecognized keys on `.parse()`).
    usePortfolioStore.setState(INITIAL_STATE);
    await usePortfolioStore.getState().load();

    const record = usePortfolioStore.getState().portfolios[created.id];
    expect(record).toBeDefined();
    expect(record.portfolio.protocolVersion).toBe('v4');
    expect(record.portfolio.v4Position).toEqual({ userAddress: VALID_V4_ADDRESS });
  });

  it('clearing v4Position also survives the round trip (does not resurrect on reload)', async () => {
    const created = createValidPortfolio();
    usePortfolioStore
      .getState()
      .setAaveV4Position(created.id, { userAddress: VALID_V4_ADDRESS as `0x${string}` });
    await autoSaveCoordinator.flushAll();
    usePortfolioStore.getState().setAaveV4Position(created.id, undefined);
    await autoSaveCoordinator.flushAll();

    usePortfolioStore.setState(INITIAL_STATE);
    await usePortfolioStore.getState().load();

    expect(
      usePortfolioStore.getState().portfolios[created.id].portfolio.v4Position,
    ).toBeUndefined();
  });
});

describe('Backward compatibility — existing V3 create/update/duplicate behavior is unaffected (Stage 5)', () => {
  it('create leaves protocolVersion and v4Position undefined for an ordinary portfolio', () => {
    const created = createValidPortfolio();
    expect(created.protocolVersion).toBeUndefined();
    expect(created.v4Position).toBeUndefined();
  });

  it('update (name-only) does not introduce either field', () => {
    const created = createValidPortfolio();
    const updated = usePortfolioStore.getState().update(created.id, { name: 'Renamed' });
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.data.protocolVersion).toBeUndefined();
    expect(updated.data.v4Position).toBeUndefined();
  });

  it('duplicate does not introduce either field on the copy', () => {
    const created = createValidPortfolio();
    const duplicated = usePortfolioStore.getState().duplicate(created.id);
    expect(duplicated.ok).toBe(true);
    if (!duplicated.ok) return;
    expect(duplicated.data.protocolVersion).toBeUndefined();
    expect(duplicated.data.v4Position).toBeUndefined();
  });

  it('duplicate carries an existing v4Position/protocolVersion through unchanged (not stripped, not reset)', () => {
    const created = createValidPortfolio();
    usePortfolioStore.getState().setProtocolVersion(created.id, 'v4');
    usePortfolioStore
      .getState()
      .setAaveV4Position(created.id, { userAddress: VALID_V4_ADDRESS as `0x${string}` });

    const duplicated = usePortfolioStore.getState().duplicate(created.id);
    expect(duplicated.ok).toBe(true);
    if (!duplicated.ok) return;
    expect(duplicated.data.protocolVersion).toBe('v4');
    expect(duplicated.data.v4Position).toEqual({ userAddress: VALID_V4_ADDRESS });
  });

  it('a plain V3 portfolio (neither field ever set) still survives a full write/reload round trip', async () => {
    const created = createValidPortfolio();
    await autoSaveCoordinator.flushAll();

    usePortfolioStore.setState(INITIAL_STATE);
    await usePortfolioStore.getState().load();

    const record = usePortfolioStore.getState().portfolios[created.id];
    expect(record).toBeDefined();
    expect(record.portfolio.protocolVersion).toBeUndefined();
    expect(record.portfolio.v4Position).toBeUndefined();
    expect(record.portfolio.name).toBe(created.name);
  });

  it('archive/unarchive on a V4-identified portfolio does not touch protocolVersion/v4Position', () => {
    const created = createValidPortfolio();
    usePortfolioStore.getState().setProtocolVersion(created.id, 'v4');
    usePortfolioStore
      .getState()
      .setAaveV4Position(created.id, { userAddress: VALID_V4_ADDRESS as `0x${string}` });

    usePortfolioStore.getState().archive(created.id);
    usePortfolioStore.getState().unarchive(created.id);

    const record = usePortfolioStore.getState().portfolios[created.id];
    expect(record.portfolio.protocolVersion).toBe('v4');
    expect(record.portfolio.v4Position).toEqual({ userAddress: VALID_V4_ADDRESS });
  });
});

/**
 * `setAaveV4DebtState` — V4 Readiness Audit §12 Stage 6.
 */
const VALID_V4_DEBT_STATE = {
  drawnDebt: 15000,
  premiumDebt: 500,
  baseDrawnApr: 0.05,
  riskPremium: 0.01,
};

describe('usePortfolioStore.setAaveV4DebtState (Stage 6)', () => {
  it('sets a well-formed v4DebtState on the target portfolio', () => {
    const created = createValidPortfolio();
    const result = usePortfolioStore.getState().setAaveV4DebtState(created.id, VALID_V4_DEBT_STATE);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.v4DebtState).toEqual(VALID_V4_DEBT_STATE);
    expect(usePortfolioStore.getState().portfolios[created.id].portfolio.v4DebtState).toEqual(
      VALID_V4_DEBT_STATE,
    );
  });

  it('rejects a v4DebtState with a negative field, leaving the portfolio unchanged', () => {
    const created = createValidPortfolio();
    const result = usePortfolioStore
      .getState()
      .setAaveV4DebtState(created.id, { ...VALID_V4_DEBT_STATE, drawnDebt: -1 });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.every((error) => error.category === 'validation')).toBe(true);
    expect(
      usePortfolioStore.getState().portfolios[created.id].portfolio.v4DebtState,
    ).toBeUndefined();
    expect(usePortfolioStore.getState().errors).toEqual(result.errors);
  });

  it('clears v4DebtState back to undefined', () => {
    const created = createValidPortfolio();
    usePortfolioStore.getState().setAaveV4DebtState(created.id, VALID_V4_DEBT_STATE);
    const cleared = usePortfolioStore.getState().setAaveV4DebtState(created.id, undefined);

    expect(cleared.ok).toBe(true);
    if (!cleared.ok) return;
    expect(cleared.data.v4DebtState).toBeUndefined();
    expect(
      usePortfolioStore.getState().portfolios[created.id].portfolio.v4DebtState,
    ).toBeUndefined();
  });

  it('does not set or require protocolVersion/v4Position as a side effect (no cross-inference)', () => {
    const created = createValidPortfolio();
    usePortfolioStore.getState().setAaveV4DebtState(created.id, VALID_V4_DEBT_STATE);
    const record = usePortfolioStore.getState().portfolios[created.id].portfolio;
    expect(record.protocolVersion).toBeUndefined();
    expect(record.v4Position).toBeUndefined();
  });

  it('reports a not-found error for an unknown id and does not throw', () => {
    const result = usePortfolioStore
      .getState()
      .setAaveV4DebtState('missing-id', VALID_V4_DEBT_STATE);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatchObject({ code: 'PORTFOLIO_NOT_FOUND' });
  });

  it('schedules a save (saveStatus reaches "saved") on a successful set', async () => {
    const created = createValidPortfolio();
    await autoSaveCoordinator.flushAll();
    usePortfolioStore.getState().setAaveV4DebtState(created.id, VALID_V4_DEBT_STATE);
    await autoSaveCoordinator.flushAll();
    expect(usePortfolioStore.getState().saveStatus).toBe('saved');
  });

  it('does not schedule a save on a rejected (invalid) set', async () => {
    const created = createValidPortfolio();
    await autoSaveCoordinator.flushAll();
    usePortfolioStore.setState({ saveStatus: 'idle' });

    usePortfolioStore
      .getState()
      .setAaveV4DebtState(created.id, { ...VALID_V4_DEBT_STATE, riskPremium: -0.01 });
    await autoSaveCoordinator.flushAll();

    expect(usePortfolioStore.getState().saveStatus).toBe('error');
  });
});

describe('Portfolio v4DebtState — real write/reload round trip (Stage 6)', () => {
  it('v4DebtState survives a genuine local storage round trip, surviving a simulated refresh', async () => {
    const created = createValidPortfolio();
    usePortfolioStore.getState().setAaveV4DebtState(created.id, VALID_V4_DEBT_STATE);
    await autoSaveCoordinator.flushAll();

    usePortfolioStore.setState(INITIAL_STATE);
    await usePortfolioStore.getState().load();

    const record = usePortfolioStore.getState().portfolios[created.id];
    expect(record).toBeDefined();
    expect(record.portfolio.v4DebtState).toEqual(VALID_V4_DEBT_STATE);
  });

  it('clearing v4DebtState also survives the round trip (does not resurrect on reload)', async () => {
    const created = createValidPortfolio();
    usePortfolioStore.getState().setAaveV4DebtState(created.id, VALID_V4_DEBT_STATE);
    await autoSaveCoordinator.flushAll();
    usePortfolioStore.getState().setAaveV4DebtState(created.id, undefined);
    await autoSaveCoordinator.flushAll();

    usePortfolioStore.setState(INITIAL_STATE);
    await usePortfolioStore.getState().load();

    expect(
      usePortfolioStore.getState().portfolios[created.id].portfolio.v4DebtState,
    ).toBeUndefined();
  });

  it('v4DebtState, v4Position, and protocolVersion all survive the same round trip together', async () => {
    const created = createValidPortfolio();
    usePortfolioStore.getState().setProtocolVersion(created.id, 'v4');
    usePortfolioStore
      .getState()
      .setAaveV4Position(created.id, { userAddress: VALID_V4_ADDRESS as `0x${string}` });
    usePortfolioStore.getState().setAaveV4DebtState(created.id, VALID_V4_DEBT_STATE);
    await autoSaveCoordinator.flushAll();

    usePortfolioStore.setState(INITIAL_STATE);
    await usePortfolioStore.getState().load();

    const record = usePortfolioStore.getState().portfolios[created.id];
    expect(record.portfolio.protocolVersion).toBe('v4');
    expect(record.portfolio.v4Position).toEqual({ userAddress: VALID_V4_ADDRESS });
    expect(record.portfolio.v4DebtState).toEqual(VALID_V4_DEBT_STATE);
  });
});

describe('Backward compatibility — v4DebtState absence does not affect existing V3 behavior (Stage 6)', () => {
  it('create leaves v4DebtState undefined for an ordinary portfolio', () => {
    const created = createValidPortfolio();
    expect(created.v4DebtState).toBeUndefined();
  });

  it('update (name-only) does not introduce v4DebtState', () => {
    const created = createValidPortfolio();
    const updated = usePortfolioStore.getState().update(created.id, { name: 'Renamed' });
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.data.v4DebtState).toBeUndefined();
  });

  it('duplicate does not introduce v4DebtState on the copy', () => {
    const created = createValidPortfolio();
    const duplicated = usePortfolioStore.getState().duplicate(created.id);
    expect(duplicated.ok).toBe(true);
    if (!duplicated.ok) return;
    expect(duplicated.data.v4DebtState).toBeUndefined();
  });

  it('duplicate carries an existing v4DebtState through unchanged (not stripped, not reset)', () => {
    const created = createValidPortfolio();
    usePortfolioStore.getState().setAaveV4DebtState(created.id, VALID_V4_DEBT_STATE);

    const duplicated = usePortfolioStore.getState().duplicate(created.id);
    expect(duplicated.ok).toBe(true);
    if (!duplicated.ok) return;
    expect(duplicated.data.v4DebtState).toEqual(VALID_V4_DEBT_STATE);
  });

  it('archive/unarchive on a portfolio with v4DebtState set does not touch it', () => {
    const created = createValidPortfolio();
    usePortfolioStore.getState().setAaveV4DebtState(created.id, VALID_V4_DEBT_STATE);

    usePortfolioStore.getState().archive(created.id);
    usePortfolioStore.getState().unarchive(created.id);

    expect(usePortfolioStore.getState().portfolios[created.id].portfolio.v4DebtState).toEqual(
      VALID_V4_DEBT_STATE,
    );
  });

  it('a plain V3 portfolio (v4DebtState never set) still survives a full write/reload round trip', async () => {
    const created = createValidPortfolio();
    await autoSaveCoordinator.flushAll();

    usePortfolioStore.setState(INITIAL_STATE);
    await usePortfolioStore.getState().load();

    const record = usePortfolioStore.getState().portfolios[created.id];
    expect(record).toBeDefined();
    expect(record.portfolio.v4DebtState).toBeUndefined();
  });
});

/**
 * `setAaveV4CollateralRisk` — V4 Readiness Audit §12 Stage 23C, same
 * "extend model, schema, and Store action together" discipline as
 * `setAaveV4DebtState` (Stage 6) above — mirrors that describe block's
 * exact shape.
 */
const VALID_V4_COLLATERAL_RISK = {
  collateralFactor: 0.75,
  dynamicConfigKey: 3,
};

describe('usePortfolioStore.setAaveV4CollateralRisk (Stage 23C)', () => {
  it('sets a well-formed v4CollateralRisk on the target portfolio', () => {
    const created = createValidPortfolio();
    const result = usePortfolioStore
      .getState()
      .setAaveV4CollateralRisk(created.id, VALID_V4_COLLATERAL_RISK);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.v4CollateralRisk).toEqual(VALID_V4_COLLATERAL_RISK);
    expect(usePortfolioStore.getState().portfolios[created.id].portfolio.v4CollateralRisk).toEqual(
      VALID_V4_COLLATERAL_RISK,
    );
  });

  it('rejects a collateralFactor above 1 (100%), leaving the portfolio unchanged', () => {
    const created = createValidPortfolio();
    const result = usePortfolioStore
      .getState()
      .setAaveV4CollateralRisk(created.id, { ...VALID_V4_COLLATERAL_RISK, collateralFactor: 1.5 });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.every((error) => error.category === 'validation')).toBe(true);
    expect(
      usePortfolioStore.getState().portfolios[created.id].portfolio.v4CollateralRisk,
    ).toBeUndefined();
    expect(usePortfolioStore.getState().errors).toEqual(result.errors);
  });

  it('rejects a negative dynamicConfigKey, leaving the portfolio unchanged', () => {
    const created = createValidPortfolio();
    const result = usePortfolioStore
      .getState()
      .setAaveV4CollateralRisk(created.id, { ...VALID_V4_COLLATERAL_RISK, dynamicConfigKey: -1 });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(
      usePortfolioStore.getState().portfolios[created.id].portfolio.v4CollateralRisk,
    ).toBeUndefined();
  });

  it('accepts collateralFactor 0 (a real, uninitialized on-chain dynamic config, not a validation failure)', () => {
    const created = createValidPortfolio();
    const result = usePortfolioStore
      .getState()
      .setAaveV4CollateralRisk(created.id, { collateralFactor: 0, dynamicConfigKey: 0 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.v4CollateralRisk).toEqual({ collateralFactor: 0, dynamicConfigKey: 0 });
  });

  it('clears v4CollateralRisk back to undefined', () => {
    const created = createValidPortfolio();
    usePortfolioStore.getState().setAaveV4CollateralRisk(created.id, VALID_V4_COLLATERAL_RISK);
    const cleared = usePortfolioStore.getState().setAaveV4CollateralRisk(created.id, undefined);

    expect(cleared.ok).toBe(true);
    if (!cleared.ok) return;
    expect(cleared.data.v4CollateralRisk).toBeUndefined();
    expect(
      usePortfolioStore.getState().portfolios[created.id].portfolio.v4CollateralRisk,
    ).toBeUndefined();
  });

  it('does not set or require protocolVersion/v4Position/v4DebtState as a side effect (no cross-inference)', () => {
    const created = createValidPortfolio();
    usePortfolioStore.getState().setAaveV4CollateralRisk(created.id, VALID_V4_COLLATERAL_RISK);
    const record = usePortfolioStore.getState().portfolios[created.id].portfolio;
    expect(record.protocolVersion).toBeUndefined();
    expect(record.v4Position).toBeUndefined();
    expect(record.v4DebtState).toBeUndefined();
  });

  it('reports a not-found error for an unknown id and does not throw', () => {
    const result = usePortfolioStore
      .getState()
      .setAaveV4CollateralRisk('missing-id', VALID_V4_COLLATERAL_RISK);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatchObject({ code: 'PORTFOLIO_NOT_FOUND' });
  });

  it('schedules a save (saveStatus reaches "saved") on a successful set', async () => {
    const created = createValidPortfolio();
    await autoSaveCoordinator.flushAll();
    usePortfolioStore.getState().setAaveV4CollateralRisk(created.id, VALID_V4_COLLATERAL_RISK);
    await autoSaveCoordinator.flushAll();
    expect(usePortfolioStore.getState().saveStatus).toBe('saved');
  });

  it('does not schedule a save on a rejected (invalid) set', async () => {
    const created = createValidPortfolio();
    await autoSaveCoordinator.flushAll();
    usePortfolioStore.setState({ saveStatus: 'idle' });

    usePortfolioStore
      .getState()
      .setAaveV4CollateralRisk(created.id, { ...VALID_V4_COLLATERAL_RISK, collateralFactor: -0.1 });
    await autoSaveCoordinator.flushAll();

    expect(usePortfolioStore.getState().saveStatus).toBe('error');
  });
});

describe('Portfolio v4CollateralRisk — real write/reload round trip (Stage 23C)', () => {
  it('v4CollateralRisk survives a genuine local storage round trip, surviving a simulated refresh', async () => {
    const created = createValidPortfolio();
    usePortfolioStore.getState().setAaveV4CollateralRisk(created.id, VALID_V4_COLLATERAL_RISK);
    await autoSaveCoordinator.flushAll();

    usePortfolioStore.setState(INITIAL_STATE);
    await usePortfolioStore.getState().load();

    const record = usePortfolioStore.getState().portfolios[created.id];
    expect(record).toBeDefined();
    expect(record.portfolio.v4CollateralRisk).toEqual(VALID_V4_COLLATERAL_RISK);
  });

  it('clearing v4CollateralRisk also survives the round trip (does not resurrect on reload)', async () => {
    const created = createValidPortfolio();
    usePortfolioStore.getState().setAaveV4CollateralRisk(created.id, VALID_V4_COLLATERAL_RISK);
    await autoSaveCoordinator.flushAll();
    usePortfolioStore.getState().setAaveV4CollateralRisk(created.id, undefined);
    await autoSaveCoordinator.flushAll();

    usePortfolioStore.setState(INITIAL_STATE);
    await usePortfolioStore.getState().load();

    expect(
      usePortfolioStore.getState().portfolios[created.id].portfolio.v4CollateralRisk,
    ).toBeUndefined();
  });

  it('v4CollateralRisk, v4DebtState, v4Position, and protocolVersion all survive the same round trip together', async () => {
    const created = createValidPortfolio();
    usePortfolioStore.getState().setProtocolVersion(created.id, 'v4');
    usePortfolioStore
      .getState()
      .setAaveV4Position(created.id, { userAddress: VALID_V4_ADDRESS as `0x${string}` });
    usePortfolioStore.getState().setAaveV4DebtState(created.id, VALID_V4_DEBT_STATE);
    usePortfolioStore.getState().setAaveV4CollateralRisk(created.id, VALID_V4_COLLATERAL_RISK);
    await autoSaveCoordinator.flushAll();

    usePortfolioStore.setState(INITIAL_STATE);
    await usePortfolioStore.getState().load();

    const record = usePortfolioStore.getState().portfolios[created.id];
    expect(record.portfolio.protocolVersion).toBe('v4');
    expect(record.portfolio.v4Position).toEqual({ userAddress: VALID_V4_ADDRESS });
    expect(record.portfolio.v4DebtState).toEqual(VALID_V4_DEBT_STATE);
    expect(record.portfolio.v4CollateralRisk).toEqual(VALID_V4_COLLATERAL_RISK);
  });

  it('a plain V3 portfolio (v4CollateralRisk never set) still survives a full write/reload round trip', async () => {
    const created = createValidPortfolio();
    await autoSaveCoordinator.flushAll();

    usePortfolioStore.setState(INITIAL_STATE);
    await usePortfolioStore.getState().load();

    const record = usePortfolioStore.getState().portfolios[created.id];
    expect(record).toBeDefined();
    expect(record.portfolio.v4CollateralRisk).toBeUndefined();
  });
});

/**
 * `v4DebtStateSource`/`v4CollateralRiskSource` provenance — Stage 25
 * (Manual/Hypothetical V4 Mode). `setAaveV4DebtState`/
 * `setAaveV4CollateralRisk` default an omitted `source` to `'live'`
 * (every pre-existing caller, including the two live-sync hooks, was
 * already modeling live-synced data), while an explicit `'manual'` is
 * how the new manual-entry UI records user-authored state. Clearing a
 * value (`undefined`) always clears its source too — the invariant "a
 * source field is defined if and only if the corresponding value field
 * is defined" holds at every write.
 */
describe('usePortfolioStore.setAaveV4DebtState / setAaveV4CollateralRisk — source provenance (Stage 25)', () => {
  it('defaults v4DebtStateSource to "live" when source is omitted', () => {
    const created = createValidPortfolio();
    usePortfolioStore.getState().setAaveV4DebtState(created.id, VALID_V4_DEBT_STATE);
    expect(usePortfolioStore.getState().portfolios[created.id].portfolio.v4DebtStateSource).toBe(
      'live',
    );
  });

  it('records an explicit "manual" source when passed', () => {
    const created = createValidPortfolio();
    usePortfolioStore.getState().setAaveV4DebtState(created.id, VALID_V4_DEBT_STATE, 'manual');
    expect(usePortfolioStore.getState().portfolios[created.id].portfolio.v4DebtStateSource).toBe(
      'manual',
    );
  });

  it('records an explicit "live" source when passed', () => {
    const created = createValidPortfolio();
    usePortfolioStore.getState().setAaveV4DebtState(created.id, VALID_V4_DEBT_STATE, 'live');
    expect(usePortfolioStore.getState().portfolios[created.id].portfolio.v4DebtStateSource).toBe(
      'live',
    );
  });

  it('clearing v4DebtState also clears v4DebtStateSource', () => {
    const created = createValidPortfolio();
    usePortfolioStore.getState().setAaveV4DebtState(created.id, VALID_V4_DEBT_STATE, 'manual');
    usePortfolioStore.getState().setAaveV4DebtState(created.id, undefined);
    const record = usePortfolioStore.getState().portfolios[created.id].portfolio;
    expect(record.v4DebtState).toBeUndefined();
    expect(record.v4DebtStateSource).toBeUndefined();
  });

  it('defaults v4CollateralRiskSource to "live" when source is omitted', () => {
    const created = createValidPortfolio();
    usePortfolioStore.getState().setAaveV4CollateralRisk(created.id, VALID_V4_COLLATERAL_RISK);
    expect(
      usePortfolioStore.getState().portfolios[created.id].portfolio.v4CollateralRiskSource,
    ).toBe('live');
  });

  it('records an explicit "manual" source when passed', () => {
    const created = createValidPortfolio();
    usePortfolioStore
      .getState()
      .setAaveV4CollateralRisk(created.id, VALID_V4_COLLATERAL_RISK, 'manual');
    expect(
      usePortfolioStore.getState().portfolios[created.id].portfolio.v4CollateralRiskSource,
    ).toBe('manual');
  });

  it('clearing v4CollateralRisk also clears v4CollateralRiskSource', () => {
    const created = createValidPortfolio();
    usePortfolioStore
      .getState()
      .setAaveV4CollateralRisk(created.id, VALID_V4_COLLATERAL_RISK, 'manual');
    usePortfolioStore.getState().setAaveV4CollateralRisk(created.id, undefined);
    const record = usePortfolioStore.getState().portfolios[created.id].portfolio;
    expect(record.v4CollateralRisk).toBeUndefined();
    expect(record.v4CollateralRiskSource).toBeUndefined();
  });

  it('debt and collateral-risk sources are independently settable — one manual, the other live', () => {
    const created = createValidPortfolio();
    usePortfolioStore.getState().setAaveV4DebtState(created.id, VALID_V4_DEBT_STATE, 'manual');
    usePortfolioStore
      .getState()
      .setAaveV4CollateralRisk(created.id, VALID_V4_COLLATERAL_RISK, 'live');
    const record = usePortfolioStore.getState().portfolios[created.id].portfolio;
    expect(record.v4DebtStateSource).toBe('manual');
    expect(record.v4CollateralRiskSource).toBe('live');
  });

  it('provenance survives a genuine local storage round trip', async () => {
    const created = createValidPortfolio();
    usePortfolioStore.getState().setAaveV4DebtState(created.id, VALID_V4_DEBT_STATE, 'manual');
    usePortfolioStore
      .getState()
      .setAaveV4CollateralRisk(created.id, VALID_V4_COLLATERAL_RISK, 'live');
    await autoSaveCoordinator.flushAll();

    usePortfolioStore.setState(INITIAL_STATE);
    await usePortfolioStore.getState().load();

    const record = usePortfolioStore.getState().portfolios[created.id].portfolio;
    expect(record.v4DebtStateSource).toBe('manual');
    expect(record.v4CollateralRiskSource).toBe('live');
  });
});

/**
 * `normalizeV4Provenance` load-time backfill — Stage 25. A portfolio
 * persisted before `v4DebtStateSource`/`v4CollateralRiskSource` existed
 * (or written by any code path that never set them) has a defined value
 * with no source field. `load()` must backfill the missing source to
 * `'manual'` — never `'live'`, since nothing can actually prove a
 * historical value was ever live-synced — while leaving an
 * already-present source (of either kind) untouched.
 */
describe('usePortfolioStore.load — normalizeV4Provenance backfill (Stage 25)', () => {
  function writeRawPortfolioRecord(id: string, payload: Record<string, unknown>) {
    const envelope = {
      app: 'ProfitPilot',
      storageSchemaVersion: '1.0.0',
      appVersion: '1.0.0',
      recordType: 'portfolio',
      recordId: id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      checksum: computeChecksum(payload),
      payload,
    };
    window.localStorage.setItem(buildLocalStorageKey('portfolio', id), JSON.stringify(envelope));
  }

  it('backfills a historical v4DebtState with no source field to "manual", never "live"', async () => {
    const created = createValidPortfolio();
    usePortfolioStore.getState().setAaveV4DebtState(created.id, VALID_V4_DEBT_STATE, 'live');
    await autoSaveCoordinator.flushAll();

    const stored = usePortfolioStore.getState().portfolios[created.id].portfolio;
    const { v4DebtStateSource, ...withoutSource } = stored as unknown as Record<string, unknown> & {
      v4DebtStateSource?: unknown;
    };
    void v4DebtStateSource;
    writeRawPortfolioRecord(created.id, withoutSource);

    usePortfolioStore.setState(INITIAL_STATE);
    await usePortfolioStore.getState().load();

    const record = usePortfolioStore.getState().portfolios[created.id].portfolio;
    expect(record.v4DebtState).toEqual(VALID_V4_DEBT_STATE);
    expect(record.v4DebtStateSource).toBe('manual');
  });

  it('backfills a historical v4CollateralRisk with no source field to "manual", never "live"', async () => {
    const created = createValidPortfolio();
    usePortfolioStore
      .getState()
      .setAaveV4CollateralRisk(created.id, VALID_V4_COLLATERAL_RISK, 'live');
    await autoSaveCoordinator.flushAll();

    const stored = usePortfolioStore.getState().portfolios[created.id].portfolio;
    const { v4CollateralRiskSource, ...withoutSource } = stored as unknown as Record<
      string,
      unknown
    > & {
      v4CollateralRiskSource?: unknown;
    };
    void v4CollateralRiskSource;
    writeRawPortfolioRecord(created.id, withoutSource);

    usePortfolioStore.setState(INITIAL_STATE);
    await usePortfolioStore.getState().load();

    const record = usePortfolioStore.getState().portfolios[created.id].portfolio;
    expect(record.v4CollateralRisk).toEqual(VALID_V4_COLLATERAL_RISK);
    expect(record.v4CollateralRiskSource).toBe('manual');
  });

  it('leaves an already-present source field untouched (does not overwrite "manual" with "live" or vice versa)', async () => {
    const created = createValidPortfolio();
    usePortfolioStore.getState().setAaveV4DebtState(created.id, VALID_V4_DEBT_STATE, 'manual');
    await autoSaveCoordinator.flushAll();

    usePortfolioStore.setState(INITIAL_STATE);
    await usePortfolioStore.getState().load();

    const record = usePortfolioStore.getState().portfolios[created.id].portfolio;
    expect(record.v4DebtStateSource).toBe('manual');
  });

  it('does not fabricate a source field when the value itself was never set', async () => {
    const created = createValidPortfolio();
    await autoSaveCoordinator.flushAll();

    usePortfolioStore.setState(INITIAL_STATE);
    await usePortfolioStore.getState().load();

    const record = usePortfolioStore.getState().portfolios[created.id].portfolio;
    expect(record.v4DebtState).toBeUndefined();
    expect(record.v4DebtStateSource).toBeUndefined();
    expect(record.v4CollateralRisk).toBeUndefined();
    expect(record.v4CollateralRiskSource).toBeUndefined();
  });
});

/**
 * V1.1 Batch 1 (Live-Data Trust Parity) — `marketSource`/`protocolSource`
 * are the V3 equivalent of `v4DebtStateSource`/`v4CollateralRiskSource`
 * above, normalized by the same (now-renamed) `normalizePortfolioProvenance`
 * function. One real difference: `market`/`protocol` are never optional,
 * so a historical record always gets `'manual'` backfilled — never the
 * "value never set, so no source either" case `v4DebtState` allows.
 */
describe('usePortfolioStore.load — market/protocol provenance backfill (V1.1 Batch 1)', () => {
  function writeRawPortfolioRecord(id: string, payload: Record<string, unknown>) {
    const envelope = {
      app: 'ProfitPilot',
      storageSchemaVersion: '1.0.0',
      appVersion: '1.0.0',
      recordType: 'portfolio',
      recordId: id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      checksum: computeChecksum(payload),
      payload,
    };
    window.localStorage.setItem(buildLocalStorageKey('portfolio', id), JSON.stringify(envelope));
  }

  it('backfills a historical portfolio with no marketSource/protocolSource to "manual"', async () => {
    const created = createValidPortfolio();
    await autoSaveCoordinator.flushAll();

    const stored = usePortfolioStore.getState().portfolios[created.id].portfolio;
    const { marketSource, protocolSource, ...withoutSource } = stored as unknown as Record<
      string,
      unknown
    > & {
      marketSource?: unknown;
      protocolSource?: unknown;
    };
    void marketSource;
    void protocolSource;
    writeRawPortfolioRecord(created.id, withoutSource);

    usePortfolioStore.setState(INITIAL_STATE);
    await usePortfolioStore.getState().load();

    const record = usePortfolioStore.getState().portfolios[created.id].portfolio;
    expect(record.market).toEqual(stored.market);
    expect(record.marketSource).toBe('manual');
    expect(record.protocolSource).toBe('manual');
  });

  it('leaves an already-"live" marketSource/protocolSource untouched on reload', async () => {
    const created = createValidPortfolio();
    usePortfolioStore.getState().setMarket(created.id, { btcPriceUsd: 71000 }, 'live');
    await autoSaveCoordinator.flushAll();

    usePortfolioStore.setState(INITIAL_STATE);
    await usePortfolioStore.getState().load();

    const record = usePortfolioStore.getState().portfolios[created.id].portfolio;
    expect(record.marketSource).toBe('live');
    expect(record.market.btcPriceUsd).toBe(71000);
  });
});

/**
 * V1.1 Batch 1 (Live-Data Trust Parity) — `create()` always stamps a
 * new portfolio's `market`/`protocol` as `'manual'`, the one deliberate
 * exception to `setMarket`/`setProtocol`'s own default-to-`'live'`
 * discipline (see those actions' own comments): a brand-new portfolio's
 * values always come from this form's own manual entry, never a live
 * fetch.
 */
describe('usePortfolioStore.create — marketSource/protocolSource default to "manual" (V1.1 Batch 1)', () => {
  it('stamps a newly created portfolio as manual-sourced for both market and protocol', () => {
    const created = createValidPortfolio();
    const record = usePortfolioStore.getState().portfolios[created.id].portfolio;
    expect(record.marketSource).toBe('manual');
    expect(record.protocolSource).toBe('manual');
  });
});

/**
 * V1.1 Batch 1 (Live-Data Trust Parity) — `setMarket`/`setProtocol` and
 * their candidate actions, mirroring the equivalent V4 action tests
 * elsewhere in this file. `hooks/useAaveLiveSync.ts`'s own test suite
 * covers the end-to-end conflict rule; this block covers the Store
 * actions directly and in isolation.
 */
describe('usePortfolioStore — setMarket/setProtocol and market/protocol candidates (V1.1 Batch 1)', () => {
  it('setMarket defaults source to "live" and clears any pending market candidate', () => {
    const created = createValidPortfolio();
    usePortfolioStore.getState().setMarketCandidate(created.id, { btcPriceUsd: 99000 });
    expect(usePortfolioStore.getState().marketCandidates[created.id]).toBeDefined();

    const result = usePortfolioStore.getState().setMarket(created.id, { btcPriceUsd: 71000 });
    expect(result.ok).toBe(true);

    const record = usePortfolioStore.getState().portfolios[created.id].portfolio;
    expect(record.market.btcPriceUsd).toBe(71000);
    expect(record.marketSource).toBe('live');
    expect(usePortfolioStore.getState().marketCandidates[created.id]).toBeUndefined();
  });

  it('setProtocol defaults source to "live" and clears any pending protocol candidate', () => {
    const created = createValidPortfolio();
    const candidate = {
      maxLoanToValue: 0.6,
      liquidationThreshold: 0.65,
      borrowApr: 0.1,
      supplyApr: 0.01,
    };
    usePortfolioStore.getState().setProtocolCandidate(created.id, candidate);
    expect(usePortfolioStore.getState().protocolCandidates[created.id]).toBeDefined();

    const result = usePortfolioStore.getState().setProtocol(created.id, candidate);
    expect(result.ok).toBe(true);

    const record = usePortfolioStore.getState().portfolios[created.id].portfolio;
    expect(record.protocol).toEqual(candidate);
    expect(record.protocolSource).toBe('live');
    expect(usePortfolioStore.getState().protocolCandidates[created.id]).toBeUndefined();
  });

  it('acceptMarketCandidate fails with a validation error when no candidate is pending', () => {
    const created = createValidPortfolio();
    const result = usePortfolioStore.getState().acceptMarketCandidate(created.id);
    expect(result.ok).toBe(false);
  });

  it('acceptProtocolCandidate fails with a validation error when no candidate is pending', () => {
    const created = createValidPortfolio();
    const result = usePortfolioStore.getState().acceptProtocolCandidate(created.id);
    expect(result.ok).toBe(false);
  });

  it('dismissMarketCandidate/dismissProtocolCandidate clear the candidate without touching canonical state', () => {
    const created = createValidPortfolio();
    const before = usePortfolioStore.getState().portfolios[created.id].portfolio;
    usePortfolioStore.getState().setMarketCandidate(created.id, { btcPriceUsd: 99000 });
    usePortfolioStore.getState().setProtocolCandidate(created.id, {
      maxLoanToValue: 0.5,
      liquidationThreshold: 0.55,
      borrowApr: 0.2,
      supplyApr: 0.03,
    });

    usePortfolioStore.getState().dismissMarketCandidate(created.id);
    usePortfolioStore.getState().dismissProtocolCandidate(created.id);

    expect(usePortfolioStore.getState().marketCandidates[created.id]).toBeUndefined();
    expect(usePortfolioStore.getState().protocolCandidates[created.id]).toBeUndefined();
    const after = usePortfolioStore.getState().portfolios[created.id].portfolio;
    expect(after.market).toEqual(before.market);
    expect(after.protocol).toEqual(before.protocol);
    expect(after.marketSource).toBe('manual');
    expect(after.protocolSource).toBe('manual');
  });
});

/**
 * `v4DebtStateUpdatedAt`/`v4CollateralRiskUpdatedAt` freshness persistence
 * — V4 Readiness Audit §12 P2-1. Same "defined iff the value it describes
 * is defined" invariant, and same load-time backward-compatibility
 * discipline, as `v4DebtStateSource`/`v4CollateralRiskSource` (Stage 25)
 * above — but these timestamps need no `normalizeV4Provenance`-style
 * backfill: `undefined` is already the honest "unknown" answer for a
 * portfolio persisted before this field existed, so no migration is
 * needed to keep that promise.
 */
describe('usePortfolioStore.setAaveV4DebtState / setAaveV4CollateralRisk — freshness timestamps (P2-1)', () => {
  function writeRawPortfolioRecord(id: string, payload: Record<string, unknown>) {
    const envelope = {
      app: 'ProfitPilot',
      storageSchemaVersion: '1.0.0',
      appVersion: '1.0.0',
      recordType: 'portfolio',
      recordId: id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      checksum: computeChecksum(payload),
      payload,
    };
    window.localStorage.setItem(buildLocalStorageKey('portfolio', id), JSON.stringify(envelope));
  }

  it('never-fetched leaves v4DebtStateUpdatedAt/v4CollateralRiskUpdatedAt undefined', () => {
    const created = createValidPortfolio();
    const record = usePortfolioStore.getState().portfolios[created.id].portfolio;
    expect(record.v4DebtStateUpdatedAt).toBeUndefined();
    expect(record.v4CollateralRiskUpdatedAt).toBeUndefined();
  });

  it('setAaveV4DebtState stamps v4DebtStateUpdatedAt with the current time', () => {
    const created = createValidPortfolio();
    const before = Date.now();
    usePortfolioStore.getState().setAaveV4DebtState(created.id, VALID_V4_DEBT_STATE, 'live');
    const after = Date.now();

    const record = usePortfolioStore.getState().portfolios[created.id].portfolio;
    expect(record.v4DebtStateUpdatedAt).toBeDefined();
    const stamped = new Date(record.v4DebtStateUpdatedAt as string).getTime();
    expect(stamped).toBeGreaterThanOrEqual(before);
    expect(stamped).toBeLessThanOrEqual(after);
  });

  it('setAaveV4CollateralRisk stamps v4CollateralRiskUpdatedAt with the current time', () => {
    const created = createValidPortfolio();
    const before = Date.now();
    usePortfolioStore
      .getState()
      .setAaveV4CollateralRisk(created.id, VALID_V4_COLLATERAL_RISK, 'live');
    const after = Date.now();

    const record = usePortfolioStore.getState().portfolios[created.id].portfolio;
    expect(record.v4CollateralRiskUpdatedAt).toBeDefined();
    const stamped = new Date(record.v4CollateralRiskUpdatedAt as string).getTime();
    expect(stamped).toBeGreaterThanOrEqual(before);
    expect(stamped).toBeLessThanOrEqual(after);
  });

  it('clearing v4DebtState also clears v4DebtStateUpdatedAt', () => {
    const created = createValidPortfolio();
    usePortfolioStore.getState().setAaveV4DebtState(created.id, VALID_V4_DEBT_STATE, 'live');
    usePortfolioStore.getState().setAaveV4DebtState(created.id, undefined);

    const record = usePortfolioStore.getState().portfolios[created.id].portfolio;
    expect(record.v4DebtStateUpdatedAt).toBeUndefined();
  });

  it('a rejected (invalid) setAaveV4DebtState call does not touch the previously-recorded v4DebtStateUpdatedAt', () => {
    const created = createValidPortfolio();
    usePortfolioStore.getState().setAaveV4DebtState(created.id, VALID_V4_DEBT_STATE, 'live');
    const firstStamp =
      usePortfolioStore.getState().portfolios[created.id].portfolio.v4DebtStateUpdatedAt;

    // Simulates a failed refresh / rejected manual entry: the Store action
    // is only ever called by application code on a validated success, but
    // this proves that even an attempted write that fails validation can
    // never overwrite the last real success with a fake timestamp.
    const rejected = usePortfolioStore
      .getState()
      .setAaveV4DebtState(created.id, { ...VALID_V4_DEBT_STATE, drawnDebt: -1 });

    expect(rejected.ok).toBe(false);
    const record = usePortfolioStore.getState().portfolios[created.id].portfolio;
    expect(record.v4DebtStateUpdatedAt).toBe(firstStamp);
  });

  it('the last successful v4DebtStateUpdatedAt survives a full persistence round-trip (reload)', async () => {
    const created = createValidPortfolio();
    usePortfolioStore.getState().setAaveV4DebtState(created.id, VALID_V4_DEBT_STATE, 'live');
    const stamp =
      usePortfolioStore.getState().portfolios[created.id].portfolio.v4DebtStateUpdatedAt;
    await autoSaveCoordinator.flushAll();

    usePortfolioStore.setState(INITIAL_STATE);
    await usePortfolioStore.getState().load();

    const record = usePortfolioStore.getState().portfolios[created.id].portfolio;
    expect(record.v4DebtStateUpdatedAt).toBe(stamp);
    expect(record.v4DebtStateUpdatedAt).toBeDefined();
  });

  it('the last successful v4CollateralRiskUpdatedAt survives a full persistence round-trip (reload)', async () => {
    const created = createValidPortfolio();
    usePortfolioStore
      .getState()
      .setAaveV4CollateralRisk(created.id, VALID_V4_COLLATERAL_RISK, 'live');
    const stamp =
      usePortfolioStore.getState().portfolios[created.id].portfolio.v4CollateralRiskUpdatedAt;
    await autoSaveCoordinator.flushAll();

    usePortfolioStore.setState(INITIAL_STATE);
    await usePortfolioStore.getState().load();

    const record = usePortfolioStore.getState().portfolios[created.id].portfolio;
    expect(record.v4CollateralRiskUpdatedAt).toBe(stamp);
    expect(record.v4CollateralRiskUpdatedAt).toBeDefined();
  });

  it('an old saved portfolio with no freshness metadata still loads, with the timestamps left undefined (not fabricated)', async () => {
    const created = createValidPortfolio();
    usePortfolioStore.getState().setAaveV4DebtState(created.id, VALID_V4_DEBT_STATE, 'live');
    await autoSaveCoordinator.flushAll();

    const stored = usePortfolioStore.getState().portfolios[created.id].portfolio;
    const { v4DebtStateUpdatedAt, v4CollateralRiskUpdatedAt, ...withoutFreshness } =
      stored as unknown as Record<string, unknown> & {
        v4DebtStateUpdatedAt?: unknown;
        v4CollateralRiskUpdatedAt?: unknown;
      };
    void v4DebtStateUpdatedAt;
    void v4CollateralRiskUpdatedAt;
    writeRawPortfolioRecord(created.id, withoutFreshness);

    usePortfolioStore.setState(INITIAL_STATE);
    await usePortfolioStore.getState().load();

    expect(usePortfolioStore.getState().loadStatus).toBe('idle');
    const record = usePortfolioStore.getState().portfolios[created.id].portfolio;
    expect(record.v4DebtState).toEqual(VALID_V4_DEBT_STATE);
    expect(record.v4DebtStateUpdatedAt).toBeUndefined();
    expect(record.v4CollateralRiskUpdatedAt).toBeUndefined();
  });
});

/**
 * `touchAaveV4DebtStateFreshness`/`touchAaveV4CollateralRiskFreshness` —
 * V4 Readiness Audit §12 P2-3. Closes a gap in the P2-1 freshness
 * guarantee above: `hooks/useAaveV4LiveSync.ts`/
 * `useAaveV4CollateralRiskLiveSync.ts`'s own "live→live, fetch confirms
 * the SAME value" branch skips the canonical `setAaveV4DebtState`/
 * `setAaveV4CollateralRisk` write entirely (to avoid needlessly bumping
 * `Portfolio.updatedAt` and clearing an open Preview / triggering a false
 * `driftNotice`) — which previously ALSO silently skipped refreshing the
 * freshness timestamp, even though a genuine, fresh, successful fetch had
 * just landed. These two actions refresh the timestamp alone.
 */
describe('usePortfolioStore.touchAaveV4DebtStateFreshness / touchAaveV4CollateralRiskFreshness (P2-3)', () => {
  it('touchAaveV4DebtStateFreshness refreshes v4DebtStateUpdatedAt without touching v4DebtState, v4DebtStateSource, or Portfolio.updatedAt', async () => {
    const created = createValidPortfolio();
    const withState = usePortfolioStore
      .getState()
      .setAaveV4DebtState(created.id, VALID_V4_DEBT_STATE, 'live');
    if (!withState.ok) throw new Error('setup failed');
    const stampBefore = withState.data.v4DebtStateUpdatedAt;
    const updatedAtBefore = withState.data.updatedAt;
    await new Promise((resolve) => setTimeout(resolve, 5));

    usePortfolioStore.getState().touchAaveV4DebtStateFreshness(created.id);

    const after = usePortfolioStore.getState().portfolios[created.id].portfolio;
    expect(after.v4DebtStateUpdatedAt).not.toBe(stampBefore);
    expect(after.v4DebtState).toEqual(VALID_V4_DEBT_STATE);
    expect(after.v4DebtStateSource).toBe('live');
    expect(after.updatedAt).toBe(updatedAtBefore);
  });

  it('touchAaveV4CollateralRiskFreshness refreshes v4CollateralRiskUpdatedAt without touching v4CollateralRisk, v4CollateralRiskSource, or Portfolio.updatedAt', async () => {
    const created = createValidPortfolio();
    const withRisk = usePortfolioStore
      .getState()
      .setAaveV4CollateralRisk(created.id, VALID_V4_COLLATERAL_RISK, 'live');
    if (!withRisk.ok) throw new Error('setup failed');
    const stampBefore = withRisk.data.v4CollateralRiskUpdatedAt;
    const updatedAtBefore = withRisk.data.updatedAt;
    await new Promise((resolve) => setTimeout(resolve, 5));

    usePortfolioStore.getState().touchAaveV4CollateralRiskFreshness(created.id);

    const after = usePortfolioStore.getState().portfolios[created.id].portfolio;
    expect(after.v4CollateralRiskUpdatedAt).not.toBe(stampBefore);
    expect(after.v4CollateralRisk).toEqual(VALID_V4_COLLATERAL_RISK);
    expect(after.v4CollateralRiskSource).toBe('live');
    expect(after.updatedAt).toBe(updatedAtBefore);
  });

  it('touchAaveV4DebtStateFreshness is a no-op when the portfolio has no v4DebtState at all', () => {
    const created = createValidPortfolio();
    usePortfolioStore.getState().touchAaveV4DebtStateFreshness(created.id);
    const after = usePortfolioStore.getState().portfolios[created.id].portfolio;
    expect(after.v4DebtStateUpdatedAt).toBeUndefined();
  });

  it('touchAaveV4CollateralRiskFreshness is a no-op when the portfolio has no v4CollateralRisk at all', () => {
    const created = createValidPortfolio();
    usePortfolioStore.getState().touchAaveV4CollateralRiskFreshness(created.id);
    const after = usePortfolioStore.getState().portfolios[created.id].portfolio;
    expect(after.v4CollateralRiskUpdatedAt).toBeUndefined();
  });

  it('touchAaveV4DebtStateFreshness is a no-op for a missing portfolio id (does not throw)', () => {
    expect(() =>
      usePortfolioStore.getState().touchAaveV4DebtStateFreshness('missing-id'),
    ).not.toThrow();
  });

  it('the refreshed v4DebtStateUpdatedAt survives a full persistence round-trip (reload)', async () => {
    const created = createValidPortfolio();
    const withState = usePortfolioStore
      .getState()
      .setAaveV4DebtState(created.id, VALID_V4_DEBT_STATE, 'live');
    if (!withState.ok) throw new Error('setup failed');
    await new Promise((resolve) => setTimeout(resolve, 5));

    usePortfolioStore.getState().touchAaveV4DebtStateFreshness(created.id);
    const stamp =
      usePortfolioStore.getState().portfolios[created.id].portfolio.v4DebtStateUpdatedAt;
    await autoSaveCoordinator.flushAll();

    usePortfolioStore.setState(INITIAL_STATE);
    await usePortfolioStore.getState().load();

    const record = usePortfolioStore.getState().portfolios[created.id].portfolio;
    expect(record.v4DebtStateUpdatedAt).toBe(stamp);
  });
});

/**
 * Persistence + canonical debt reconciliation integration — V4 Readiness
 * Audit §12 Stage 9. Ties Stage 5/6 (persistence), Stage 7 (live sync's
 * own eventual `setAaveV4DebtState` caller), and Stage 9 (canonical debt)
 * together: a V4 portfolio's `v4DebtState`, once persisted and reloaded
 * exactly as a real page refresh would produce it, still drives
 * `calculatePortfolioSummary`'s canonical debt — proving the
 * reconciliation isn't something that only works on the in-memory object
 * that was just mutated, but on genuinely-reloaded, disk-round-tripped
 * data too.
 */
describe('Portfolio identity persistence + canonical debt reconciliation (Stage 9)', () => {
  it("a reloaded V4 portfolio's summary uses the persisted v4DebtState total, not legacy debt.balance", async () => {
    const created = usePortfolioStore.getState().create({
      name: 'V4 Portfolio',
      baseCurrency: 'USD',
      collateral: { asset: 'BTC', quantity: 2 },
      debt: { asset: 'USDC', balance: 999999 }, // deliberately stale/disagreeing.
      market: { btcPriceUsd: 50000 },
      protocol: {
        maxLoanToValue: 0.75,
        liquidationThreshold: 0.8,
        borrowApr: 0.05,
        supplyApr: 0.02,
      },
      settings: {},
    });
    if (!created.ok) throw new Error('setup failed');

    usePortfolioStore.getState().setProtocolVersion(created.data.id, 'v4');
    usePortfolioStore.getState().setAaveV4DebtState(created.data.id, {
      drawnDebt: 15000,
      premiumDebt: 500,
      baseDrawnApr: 0.05,
      riskPremium: 0.01,
      debtAssetPriceUsd: 1.0,
    });
    usePortfolioStore.getState().setAaveV4CollateralRisk(created.data.id, VALID_V4_COLLATERAL_RISK);
    await autoSaveCoordinator.flushAll();

    // Simulate a page refresh: wipe in-memory state, hydrate purely from
    // local storage.
    usePortfolioStore.setState(INITIAL_STATE);
    await usePortfolioStore.getState().load();

    const reloaded = usePortfolioStore.getState().portfolios[created.data.id].portfolio;
    expect(reloaded.v4DebtState).toEqual({
      drawnDebt: 15000,
      premiumDebt: 500,
      baseDrawnApr: 0.05,
      riskPremium: 0.01,
      debtAssetPriceUsd: 1.0,
    });

    const summary = calculatePortfolioSummary(reloaded, 'live');
    expect(summary.ok).toBe(true);
    if (!summary.ok) return;
    expect(summary.data.debtValue).toBe(15500);
    expect(summary.data.debtValue).not.toBe(999999);
  });

  it('a reloaded V4 portfolio with no synced v4DebtState still fails closed after reload (not silently readable via stale debt.balance)', async () => {
    const created = usePortfolioStore.getState().create({
      name: 'V4 Portfolio (unsynced)',
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
    });
    if (!created.ok) throw new Error('setup failed');

    usePortfolioStore.getState().setProtocolVersion(created.data.id, 'v4');
    await autoSaveCoordinator.flushAll();

    usePortfolioStore.setState(INITIAL_STATE);
    await usePortfolioStore.getState().load();

    const reloaded = usePortfolioStore.getState().portfolios[created.data.id].portfolio;
    expect(reloaded.v4DebtState).toBeUndefined();

    const summary = calculatePortfolioSummary(reloaded, 'live');
    expect(summary.ok).toBe(false);
    if (summary.ok) return;
    expect(summary.errors[0]).toMatchObject({ code: 'AAVE_V4_DEBT_STATE_MISSING' });
  });
});

/**
 * V3/V4 multi-portfolio isolation — regression coverage for manually
 * verified behavior (no implementation change; `portfolios` is already a
 * `Record<string, PortfolioRecord>` keyed by id with every V4 field living
 * on the individual record, and `select` only ever reassigns
 * `activePortfolioId` — see that action's own comment). These tests pin
 * that two independently-configured portfolios — one V4, one V3 — survive
 * repeated switching with neither leaking into the other, at both the raw
 * stored-field level and the cached-summary level.
 */
const ISOLATION_V4_DEBT_STATE = {
  drawnDebt: 30000,
  premiumDebt: 500,
  baseDrawnApr: 0.05,
  riskPremium: 0.01,
  debtAssetPriceUsd: 1.0,
};
const ISOLATION_V4_COLLATERAL_RISK = { collateralFactor: 0.75, dynamicConfigKey: 1 };

function createIsolationV4Portfolio() {
  const created = usePortfolioStore.getState().create(
    validInput({
      collateral: { asset: 'BTC', quantity: 2 },
      // Deliberately disagrees with the real canonical V4 debt
      // (drawnDebt + premiumDebt = 30500) — proves the summary reads the
      // canonical V4 total, not this stale legacy field.
      debt: { asset: 'USDC', balance: 999999 },
      market: { btcPriceUsd: 60000 },
      // liquidationThreshold (0.9) deliberately disagrees with
      // v4CollateralRisk.collateralFactor (0.75) below — proves Health
      // Factor uses the V4-specific fraction, never this V3 field.
      protocol: {
        maxLoanToValue: 0.7,
        liquidationThreshold: 0.9,
        borrowApr: 0.05,
        supplyApr: 0.02,
      },
    }),
  );
  if (!created.ok) throw new Error('setup failed');
  const id = created.data.id;
  usePortfolioStore.getState().setProtocolVersion(id, 'v4');
  usePortfolioStore
    .getState()
    .setAaveV4Position(id, { userAddress: VALID_V4_ADDRESS as `0x${string}` });
  usePortfolioStore.getState().setAaveV4DebtState(id, ISOLATION_V4_DEBT_STATE);
  usePortfolioStore.getState().setAaveV4CollateralRisk(id, ISOLATION_V4_COLLATERAL_RISK);
  return id;
}

function createIsolationV3Portfolio() {
  const created = usePortfolioStore.getState().create(
    validInput({
      collateral: { asset: 'BTC', quantity: 1.5 },
      debt: { asset: 'USDC', balance: 26000 },
      market: { btcPriceUsd: 50000 },
      protocol: {
        maxLoanToValue: 0.7,
        liquidationThreshold: 0.8,
        borrowApr: 0.05,
        supplyApr: 0.02,
      },
    }),
  );
  if (!created.ok) throw new Error('setup failed');
  return created.data.id;
}

describe('usePortfolioStore — V3/V4 multi-portfolio isolation (regression)', () => {
  it('preserves each portfolio’s own V3/V4 fields exactly across repeated switching, with no cross-contamination', () => {
    const v4Id = createIsolationV4Portfolio();
    const v3Id = createIsolationV3Portfolio();

    usePortfolioStore.getState().select(v4Id);
    expect(usePortfolioStore.getState().activePortfolioId).toBe(v4Id);
    expect(usePortfolioStore.getState().portfolios[v4Id].portfolio.v4DebtState).toEqual(
      ISOLATION_V4_DEBT_STATE,
    );

    usePortfolioStore.getState().select(v3Id);
    expect(usePortfolioStore.getState().activePortfolioId).toBe(v3Id);
    const v3WhileActive = usePortfolioStore.getState().portfolios[v3Id].portfolio;
    expect(v3WhileActive.debt.balance).toBe(26000);
    expect(v3WhileActive.protocolVersion).toBeUndefined();
    expect(v3WhileActive.v4DebtState).toBeUndefined();

    // The V4 portfolio's own record must be completely untouched merely by
    // switching away from it.
    const v4WhileInactive = usePortfolioStore.getState().portfolios[v4Id].portfolio;
    expect(v4WhileInactive.v4DebtState).toEqual(ISOLATION_V4_DEBT_STATE);
    expect(v4WhileInactive.v4CollateralRisk).toEqual(ISOLATION_V4_COLLATERAL_RISK);
    expect(v4WhileInactive.protocolVersion).toBe('v4');

    usePortfolioStore.getState().select(v4Id);
    expect(usePortfolioStore.getState().activePortfolioId).toBe(v4Id);
    const v4Restored = usePortfolioStore.getState().portfolios[v4Id].portfolio;
    expect(v4Restored.v4DebtState).toEqual(ISOLATION_V4_DEBT_STATE);
    expect(v4Restored.v4CollateralRisk).toEqual(ISOLATION_V4_COLLATERAL_RISK);
    expect(v4Restored.protocolVersion).toBe('v4');

    // The V3 portfolio must likewise be completely untouched by switching
    // away from it and back to the V4 portfolio.
    const v3StillInactive = usePortfolioStore.getState().portfolios[v3Id].portfolio;
    expect(v3StillInactive.debt.balance).toBe(26000);
  });

  it('recomputes Health Factor/debt from each portfolio’s own protocol parameters, never leaking V4’s collateralFactor into V3 math or vice versa', () => {
    const v4Id = createIsolationV4Portfolio();
    const v3Id = createIsolationV3Portfolio();

    const v4Summary = usePortfolioStore.getState().portfolios[v4Id].summary;
    expect(v4Summary.ok).toBe(true);
    if (!v4Summary.ok) return;
    // Canonical V4 debt (drawnDebt + premiumDebt), not the stale legacy
    // debt.balance (999999) set above.
    expect(v4Summary.data.debtValue).toBe(30500);
    // Uses v4CollateralRisk.collateralFactor (0.75), never
    // protocol.liquidationThreshold (0.9).
    expect(v4Summary.data.healthFactor).toBeCloseTo((2 * 60000 * 0.75) / 30500, 9);

    const v3Summary = usePortfolioStore.getState().portfolios[v3Id].summary;
    expect(v3Summary.ok).toBe(true);
    if (!v3Summary.ok) return;
    expect(v3Summary.data.debtValue).toBe(26000);
    expect(v3Summary.data.healthFactor).toBeCloseTo((1.5 * 50000 * 0.8) / 26000, 9);

    // `select` only ever reassigns `activePortfolioId` (see its own
    // comment) — repeated switching must never recompute or cross either
    // portfolio's already-cached summary.
    usePortfolioStore.getState().select(v3Id);
    usePortfolioStore.getState().select(v4Id);
    usePortfolioStore.getState().select(v3Id);
    expect(usePortfolioStore.getState().portfolios[v4Id].summary).toEqual(v4Summary);
    expect(usePortfolioStore.getState().portfolios[v3Id].summary).toEqual(v3Summary);
  });
});

/**
 * V1.1 Batch 2 ("Portfolio History & Risk Timeline") — trigger wiring.
 * `attemptHistorySnapshot`/`deletePortfolioHistoryForPortfolio` are
 * fire-and-forget (`void`, never awaited by the synchronous Store action
 * that calls them — see `stores/portfolioStore.ts`'s own comment), so
 * every assertion here polls via `vi.waitFor` rather than asserting
 * immediately after the store action returns.
 */
async function waitForHistoryLength(portfolioId: string, length: number) {
  await vi.waitFor(async () => {
    const listed = await listPortfolioHistoryForPortfolio(portfolioId);
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.data).toHaveLength(length);
  });
}

describe('usePortfolioStore — Portfolio History trigger wiring (V1.1 Batch 2)', () => {
  it('create() records a first history entry', async () => {
    const created = createValidPortfolio();
    await waitForHistoryLength(created.id, 1);
  });

  it('update() records a second entry once the update materially changes the portfolio', async () => {
    const created = createValidPortfolio();
    await waitForHistoryLength(created.id, 1);

    usePortfolioStore.getState().update(created.id, { market: { btcPriceUsd: 60000 } });
    await waitForHistoryLength(created.id, 2);
  });

  it('update() does not record a duplicate entry for a name-only edit (dedup — no risk metric moved)', async () => {
    const created = createValidPortfolio();
    await waitForHistoryLength(created.id, 1);

    usePortfolioStore.getState().update(created.id, { name: 'Renamed' });
    // Give the fire-and-forget attempt a real chance to run before
    // asserting the negative — `waitForHistoryLength` above already
    // proves the mechanism itself works, so this is not racing a slow
    // write, it is confirming no write happens at all.
    await new Promise((resolve) => setTimeout(resolve, 50));
    const listed = await listPortfolioHistoryForPortfolio(created.id);
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.data).toHaveLength(1);
  });

  it('delete() removes all of that portfolio’s history entries', async () => {
    const created = createValidPortfolio();
    await waitForHistoryLength(created.id, 1);

    usePortfolioStore.getState().delete(created.id);
    await waitForHistoryLength(created.id, 0);
  });

  it('archive() does not touch history (data is retained, not deleted)', async () => {
    const created = createValidPortfolio();
    await waitForHistoryLength(created.id, 1);

    usePortfolioStore.getState().archive(created.id);
    await new Promise((resolve) => setTimeout(resolve, 50));
    const listed = await listPortfolioHistoryForPortfolio(created.id);
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.data).toHaveLength(1);
  });

  it('duplicate() starts the copy with no history of its own', async () => {
    const created = createValidPortfolio();
    await waitForHistoryLength(created.id, 1);

    const duplicated = usePortfolioStore.getState().duplicate(created.id);
    expect(duplicated.ok).toBe(true);
    if (!duplicated.ok) return;

    await new Promise((resolve) => setTimeout(resolve, 50));
    const listed = await listPortfolioHistoryForPortfolio(duplicated.data.id);
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.data).toHaveLength(0);
    // The original's own history is untouched by duplication.
    const originalListed = await listPortfolioHistoryForPortfolio(created.id);
    expect(originalListed.ok && originalListed.data).toHaveLength(1);
  });

  it('setMarket() records an entry on a manual-to-live acceptance, but not on a repeated silent live refresh', async () => {
    const created = createValidPortfolio();
    await waitForHistoryLength(created.id, 1);

    // First live write: marketSource was 'manual' at creation -> not a
    // silent refresh, a snapshot is attempted (and material, since the
    // price actually changed).
    usePortfolioStore.getState().setMarket(created.id, { btcPriceUsd: 55000 });
    await waitForHistoryLength(created.id, 2);

    // Second live write with an unchanged price, simulating the live-sync
    // hook's own silent refresh tick (source stays 'live' on both sides)
    // — `isSilentLiveRefresh` must suppress the attempt entirely.
    usePortfolioStore.getState().setMarket(created.id, { btcPriceUsd: 55000 });
    await new Promise((resolve) => setTimeout(resolve, 50));
    const listed = await listPortfolioHistoryForPortfolio(created.id);
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.data).toHaveLength(2);
  });

  it('setAaveV4DebtState() records an entry when a real value is set, but never on a clear', async () => {
    const created = createValidPortfolio();
    await waitForHistoryLength(created.id, 1);

    // `protocolVersion`/`v4CollateralRisk` must be set first — otherwise
    // (per "no cross-inference") `calculatePortfolioSummary` still
    // resolves this portfolio's debt from the legacy V3 `debt.balance`,
    // so a bare `setAaveV4DebtState` call alone produces a candidate
    // entry identical to the one already recorded and is correctly
    // deduped, not skipped by the trigger itself.
    usePortfolioStore.getState().setProtocolVersion(created.id, 'v4');
    usePortfolioStore
      .getState()
      .setAaveV4CollateralRisk(created.id, VALID_V4_COLLATERAL_RISK, 'manual');
    await new Promise((resolve) => setTimeout(resolve, 50));
    // Neither call above records an entry yet: `setProtocolVersion` never
    // triggers a snapshot at all, and `setAaveV4CollateralRisk`'s own
    // attempt no-ops because `calculatePortfolioSummary` still fails
    // closed (v4DebtState is not set yet).
    const beforeDebtState = await listPortfolioHistoryForPortfolio(created.id);
    expect(beforeDebtState.ok && beforeDebtState.data).toHaveLength(1);

    usePortfolioStore.getState().setAaveV4DebtState(created.id, VALID_V4_DEBT_STATE, 'manual');
    await waitForHistoryLength(created.id, 2);

    usePortfolioStore.getState().setAaveV4DebtState(created.id, undefined);
    await new Promise((resolve) => setTimeout(resolve, 50));
    const listed = await listPortfolioHistoryForPortfolio(created.id);
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.data).toHaveLength(2);
  });

  it('keeps multiple portfolios’ history fully isolated across several trigger points', async () => {
    const a = createValidPortfolio();
    const b = createValidPortfolio();
    await waitForHistoryLength(a.id, 1);
    await waitForHistoryLength(b.id, 1);

    usePortfolioStore.getState().setMarket(a.id, { btcPriceUsd: 61000 });
    await waitForHistoryLength(a.id, 2);

    const listedB = await listPortfolioHistoryForPortfolio(b.id);
    expect(listedB.ok).toBe(true);
    if (!listedB.ok) return;
    expect(listedB.data).toHaveLength(1);
  });

  it('records V3/V4 protocolVersion on each entry, matching the portfolio that produced it', async () => {
    const v3 = createValidPortfolio();
    await waitForHistoryLength(v3.id, 1);
    const v3Listed = await listPortfolioHistoryForPortfolio(v3.id);
    expect(v3Listed.ok && v3Listed.data[0]?.payload.protocolVersion).toBe('v3');

    const v4 = createValidPortfolio();
    usePortfolioStore.getState().setProtocolVersion(v4.id, 'v4');
    usePortfolioStore.getState().setAaveV4CollateralRisk(v4.id, VALID_V4_COLLATERAL_RISK, 'manual');
    usePortfolioStore.getState().setAaveV4DebtState(v4.id, VALID_V4_DEBT_STATE, 'manual');
    await waitForHistoryLength(v4.id, 2);
    const v4Listed = await listPortfolioHistoryForPortfolio(v4.id);
    // `.find()`, not `data[0]` — the initial (v3) and the V4-triggered
    // entry can land in the same millisecond in a fast test run, and
    // `listPortfolioHistoryForPortfolio`'s sort is only as precise as
    // `createdAt` itself; what this test actually needs to prove is that
    // one recorded entry for this portfolio carries `'v4'`, not which
    // array index it lands at.
    expect(v4Listed.ok).toBe(true);
    if (!v4Listed.ok) return;
    expect(v4Listed.data.map((e) => e.payload.protocolVersion).sort()).toEqual(['v3', 'v4']);
  });
});

/**
 * V1.1 Batch 3 ("Apply to Portfolio") — `applyPortfolioState`. Proposals
 * are constructed directly here (a plain `PortfolioApplyProposal`
 * object, using the real `calculatePortfolioSummary` for `before`/
 * `after`) rather than via `services/portfolioApply`'s own builders —
 * the same "isolate the layer under test" discipline every other test in
 * this file already follows (`validInput()` fixtures, not real
 * Loop/Simulation results). `services/portfolioApply`'s own tests prove
 * the builders themselves produce a correct proposal; these tests prove
 * the Store correctly turns any well-formed proposal into a real state
 * change.
 */
function applyProposalFor(
  portfolio: Portfolio,
  overrides: Partial<PortfolioApplyProposal> = {},
): PortfolioApplyProposal {
  const proposedPortfolio = {
    ...portfolio,
    collateral: { asset: portfolio.collateral.asset, quantity: 3 },
    debt: { asset: portfolio.debt.asset, balance: 30000 },
  };
  const before = calculatePortfolioSummary(portfolio, 'manual');
  const after = calculatePortfolioSummary(proposedPortfolio, 'manual');
  if (!before.ok || !after.ok) throw new Error('setup failed: expected summaries to succeed');

  return {
    sourceWorkflow: 'loopBuilder',
    portfolioId: portfolio.id,
    sourcePortfolioUpdatedAt: portfolio.updatedAt,
    protocolVersion: portfolio.protocolVersion === 'v4' ? 'v4' : 'v3',
    proposedPortfolio,
    unchangedAssumptions: ['Market price'],
    before: before.data,
    after: after.data,
    valueBasis: 'hypothetical',
    generatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('usePortfolioStore.applyPortfolioState (V1.1 Batch 3)', () => {
  it('writes the proposed collateral/debt and bumps updatedAt', () => {
    const created = createValidPortfolio();
    const proposal = applyProposalFor(created);

    const result = usePortfolioStore.getState().applyPortfolioState(proposal);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.collateral.quantity).toBe(3);
    expect(result.data.debt.balance).toBe(30000);
    expect(result.data.updatedAt).not.toBe(created.updatedAt);

    const record = usePortfolioStore.getState().portfolios[created.id];
    expect(record.summary.ok).toBe(true);
    if (!record.summary.ok) return;
    expect(record.summary.data.debtValue).toBe(30000);
  });

  it('fails for a portfolio that does not exist', () => {
    const created = createValidPortfolio();
    const proposal = applyProposalFor(created, { portfolioId: 'missing-id' });
    const result = usePortfolioStore.getState().applyPortfolioState(proposal);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]?.code).toBe('PORTFOLIO_NOT_FOUND');
  });

  it('Section 9 — refuses a stale proposal (portfolio changed since it was generated), and does not mutate the portfolio', () => {
    const created = createValidPortfolio();
    const proposal = applyProposalFor(created);
    // A forced later system time, not just a second `update()` call —
    // `updatedAt` is millisecond-precision and a same-tick create+update
    // in a fast test run can otherwise land on the identical timestamp,
    // which would make this test pass for the wrong reason (a real clock
    // gap, not the staleness check itself). Same pattern this file's own
    // `marketUpdatedAt`/`protocolUpdatedAt` tests already use.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.parse(created.updatedAt) + 60_000));
    // The portfolio changes after the proposal was built (e.g. a name edit).
    usePortfolioStore.getState().update(created.id, { name: 'Renamed after proposal' });
    vi.useRealTimers();

    const result = usePortfolioStore.getState().applyPortfolioState(proposal);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]?.code).toBe('PORTFOLIO_APPLY_STALE_RESULT');

    const record = usePortfolioStore.getState().portfolios[created.id];
    expect(record.portfolio.collateral.quantity).toBe(created.collateral.quantity);
    expect(record.portfolio.debt.balance).toBe(created.debt.balance);
  });

  it('Section 2 — refuses a proposal built for the other protocol version, and does not mutate the portfolio', () => {
    const created = createValidPortfolio();
    const proposal = applyProposalFor(created, { protocolVersion: 'v4' });

    const result = usePortfolioStore.getState().applyPortfolioState(proposal);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]?.code).toBe('PORTFOLIO_APPLY_PROTOCOL_VERSION_MISMATCH');

    const record = usePortfolioStore.getState().portfolios[created.id];
    expect(record.portfolio.collateral.quantity).toBe(created.collateral.quantity);
  });

  it('Section 8 — a V4 proposal writes v4DebtStateSource "manual", never "live", and clears any pending live candidate', () => {
    const created = createValidPortfolio();
    usePortfolioStore.getState().setProtocolVersion(created.id, 'v4');
    usePortfolioStore
      .getState()
      .setAaveV4CollateralRisk(created.id, VALID_V4_COLLATERAL_RISK, 'manual');
    // 'manual' (not 'live') — a live-sourced v4DebtState with no
    // authoritative debtAssetPriceUsd fails closed
    // (AAVE_V4_DEBT_ASSET_PRICE_MISSING); this test's own concern is
    // provenance after Apply, not live-price validation.
    usePortfolioStore.getState().setAaveV4DebtState(created.id, VALID_V4_DEBT_STATE, 'manual');
    usePortfolioStore.getState().setAaveV4DebtStateCandidate(created.id, {
      ...VALID_V4_DEBT_STATE,
      drawnDebt: 99999,
    });
    const current = usePortfolioStore.getState().portfolios[created.id].portfolio;

    const proposedV4DebtState = {
      drawnDebt: 5000,
      premiumDebt: 100,
      baseDrawnApr: 0.05,
      riskPremium: 0.01,
    };
    const proposal = applyProposalFor(current, {
      protocolVersion: 'v4',
      proposedPortfolio: {
        ...current,
        collateral: { asset: current.collateral.asset, quantity: 3 },
        debt: { asset: current.debt.asset, balance: 5100 },
        v4DebtState: proposedV4DebtState,
      },
    });

    const result = usePortfolioStore.getState().applyPortfolioState(proposal);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.v4DebtState).toEqual(proposedV4DebtState);
    expect(result.data.v4DebtStateSource).toBe('manual');
    expect(usePortfolioStore.getState().v4DebtStateCandidates[created.id]).toBeUndefined();
  });

  it('Section 6 — a full-repay proposal produces a real Infinity Health Factor, not a fabricated finite one', () => {
    const created = createValidPortfolio();
    const proposal = applyProposalFor(created, {
      proposedPortfolio: {
        ...created,
        collateral: created.collateral,
        debt: { asset: created.debt.asset, balance: 0 },
      },
    });

    const result = usePortfolioStore.getState().applyPortfolioState(proposal);
    expect(result.ok).toBe(true);

    const record = usePortfolioStore.getState().portfolios[created.id];
    expect(record.summary.ok).toBe(true);
    if (!record.summary.ok) return;
    expect(record.summary.data.healthFactor).toBe(Infinity);
    expect(record.summary.data.liquidation).toBeNull();
  });

  it('V1.1 Batch 4 — a full-exit proposal (zero collateral AND zero debt) applies successfully, never failing on the leverage step, and its history snapshot has leverage 0 / null Health Factor', async () => {
    const created = createValidPortfolio();
    await waitForHistoryLength(created.id, 1);

    const proposal = applyProposalFor(created, {
      proposedPortfolio: {
        ...created,
        collateral: { asset: created.collateral.asset, quantity: 0 },
        debt: { asset: created.debt.asset, balance: 0 },
      },
    });

    const result = usePortfolioStore.getState().applyPortfolioState(proposal);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.collateral.quantity).toBe(0);
    expect(result.data.debt.balance).toBe(0);

    const record = usePortfolioStore.getState().portfolios[created.id];
    expect(record.summary.ok).toBe(true);
    if (!record.summary.ok) return;
    expect(record.summary.data.collateralValue).toBe(0);
    expect(record.summary.data.debtValue).toBe(0);
    expect(record.summary.data.leverage).toBe(0);
    expect(record.summary.data.healthFactor).toBe(Infinity);
    expect(record.summary.data.liquidation).toBeNull();
    expect(Number.isNaN(record.summary.data.leverage)).toBe(false);

    await waitForHistoryLength(created.id, 2);
    const listed = await listPortfolioHistoryForPortfolio(created.id);
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    const latest = listed.data[0].payload;
    expect(latest.leverage).toBe(0);
    expect(latest.healthFactor).toBeNull();
  });

  it('Section 7 — creates exactly one history snapshot on success', async () => {
    const created = createValidPortfolio();
    await waitForHistoryLength(created.id, 1);

    const proposal = applyProposalFor(created);
    usePortfolioStore.getState().applyPortfolioState(proposal);
    await waitForHistoryLength(created.id, 2);

    // No further snapshot from a stale/duplicate re-apply attempt of the
    // SAME (now-stale) proposal — it is refused outright (Section 9),
    // never reaching the point where a snapshot could be taken.
    const reapplied = usePortfolioStore.getState().applyPortfolioState(proposal);
    expect(reapplied.ok).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 50));
    const listed = await listPortfolioHistoryForPortfolio(created.id);
    expect(listed.ok && listed.data).toHaveLength(2);
  });

  it('Section 9 — applying to one portfolio never affects another (portfolio isolation)', () => {
    const a = createValidPortfolio();
    const b = createValidPortfolio();
    const proposal = applyProposalFor(a);

    usePortfolioStore.getState().applyPortfolioState(proposal);

    const recordB = usePortfolioStore.getState().portfolios[b.id];
    expect(recordB.portfolio.collateral.quantity).toBe(b.collateral.quantity);
    expect(recordB.portfolio.debt.balance).toBe(b.debt.balance);
    expect(recordB.portfolio.updatedAt).toBe(b.updatedAt);
  });
});

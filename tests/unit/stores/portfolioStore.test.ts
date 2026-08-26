import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { autoSaveCoordinator, calculatePortfolioSummary } from '@/services';
import { buildLocalStorageKey } from '@/services/persistence/adapters/localStorageKeys';
import { computeChecksum } from '@/services/persistence/envelope';
import { usePortfolioStore } from '@/stores/portfolioStore';

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

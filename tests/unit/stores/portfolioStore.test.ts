import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
});

function validInput() {
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

describe('usePortfolioStore.load (M4-003, Conflict B)', () => {
  it('transitions loadStatus back to idle synchronously (no persistence backend exists yet)', () => {
    usePortfolioStore.getState().load();
    expect(usePortfolioStore.getState().loadStatus).toBe('idle');
  });

  it('never populates portfolios, since there is nothing to load from', () => {
    usePortfolioStore.getState().load();
    expect(usePortfolioStore.getState().portfolios).toEqual({});
  });
});

describe('usePortfolioStore — lastSynchronizedAt honesty (M4-003, Conflict B)', () => {
  it('lastSynchronizedAt stays null after a successful create', () => {
    usePortfolioStore.getState().create(validInput());
    expect(usePortfolioStore.getState().lastSynchronizedAt).toBeNull();
  });
});

describe('usePortfolioStore — saveStatus transitions (M4-013)', () => {
  it('reports "saved" after a successful create', () => {
    usePortfolioStore.getState().create(validInput());
    expect(usePortfolioStore.getState().saveStatus).toBe('saved');
  });

  it('reports "error" after a create that fails validation', () => {
    usePortfolioStore.getState().create({ name: '' });
    expect(usePortfolioStore.getState().saveStatus).toBe('error');
  });

  it('transitions through "saving" before settling — observable via direct subscription, not just the final getState()', () => {
    const seen: string[] = [];
    const unsubscribe = usePortfolioStore.subscribe((state) => seen.push(state.saveStatus));
    usePortfolioStore.getState().create(validInput());
    unsubscribe();
    expect(seen).toContain('saving');
    expect(seen[seen.length - 1]).toBe('saved');
  });

  it('reports "saved" after a successful update, and "error" after one that fails validation', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');

    usePortfolioStore.getState().update(created.data.id, { name: 'Renamed' });
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

  it('reports "saved" after a successful duplicate/archive/unarchive/delete', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');

    const duplicated = usePortfolioStore.getState().duplicate(created.data.id);
    expect(usePortfolioStore.getState().saveStatus).toBe('saved');
    if (!duplicated.ok) throw new Error('setup failed');

    usePortfolioStore.getState().archive(duplicated.data.id);
    expect(usePortfolioStore.getState().saveStatus).toBe('saved');

    usePortfolioStore.getState().unarchive(duplicated.data.id);
    expect(usePortfolioStore.getState().saveStatus).toBe('saved');

    usePortfolioStore.getState().delete(duplicated.data.id);
    expect(usePortfolioStore.getState().saveStatus).toBe('saved');
  });

  it('never reaches "offline" — no network dependency exists to go offline from (conflict #28)', () => {
    usePortfolioStore.getState().create(validInput());
    expect(usePortfolioStore.getState().saveStatus).not.toBe('offline');
  });

  it('select/load never change saveStatus — neither one persists anything', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.setState({ saveStatus: 'idle' });

    usePortfolioStore.getState().select(created.data.id);
    expect(usePortfolioStore.getState().saveStatus).toBe('idle');

    usePortfolioStore.getState().load();
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

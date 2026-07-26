import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { usePortfolioStore } from '@/stores/portfolioStore';

/**
 * Portfolio Workflow Integration Tests — 06_TASKS.md M4-018 ("Create
 * Portfolio Workflow Tests"): "Test complete portfolio-management
 * workflows." Dependencies: "M4-005 through M4-017" (every Milestone 4
 * UI/Store task). DoD: "Critical portfolio workflows pass in
 * integration and Playwright tests."
 *
 * **Two distinct test layers, per the DoD's own wording — this file is
 * the "integration" half; `tests/e2e/portfolioWorkflows.spec.ts` is the
 * "Playwright" half.** This file follows the exact precedent
 * `tests/integration/services/coreWorkflows.test.ts` (M3-014) already
 * established: chain real, non-mocked calls together across multiple
 * steps to prove a *workflow* holds end-to-end, one `describe` block per
 * item in the task's own "Cover" list, in order — not a new UI-rendering
 * layer. `app/portfolio/page.tsx`/`app/portfolios/page.tsx` and their
 * own extensive per-page unit test suites (Batches 1–9, ~180 tests
 * across 5 files) already exhaustively cover individual field
 * validation, error rendering, and single-action behavior in isolation;
 * duplicating that here at the React-rendering level would test nothing
 * new. What *is* new here: multi-step sequences spanning several Store
 * actions in one continuous test (e.g. create → edit → duplicate →
 * archive → delete, verifying state at each step), which no existing
 * per-action unit test exercises end-to-end.
 *
 * `usePortfolioStore` is a module-level Zustand singleton — reset to
 * initial state before each test, the same pattern every Store-backed
 * test file in this project already uses.
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
  usePortfolioStore.setState(INITIAL_STATE);
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

describe('Cover: Create first portfolio (M4-018)', () => {
  it('creating a portfolio into an empty Store makes it the only entry, active, and correctly summarized', () => {
    const store = usePortfolioStore.getState();
    expect(Object.keys(store.portfolios)).toHaveLength(0);

    const created = usePortfolioStore.getState().create(validInput({ name: 'Alpha' }));
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    usePortfolioStore.getState().select(created.data.id);

    const state = usePortfolioStore.getState();
    expect(Object.keys(state.portfolios)).toHaveLength(1);
    expect(state.activePortfolioId).toBe(created.data.id);
    const record = state.portfolios[created.data.id];
    expect(record.summary.ok).toBe(true);
    if (!record.summary.ok) return;
    expect(record.summary.data.netEquity).toBe(80000);
  });
});

describe('Cover: Create second portfolio (M4-018)', () => {
  it('creating a second portfolio leaves the first fully intact and does not auto-switch the active selection', () => {
    const first = usePortfolioStore.getState().create(validInput({ name: 'Alpha' }));
    if (!first.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(first.data.id);

    const second = usePortfolioStore.getState().create(validInput({ name: 'Beta' }));
    expect(second.ok).toBe(true);
    if (!second.ok) return;

    const state = usePortfolioStore.getState();
    expect(Object.keys(state.portfolios)).toHaveLength(2);
    expect(state.portfolios[first.data.id].portfolio.name).toBe('Alpha');
    expect(state.portfolios[second.data.id].portfolio.name).toBe('Beta');
    // Creating does not implicitly select — the active portfolio is
    // still whichever one the user had selected before.
    expect(state.activePortfolioId).toBe(first.data.id);
  });
});

describe('Cover: Switch portfolios (M4-018)', () => {
  it('switching between two portfolios updates the active id without altering either record', () => {
    const first = usePortfolioStore.getState().create(validInput({ name: 'Alpha' }));
    const second = usePortfolioStore.getState().create(validInput({ name: 'Beta' }));
    if (!first.ok || !second.ok) throw new Error('setup failed');

    usePortfolioStore.getState().select(first.data.id);
    expect(usePortfolioStore.getState().activePortfolioId).toBe(first.data.id);

    usePortfolioStore.getState().select(second.data.id);
    const state = usePortfolioStore.getState();
    expect(state.activePortfolioId).toBe(second.data.id);
    // Switching is non-destructive — both records still hold their own
    // original data (M4-010's own state-isolation DoD, at the Store
    // layer rather than the component-remount layer its own unit tests
    // already cover).
    expect(state.portfolios[first.data.id].portfolio.name).toBe('Alpha');
    expect(state.portfolios[second.data.id].portfolio.name).toBe('Beta');
  });
});

describe('Cover: Edit collateral (M4-018)', () => {
  it('editing collateral recomputes the summary and leaves debt/market/protocol untouched', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');

    const updated = usePortfolioStore.getState().update(created.data.id, {
      collateral: { asset: 'BTC', quantity: 3 },
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;

    expect(updated.data.collateral.quantity).toBe(3);
    expect(updated.data.debt).toEqual(created.data.debt);
    const record = usePortfolioStore.getState().portfolios[created.data.id];
    expect(record.summary.ok).toBe(true);
    if (!record.summary.ok) return;
    // 3 BTC * $50,000 - $20,000 debt = $130,000, not the original $80,000.
    expect(record.summary.data.netEquity).toBe(130000);
  });
});

describe('Cover: Edit debt (M4-018)', () => {
  it('editing debt down to zero recomputes the summary with a null liquidation section (conflict #20 stays reachable end to end)', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');

    const updated = usePortfolioStore.getState().update(created.data.id, {
      debt: { asset: 'USDC', balance: 0 },
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;

    const record = usePortfolioStore.getState().portfolios[created.data.id];
    expect(record.summary.ok).toBe(true);
    if (!record.summary.ok) return;
    expect(record.summary.data.liquidation).toBeNull();
    expect(record.summary.data.healthFactor).toBe(Infinity);
  });
});

describe('Cover: Use manual prices (M4-018)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('updating the manual price bumps marketUpdatedAt and recomputes downstream values, leaving protocolUpdatedAt untouched', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    const originalProtocolUpdatedAt = created.data.protocolUpdatedAt;

    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.parse(created.data.marketUpdatedAt) + 60_000));
    const updated = usePortfolioStore
      .getState()
      .update(created.data.id, { market: { btcPriceUsd: 60000 } });
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;

    expect(updated.data.marketUpdatedAt).not.toBe(created.data.marketUpdatedAt);
    expect(updated.data.protocolUpdatedAt).toBe(originalProtocolUpdatedAt);
    const record = usePortfolioStore.getState().portfolios[created.data.id];
    expect(record.summary.ok).toBe(true);
    if (!record.summary.ok) return;
    // 2 BTC * $60,000 - $20,000 debt = $100,000.
    expect(record.summary.data.netEquity).toBe(100000);
  });
});

describe('Cover: Duplicate portfolio (M4-018)', () => {
  it('duplicating produces an independent copy that can be edited without affecting the source', () => {
    const source = usePortfolioStore.getState().create(validInput({ name: 'Alpha' }));
    if (!source.ok) throw new Error('setup failed');

    const duplicate = usePortfolioStore.getState().duplicate(source.data.id);
    expect(duplicate.ok).toBe(true);
    if (!duplicate.ok) return;
    expect(duplicate.data.id).not.toBe(source.data.id);
    expect(duplicate.data.name).toBe('Alpha (Copy)');

    usePortfolioStore.getState().update(duplicate.data.id, { name: 'Alpha (Edited Copy)' });

    const state = usePortfolioStore.getState();
    expect(state.portfolios[duplicate.data.id].portfolio.name).toBe('Alpha (Edited Copy)');
    expect(state.portfolios[source.data.id].portfolio.name).toBe('Alpha');
  });
});

describe('Cover: Archive portfolio (M4-018)', () => {
  it('archiving hides the portfolio from the active set, clears the active selection if it was selected, and unarchiving restores it', () => {
    const created = usePortfolioStore.getState().create(validInput({ name: 'Alpha' }));
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);

    usePortfolioStore.getState().archive(created.data.id);
    let state = usePortfolioStore.getState();
    expect(state.portfolios[created.data.id].portfolio.archivedAt).not.toBeNull();
    expect(state.activePortfolioId).toBeNull();

    usePortfolioStore.getState().unarchive(created.data.id);
    state = usePortfolioStore.getState();
    expect(state.portfolios[created.data.id].portfolio.archivedAt).toBeNull();
    // Data itself was never destroyed by archiving — it's the exact
    // same record, restorable without re-creating anything.
    expect(state.portfolios[created.data.id].portfolio.name).toBe('Alpha');
  });
});

describe('Cover: Delete portfolio (M4-018)', () => {
  it('deleting the active portfolio removes it and clears the active selection, leaving other portfolios untouched', () => {
    const first = usePortfolioStore.getState().create(validInput({ name: 'Alpha' }));
    const second = usePortfolioStore.getState().create(validInput({ name: 'Beta' }));
    if (!first.ok || !second.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(first.data.id);

    usePortfolioStore.getState().delete(first.data.id);

    const state = usePortfolioStore.getState();
    expect(state.portfolios[first.data.id]).toBeUndefined();
    expect(state.activePortfolioId).toBeNull();
    expect(state.portfolios[second.data.id].portfolio.name).toBe('Beta');
  });
});

describe('Cover: Recover from invalid input (M4-018)', () => {
  it('a rejected create leaves the Store empty, and a subsequent valid create still succeeds normally', () => {
    const invalid = usePortfolioStore.getState().create(validInput({ name: '' }));
    expect(invalid.ok).toBe(false);
    expect(Object.keys(usePortfolioStore.getState().portfolios)).toHaveLength(0);
    expect(usePortfolioStore.getState().saveStatus).toBe('error');

    const valid = usePortfolioStore.getState().create(validInput({ name: 'Recovered' }));
    expect(valid.ok).toBe(true);
    if (!valid.ok) return;
    expect(usePortfolioStore.getState().portfolios[valid.data.id].portfolio.name).toBe('Recovered');
    expect(usePortfolioStore.getState().saveStatus).toBe('saved');
  });

  it('a rejected update leaves the existing valid portfolio completely untouched, and a subsequent valid update still applies (M4-017 DoD, exercised across a full edit-reject-recover sequence)', () => {
    const created = usePortfolioStore.getState().create(validInput({ name: 'Alpha' }));
    if (!created.ok) throw new Error('setup failed');

    const rejected = usePortfolioStore.getState().update(created.data.id, {
      protocol: {
        maxLoanToValue: 0.9,
        liquidationThreshold: 0.8,
        borrowApr: 0.05,
        supplyApr: 0.02,
      },
    });
    expect(rejected.ok).toBe(false);
    expect(usePortfolioStore.getState().portfolios[created.data.id].portfolio).toEqual(
      created.data,
    );

    const recovered = usePortfolioStore.getState().update(created.data.id, { name: 'Alpha Fixed' });
    expect(recovered.ok).toBe(true);
    if (!recovered.ok) return;
    expect(usePortfolioStore.getState().portfolios[created.data.id].portfolio.name).toBe(
      'Alpha Fixed',
    );
  });

  it('a calculation failure (zero collateral with nonzero debt) recovers automatically once the position is fixed (M4-017)', () => {
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
});

import { beforeEach, describe, expect, it } from 'vitest';

import {
  buildDashboardViewModel,
  buildHealthFactorStatus,
  buildRiskWarnings,
} from '@/features/dashboard';
import { usePortfolioStore } from '@/stores/portfolioStore';

/**
 * Dashboard Integration Tests — 06_TASKS.md M5-026 ("Create Dashboard
 * Integration Tests"). Dependencies: M5-025. Description: "Test
 * Dashboard integration with Stores and Services." DoD: "Dashboard data
 * remains consistent across state transitions."
 *
 * Follows the exact precedent `tests/integration/portfolio/portfolioWorkflows.test.ts`
 * (M4-018) already established: no React rendering — chain real,
 * non-mocked Store and Dashboard-builder calls together across multiple
 * steps, one `describe` block per item in this task's own "Cover" list,
 * in order. `tests/unit/app/page.test.tsx`'s own extensive suite
 * (Batches 1–15) already exhaustively covers the Dashboard *route's*
 * rendering for every state in isolation; what is new here is following
 * one `Portfolio` record through the real `Store → Service →
 * buildDashboardViewModel` pipeline across multiple sequential
 * transitions — the same call chain `app/page.tsx` itself builds
 * (`buildDashboardViewModel` → `buildHealthFactorStatus` →
 * `buildRiskWarnings`) — which no per-component or per-page unit test
 * exercises end-to-end.
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

describe('Cover: Load active portfolio (M5-026)', () => {
  it('the Dashboard view model derives from exactly the Store’s own active record, not any other one', () => {
    const first = usePortfolioStore.getState().create(validInput({ name: 'Alpha' }));
    const second = usePortfolioStore
      .getState()
      .create(validInput({ name: 'Beta', collateral: { asset: 'BTC', quantity: 5 } }));
    if (!first.ok || !second.ok) throw new Error('setup failed');

    usePortfolioStore.getState().select(second.data.id);
    const state = usePortfolioStore.getState();
    const record =
      state.activePortfolioId !== null ? state.portfolios[state.activePortfolioId] : undefined;
    expect(record).toBeDefined();
    if (record === undefined) return;

    const viewModel = buildDashboardViewModel(record.portfolio, record.summary);
    expect(viewModel.portfolioId).toBe(second.data.id);
    expect(viewModel.portfolioName).toBe('Beta');
  });

  it('no active portfolio yields no record to build a view model from, not a crash (Conflict B: `load()` itself has nothing to load)', () => {
    usePortfolioStore.getState().create(validInput());
    // Deliberately never selected.
    const state = usePortfolioStore.getState();
    expect(state.activePortfolioId).toBeNull();
    const record =
      state.activePortfolioId !== null ? state.portfolios[state.activePortfolioId] : undefined;
    expect(record).toBeUndefined();
  });
});

describe('Cover: Generate summary (M5-026)', () => {
  it('a real Portfolio input flows through the Service and into the Dashboard view model unchanged', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);
    const record = usePortfolioStore.getState().portfolios[created.data.id];

    expect(record.summary.ok).toBe(true);
    const viewModel = buildDashboardViewModel(record.portfolio, record.summary);
    expect(viewModel.ok).toBe(true);
    if (!viewModel.ok) return;
    // 2 BTC * $50,000 - $20,000 debt = $80,000 net equity — the same real
    // Service output `tests/integration/portfolio/portfolioWorkflows.test.ts`'s
    // own "Create first portfolio" test already established at the Store
    // layer, now confirmed unchanged one layer up at the view-model layer.
    expect(viewModel.metrics.netPortfolioValue.rawValue).toBe(80000);
    expect(viewModel.metrics.healthFactor.rawValue).toBe(4);
  });
});

describe('Cover: Refresh price (M5-026)', () => {
  it('recomputeSummary re-derives the Dashboard view model from the portfolio’s current market price, not a stale cached value', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);

    const before = usePortfolioStore.getState().portfolios[created.data.id];
    const viewModelBefore = buildDashboardViewModel(before.portfolio, before.summary);
    expect(viewModelBefore.ok && viewModelBefore.metrics.netPortfolioValue.rawValue).toBe(80000);

    // Simulate the price having changed underneath the active record —
    // the same underlying field `update()` itself would change — then
    // confirm the Dashboard's own Refresh mechanism (`recomputeSummary`)
    // is what actually re-derives the summary, not a stale cached value.
    usePortfolioStore.setState((state) => ({
      portfolios: {
        ...state.portfolios,
        [created.data.id]: {
          ...state.portfolios[created.data.id],
          portfolio: {
            ...state.portfolios[created.data.id].portfolio,
            market: { btcPriceUsd: 60000 },
          },
        },
      },
    }));

    usePortfolioStore.getState().recomputeSummary(created.data.id);

    const after = usePortfolioStore.getState().portfolios[created.data.id];
    const viewModelAfter = buildDashboardViewModel(after.portfolio, after.summary);
    // 2 BTC * $60,000 - $20,000 debt = $100,000.
    expect(viewModelAfter.ok && viewModelAfter.metrics.netPortfolioValue.rawValue).toBe(100000);
  });
});

describe('Cover: Switch portfolio (M5-026)', () => {
  it('switching the active portfolio produces a fresh, independent Dashboard view model for each, in either order', () => {
    const first = usePortfolioStore.getState().create(validInput({ name: 'Alpha' }));
    const second = usePortfolioStore
      .getState()
      .create(validInput({ name: 'Beta', collateral: { asset: 'BTC', quantity: 5 } }));
    if (!first.ok || !second.ok) throw new Error('setup failed');

    usePortfolioStore.getState().select(first.data.id);
    let record = usePortfolioStore.getState().portfolios[first.data.id];
    let viewModel = buildDashboardViewModel(record.portfolio, record.summary);
    expect(viewModel.portfolioName).toBe('Alpha');
    expect(viewModel.ok && viewModel.metrics.netPortfolioValue.rawValue).toBe(80000);

    usePortfolioStore.getState().select(second.data.id);
    record = usePortfolioStore.getState().portfolios[second.data.id];
    viewModel = buildDashboardViewModel(record.portfolio, record.summary);
    expect(viewModel.portfolioName).toBe('Beta');
    // 5 BTC * $50,000 - $20,000 debt = $230,000.
    expect(viewModel.ok && viewModel.metrics.netPortfolioValue.rawValue).toBe(230000);

    // Switching back proves the first record was never mutated by the switch.
    usePortfolioStore.getState().select(first.data.id);
    record = usePortfolioStore.getState().portfolios[first.data.id];
    viewModel = buildDashboardViewModel(record.portfolio, record.summary);
    expect(viewModel.ok && viewModel.metrics.netPortfolioValue.rawValue).toBe(80000);
  });
});

describe('Cover: Display warnings (M5-026)', () => {
  it('a Health Factor below the configured target flows through to a real Risk Warning, end to end', () => {
    const created = usePortfolioStore
      .getState()
      .create(validInput({ settings: { safetyTargets: { targetHealthFactor: 5 } } }));
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);
    const record = usePortfolioStore.getState().portfolios[created.data.id];

    expect(record.summary.ok).toBe(true);
    if (!record.summary.ok) return;
    const viewModel = buildDashboardViewModel(record.portfolio, record.summary);
    expect(viewModel.ok).toBe(true);
    if (!viewModel.ok) return;

    const healthFactorStatus = buildHealthFactorStatus(record.portfolio, record.summary.data);
    const warnings = buildRiskWarnings(healthFactorStatus, viewModel.freshness, viewModel.warnings);

    expect(warnings.map((w) => w.code)).toContain('HEALTH_FACTOR_BELOW_TARGET');
  });

  it('no warning is produced once the underlying position no longer breaches the target', () => {
    const created = usePortfolioStore
      .getState()
      .create(validInput({ settings: { safetyTargets: { targetHealthFactor: 5 } } }));
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);

    // Repay enough debt to push Health Factor back above the target.
    usePortfolioStore
      .getState()
      .update(created.data.id, { debt: { asset: 'USDC', balance: 1000 } });

    const record = usePortfolioStore.getState().portfolios[created.data.id];
    if (!record.summary.ok) throw new Error('expected a successful summary');
    const viewModel = buildDashboardViewModel(record.portfolio, record.summary);
    if (!viewModel.ok) throw new Error('expected a successful view model');
    const healthFactorStatus = buildHealthFactorStatus(record.portfolio, record.summary.data);
    const warnings = buildRiskWarnings(healthFactorStatus, viewModel.freshness, viewModel.warnings);

    expect(warnings.map((w) => w.code)).not.toContain('HEALTH_FACTOR_BELOW_TARGET');
  });
});

describe('Cover: Recover from Service failure (M5-026)', () => {
  it('a calculation failure yields a safe, structured Dashboard view model, and fixing the position recovers it automatically', () => {
    const created = usePortfolioStore
      .getState()
      .create(validInput({ collateral: { asset: 'BTC', quantity: 0 } }));
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);

    let record = usePortfolioStore.getState().portfolios[created.data.id];
    let viewModel = buildDashboardViewModel(record.portfolio, record.summary);
    expect(viewModel.ok).toBe(false);
    // Identity/freshness stay available even on failure (M5-004's own DoD, at this same view-model layer).
    expect(viewModel.portfolioName).toBe('My Portfolio');

    usePortfolioStore
      .getState()
      .update(created.data.id, { collateral: { asset: 'BTC', quantity: 2 } });

    record = usePortfolioStore.getState().portfolios[created.data.id];
    viewModel = buildDashboardViewModel(record.portfolio, record.summary);
    expect(viewModel.ok).toBe(true);
    expect(viewModel.ok && viewModel.metrics.netPortfolioValue.rawValue).toBe(80000);
  });
});

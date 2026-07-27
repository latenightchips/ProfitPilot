import { beforeEach, describe, expect, it } from 'vitest';

import type { ApplicationPortfolio, SimulationScenario } from '@/services';
import { usePortfolioStore } from '@/stores/portfolioStore';
import { useSimulationStore } from '@/stores/simulationStore';

/**
 * Simulation Store — 06_TASKS.md M6-003 ("Implement Simulation Store").
 * DoD: "Simulation state is completely independent from portfolio
 * state."
 */
const INITIAL_STATE = {
  currentScenario: null,
  currentResult: null,
  savedScenarios: [],
  comparisonSelection: [],
  status: 'idle' as const,
  errors: [],
  previewMode: false,
};

beforeEach(() => {
  useSimulationStore.setState(INITIAL_STATE);
  usePortfolioStore.setState({
    portfolios: {},
    activePortfolioId: null,
    loadStatus: 'idle',
    saveStatus: 'idle',
    errors: [],
    lastSynchronizedAt: null,
  });
});

function validPortfolio(overrides: Partial<ApplicationPortfolio> = {}): ApplicationPortfolio {
  return {
    collateral: { asset: 'BTC', quantity: 2 },
    debt: { asset: 'USDC', balance: 20000 },
    market: { btcPriceUsd: 50000 },
    protocol: {
      maxLoanToValue: 0.75,
      liquidationThreshold: 0.8,
      borrowApr: 0.05,
      supplyApr: 0.02,
    },
    ...overrides,
  };
}

const PRICE_SCENARIO: SimulationScenario = {
  type: 'price',
  priceScenario: { type: 'absolute', btcPriceUsd: 60000 },
};

describe('useSimulationStore — initial state', () => {
  it('starts with every field at its documented default', () => {
    const state = useSimulationStore.getState();
    expect(state.currentScenario).toBeNull();
    expect(state.currentResult).toBeNull();
    expect(state.savedScenarios).toEqual([]);
    expect(state.comparisonSelection).toEqual([]);
    expect(state.status).toBe('idle');
    expect(state.errors).toEqual([]);
    expect(state.previewMode).toBe(false);
  });
});

describe('useSimulationStore — setCurrentScenario', () => {
  it('sets the scenario and clears any previous result, status, and errors', () => {
    useSimulationStore.setState({
      currentResult: { baseline: {} } as never,
      status: 'error',
      errors: [{ category: 'validation', code: 'X', message: 'x' }] as never,
    });

    useSimulationStore.getState().setCurrentScenario(PRICE_SCENARIO);

    const state = useSimulationStore.getState();
    expect(state.currentScenario).toEqual(PRICE_SCENARIO);
    expect(state.currentResult).toBeNull();
    expect(state.status).toBe('idle');
    expect(state.errors).toEqual([]);
  });

  it('accepts null to clear the scenario entirely', () => {
    useSimulationStore.getState().setCurrentScenario(PRICE_SCENARIO);
    useSimulationStore.getState().setCurrentScenario(null);
    expect(useSimulationStore.getState().currentScenario).toBeNull();
  });
});

describe('useSimulationStore — runSimulation', () => {
  it('does nothing when no scenario is set', () => {
    useSimulationStore.getState().runSimulation(validPortfolio());
    expect(useSimulationStore.getState().status).toBe('idle');
    expect(useSimulationStore.getState().currentResult).toBeNull();
  });

  it('populates currentResult from the real Simulation Service on success', () => {
    useSimulationStore.getState().setCurrentScenario(PRICE_SCENARIO);
    useSimulationStore.getState().runSimulation(validPortfolio());

    const state = useSimulationStore.getState();
    expect(state.status).toBe('idle');
    expect(state.errors).toEqual([]);
    expect(state.currentResult).not.toBeNull();
    // 2 BTC * $60,000 - $20,000 debt = $100,000 net equity in the scenario.
    expect(state.currentResult?.scenario.equity).toBe(100000);
    // The baseline is the real, unmodified current portfolio: 2 BTC * $50,000 - $20,000 = $80,000.
    expect(state.currentResult?.baseline.equity).toBe(80000);
  });

  it('sets status to error and clears currentResult when the underlying calculation fails', () => {
    useSimulationStore.getState().setCurrentScenario(PRICE_SCENARIO);
    useSimulationStore
      .getState()
      .runSimulation(validPortfolio({ collateral: { asset: 'BTC', quantity: 0 } }));

    const state = useSimulationStore.getState();
    expect(state.status).toBe('error');
    expect(state.errors.length).toBeGreaterThan(0);
    expect(state.currentResult).toBeNull();
  });
});

describe('useSimulationStore — saveCurrentScenario', () => {
  it('returns null and saves nothing when there is no current result yet', () => {
    useSimulationStore.getState().setCurrentScenario(PRICE_SCENARIO);
    const id = useSimulationStore.getState().saveCurrentScenario();
    expect(id).toBeNull();
    expect(useSimulationStore.getState().savedScenarios).toEqual([]);
  });

  it('saves the current scenario and result, returning a real id', () => {
    useSimulationStore.getState().setCurrentScenario(PRICE_SCENARIO);
    useSimulationStore.getState().runSimulation(validPortfolio());

    const id = useSimulationStore.getState().saveCurrentScenario();

    expect(id).not.toBeNull();
    const saved = useSimulationStore.getState().savedScenarios;
    expect(saved).toHaveLength(1);
    expect(saved[0].id).toBe(id);
    expect(saved[0].scenario).toEqual(PRICE_SCENARIO);
    expect(saved[0].result.scenario.equity).toBe(100000);
  });
});

describe('useSimulationStore — deleteSavedScenario', () => {
  it('removes the scenario and clears it from the comparison selection', () => {
    useSimulationStore.getState().setCurrentScenario(PRICE_SCENARIO);
    useSimulationStore.getState().runSimulation(validPortfolio());
    const id = useSimulationStore.getState().saveCurrentScenario();
    if (id === null) throw new Error('setup failed');
    useSimulationStore.getState().toggleComparisonSelection(id);

    useSimulationStore.getState().deleteSavedScenario(id);

    expect(useSimulationStore.getState().savedScenarios).toEqual([]);
    expect(useSimulationStore.getState().comparisonSelection).toEqual([]);
  });
});

describe('useSimulationStore — toggleComparisonSelection', () => {
  it('adds an id on first toggle and removes it on second toggle', () => {
    useSimulationStore.getState().toggleComparisonSelection('abc');
    expect(useSimulationStore.getState().comparisonSelection).toEqual(['abc']);

    useSimulationStore.getState().toggleComparisonSelection('abc');
    expect(useSimulationStore.getState().comparisonSelection).toEqual([]);
  });
});

describe('useSimulationStore — setPreviewMode', () => {
  it('toggles the preview mode flag', () => {
    useSimulationStore.getState().setPreviewMode(true);
    expect(useSimulationStore.getState().previewMode).toBe(true);
    useSimulationStore.getState().setPreviewMode(false);
    expect(useSimulationStore.getState().previewMode).toBe(false);
  });
});

describe('useSimulationStore — reset', () => {
  it('restores every field to its initial default', () => {
    useSimulationStore.getState().setCurrentScenario(PRICE_SCENARIO);
    useSimulationStore.getState().runSimulation(validPortfolio());
    useSimulationStore.getState().saveCurrentScenario();
    useSimulationStore.getState().setPreviewMode(true);

    useSimulationStore.getState().reset();

    expect(useSimulationStore.getState()).toMatchObject(INITIAL_STATE);
  });
});

describe('useSimulationStore — independence from portfolio state (M6-003 DoD)', () => {
  it('is completely unaffected by Portfolio Store mutations, and vice versa', () => {
    useSimulationStore.getState().setCurrentScenario(PRICE_SCENARIO);
    useSimulationStore.getState().runSimulation(validPortfolio());

    const created = usePortfolioStore.getState().create({
      name: 'Independence Check',
      baseCurrency: 'USD',
      collateral: { asset: 'BTC', quantity: 5 },
      debt: { asset: 'USDC', balance: 10000 },
      market: { btcPriceUsd: 70000 },
      protocol: {
        maxLoanToValue: 0.75,
        liquidationThreshold: 0.8,
        borrowApr: 0.05,
        supplyApr: 0.02,
      },
      settings: {},
    });
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);

    // The Simulation Store's own result, computed against a completely
    // different portfolio, is untouched by this unrelated Portfolio
    // Store activity.
    expect(useSimulationStore.getState().currentResult?.scenario.equity).toBe(100000);

    // And the reverse: mutating the Simulation Store never touches the
    // Portfolio Store's own state.
    useSimulationStore.getState().reset();
    expect(usePortfolioStore.getState().activePortfolioId).toBe(created.data.id);
  });
});

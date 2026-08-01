import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { ApplyLoopAsSimulation } from '@/features/loop-builder';
import type { ApplicationPortfolio } from '@/services';
import { useLoopBuilderStore } from '@/stores/loopBuilderStore';
import { useSimulationStore } from '@/stores/simulationStore';

/**
 * Apply Loop as Simulation — 06_TASKS.md M7-016. DoD: "Loop strategies
 * integrate with the broader Simulation Workspace." See this
 * component's own header comment for the `PortfolioActionSimulationInput`
 * architectural resolution.
 */
const LOOP_INITIAL_STATE = {
  settings: null,
  currentResult: null,
  status: 'idle' as const,
  errors: [],
  warnings: [],
  lastMetadata: null,
  savedStrategies: [],
  selectedStrategyId: null,
  sensitivityResult: null,
  sensitivityErrors: [],
};

const SIMULATION_INITIAL_STATE = {
  currentScenario: null,
  currentResult: null,
  portfolioActionPreview: null,
  savedScenarios: [],
  comparisonSelection: [],
  timelineProjection: null,
  lastMetadata: null,
  status: 'idle' as const,
  errors: [],
  warnings: [],
  previewMode: false,
};

function validPortfolio(overrides: Partial<ApplicationPortfolio> = {}): ApplicationPortfolio {
  return {
    collateral: { asset: 'BTC', quantity: 1 },
    debt: { asset: 'USDC', balance: 0 },
    market: { btcPriceUsd: 50000 },
    protocol: {
      maxLoanToValue: 0.5,
      liquidationThreshold: 0.8,
      borrowApr: 0.05,
      supplyApr: 0.02,
    },
    ...overrides,
  };
}

beforeEach(() => {
  useLoopBuilderStore.setState(LOOP_INITIAL_STATE);
  useSimulationStore.setState(SIMULATION_INITIAL_STATE);
});

describe('ApplyLoopAsSimulation — empty state', () => {
  it('prompts for a viable strategy before any calculation has run', () => {
    render(<ApplyLoopAsSimulation portfolio={validPortfolio()} />);
    expect(screen.getByText(/Configure a viable strategy/i)).toBeInTheDocument();
  });
});

describe('ApplyLoopAsSimulation — applying', () => {
  it('computes the real collateral/debt delta and applies it via runPortfolioActionSimulation, without touching currentScenario/currentResult', () => {
    const portfolio = validPortfolio();
    useLoopBuilderStore
      .getState()
      .setSettings({ targetBorrowPercentage: 0.5, maxLoops: 3, minHealthFactor: 1.1 });
    useLoopBuilderStore.getState().runLoopStrategy(portfolio);

    render(<ApplyLoopAsSimulation portfolio={portfolio} />);
    screen.getByRole('button', { name: /Apply Loop as Simulation/i }).click();

    const simState = useSimulationStore.getState();
    expect(simState.portfolioActionPreview).not.toBeNull();
    expect(simState.currentScenario).toBeNull();
    expect(simState.currentResult).toBeNull();
  });

  it('shows a real Health Factor before is different from after applying', () => {
    const portfolio = validPortfolio();
    useLoopBuilderStore
      .getState()
      .setSettings({ targetBorrowPercentage: 0.5, maxLoops: 3, minHealthFactor: 1.1 });
    useLoopBuilderStore.getState().runLoopStrategy(portfolio);

    render(<ApplyLoopAsSimulation portfolio={portfolio} />);
    screen.getByRole('button', { name: /Apply Loop as Simulation/i }).click();

    const preview = useSimulationStore.getState().portfolioActionPreview;
    expect(preview).not.toBeNull();
    expect(preview?.before.healthFactor).not.toBe(preview?.after.healthFactor);
  });

  it('renders a link to the Simulation Workspace with the correct href', () => {
    const portfolio = validPortfolio();
    useLoopBuilderStore
      .getState()
      .setSettings({ targetBorrowPercentage: 0.5, maxLoops: 3, minHealthFactor: 1.1 });
    useLoopBuilderStore.getState().runLoopStrategy(portfolio);

    render(<ApplyLoopAsSimulation portfolio={portfolio} />);
    expect(screen.getByRole('link', { name: /Open Simulation Workspace/i })).toHaveAttribute(
      'href',
      '/simulation',
    );
  });
});

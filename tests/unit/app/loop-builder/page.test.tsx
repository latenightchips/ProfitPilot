import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import LoopBuilderPage from '@/app/loop-builder/page';
import { useLoopBuilderStore } from '@/stores/loopBuilderStore';
import { usePortfolioStore } from '@/stores/portfolioStore';
import { useSimulationStore } from '@/stores/simulationStore';

/**
 * Loop Builder Route — 06_TASKS.md M7-006. DoD: "Users can open the
 * Loop Builder from the Dashboard and Simulation Workspace." Include:
 * "Strategy controls, Current portfolio baseline, Results summary, Loop
 * steps, Safety analysis, Cost analysis." Milestone 7 Batch 3 adds 5
 * more sections (Scenario Sensitivity, Apply as Simulation, Save
 * Strategy, Saved Strategies, Export Strategy) — see this route's own
 * header comment.
 */
beforeEach(() => {
  usePortfolioStore.setState({
    portfolios: {},
    activePortfolioId: null,
    loadStatus: 'idle',
    saveStatus: 'idle',
    errors: [],
    lastSynchronizedAt: null,
  });
  useLoopBuilderStore.setState({
    settings: null,
    currentResult: null,
    status: 'idle',
    errors: [],
    warnings: [],
    lastMetadata: null,
    savedStrategies: [],
    selectedStrategyId: null,
    sensitivityResult: null,
    sensitivityErrors: [],
  });
  useSimulationStore.setState({
    currentScenario: null,
    currentResult: null,
    portfolioActionPreview: null,
    savedScenarios: [],
    comparisonSelection: [],
    timelineProjection: null,
    lastMetadata: null,
    status: 'idle',
    errors: [],
    warnings: [],
    previewMode: false,
  });
});

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    name: 'My Portfolio',
    baseCurrency: 'USD',
    collateral: { asset: 'BTC', quantity: 1 },
    debt: { asset: 'USDC', balance: 0 },
    market: { btcPriceUsd: 50000 },
    protocol: {
      maxLoanToValue: 0.5,
      liquidationThreshold: 0.8,
      borrowApr: 0.05,
      supplyApr: 0.02,
    },
    settings: {},
    ...overrides,
  };
}

function selectActivePortfolio() {
  const created = usePortfolioStore.getState().create(validInput());
  if (!created.ok) throw new Error('setup failed');
  usePortfolioStore.getState().select(created.data.id);
  return created.data;
}

describe('LoopBuilderPage — no active portfolio', () => {
  it('shows a prompt to select or create a portfolio instead of the strategy tools', () => {
    render(<LoopBuilderPage />);
    expect(screen.getByText(/No portfolio is currently selected/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Strategy Controls')).not.toBeInTheDocument();
  });
});

describe('LoopBuilderPage — active portfolio (Include items)', () => {
  it('renders every named region: Strategy Controls, Current Portfolio Baseline, Results Summary, Loop Steps', () => {
    selectActivePortfolio();
    render(<LoopBuilderPage />);
    expect(screen.getByLabelText('Strategy Controls')).toBeInTheDocument();
    expect(screen.getByText('Current Portfolio Baseline')).toBeInTheDocument();
    expect(screen.getByText('Results Summary')).toBeInTheDocument();
    expect(screen.getByText('Loop Steps')).toBeInTheDocument();
  });

  it('renders real Safety Analysis and Cost Analysis sections, no longer placeholders (M7-013/M7-014)', () => {
    selectActivePortfolio();
    render(<LoopBuilderPage />);
    expect(screen.getByText('Safety Analysis')).toBeInTheDocument();
    expect(screen.getByText('Cost Analysis')).toBeInTheDocument();
    expect(screen.queryByText(/Not yet implemented/i)).not.toBeInTheDocument();
  });

  it('renders all 5 new Milestone 7 Batch 3 sections: Scenario Sensitivity, Apply as Simulation, Save Strategy, Saved Strategies, Export Strategy', () => {
    selectActivePortfolio();
    render(<LoopBuilderPage />);
    expect(screen.getByText('Scenario Sensitivity')).toBeInTheDocument();
    expect(screen.getByText('Apply as Simulation')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Save Strategy' })).toBeInTheDocument();
    expect(screen.getByText('Saved Strategies')).toBeInTheDocument();
    expect(screen.getByText('Export Strategy')).toBeInTheDocument();
  });

  it('renders a Warnings section sourced from the Loop Builder Store specifically', () => {
    const portfolio = selectActivePortfolio();
    useLoopBuilderStore.getState().setSettings({
      targetBorrowPercentage: 0.5,
      maxLoops: 3,
      minHealthFactor: 1,
    });
    useLoopBuilderStore.getState().runLoopStrategy(portfolio);

    render(<LoopBuilderPage />);
    expect(screen.getByText('Warnings')).toBeInTheDocument();
    expect(useLoopBuilderStore.getState().warnings.length).toBeGreaterThan(0);
  });
});

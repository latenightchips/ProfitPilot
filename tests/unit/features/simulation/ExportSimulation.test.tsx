import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ExportSimulation } from '@/features/simulation';
import type { ApplicationPortfolio } from '@/services';
import { useSimulationStore } from '@/stores/simulationStore';

/**
 * Export Simulation — 06_TASKS.md M6-019 ("Export Simulation"). This
 * component only wires `../utils/exportSimulation.ts`'s own already
 * fully-tested pure functions to two buttons; these tests focus on
 * that wiring (empty state, which arguments reach the download
 * trigger), not on re-testing payload/CSV construction.
 */
const PORTFOLIO: ApplicationPortfolio = {
  collateral: { asset: 'BTC', quantity: 2 },
  debt: { asset: 'USDC', balance: 20000 },
  market: { btcPriceUsd: 50000 },
  protocol: {
    maxLoanToValue: 0.75,
    liquidationThreshold: 0.8,
    borrowApr: 0.05,
    supplyApr: 0.02,
  },
};

beforeEach(() => {
  useSimulationStore.getState().reset();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function stubDownload() {
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn(() => 'blob:mock-url'),
    revokeObjectURL: vi.fn(),
  });
  const realCreateElement = document.createElement.bind(document);
  const click = vi.fn();
  let anchor: HTMLAnchorElement | undefined;
  vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
    const element = realCreateElement(tagName);
    if (tagName === 'a') {
      element.click = click;
      anchor = element as HTMLAnchorElement;
    }
    return element;
  });
  return { click, anchor: () => anchor };
}

describe('ExportSimulation — empty state', () => {
  it('prompts the user to run a scenario, rather than rendering export buttons', () => {
    render(<ExportSimulation portfolio={PORTFOLIO} />);
    expect(screen.getByText('Run a price or interest scenario to export it.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Export JSON' })).not.toBeInTheDocument();
  });

  it('stays hidden for a portfolio action alone — export is scoped to price/interest scenarios', () => {
    useSimulationStore
      .getState()
      .runPortfolioActionSimulation(PORTFOLIO, { collateralDelta: 1, debtDelta: 0 });
    render(<ExportSimulation portfolio={PORTFOLIO} />);
    expect(screen.getByText('Run a price or interest scenario to export it.')).toBeInTheDocument();
  });
});

describe('ExportSimulation — active scenario', () => {
  function activateScenario() {
    useSimulationStore.getState().setCurrentScenario({
      type: 'price',
      priceScenario: { type: 'absolute', btcPriceUsd: 65000 },
    });
    useSimulationStore.getState().runSimulation(PORTFOLIO);
  }

  it('renders Export JSON and Export CSV buttons', () => {
    activateScenario();
    render(<ExportSimulation portfolio={PORTFOLIO} />);
    expect(screen.getByRole('button', { name: 'Export JSON' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeInTheDocument();
  });

  it('clicking Export JSON triggers a real download with a .json filename', async () => {
    const user = userEvent.setup();
    activateScenario();
    const { click, anchor } = stubDownload();

    render(<ExportSimulation portfolio={PORTFOLIO} />);
    await user.click(screen.getByRole('button', { name: 'Export JSON' }));

    expect(click).toHaveBeenCalledTimes(1);
    expect(anchor()?.download).toBe('simulation-export-price.json');
  });

  it('clicking Export CSV triggers a real download with a .csv filename', async () => {
    const user = userEvent.setup();
    activateScenario();
    const { click, anchor } = stubDownload();

    render(<ExportSimulation portfolio={PORTFOLIO} />);
    await user.click(screen.getByRole('button', { name: 'Export CSV' }));

    expect(click).toHaveBeenCalledTimes(1);
    expect(anchor()?.download).toBe('simulation-export-price.csv');
  });

  it('exports the exact loaded scenario after Load, not a fresh recalculation (M6-016 round trip)', async () => {
    const user = userEvent.setup();
    activateScenario();
    const id = useSimulationStore.getState().saveCurrentScenario({
      name: 'Bull Run',
      portfolioId: 'portfolio-1',
      portfolioUpdatedAt: '2026-01-01T00:00:00.000Z',
    });
    if (id === null) throw new Error('setup failed');

    useSimulationStore.getState().setCurrentScenario({
      type: 'price',
      priceScenario: { type: 'absolute', btcPriceUsd: 30000 },
    });
    useSimulationStore.getState().runSimulation(PORTFOLIO);
    useSimulationStore.getState().loadSavedScenario(id);

    const { click } = stubDownload();
    render(<ExportSimulation portfolio={PORTFOLIO} />);
    await user.click(screen.getByRole('button', { name: 'Export JSON' }));

    expect(click).toHaveBeenCalledTimes(1);
    expect(useSimulationStore.getState().currentResult?.scenario.equity).toBe(110000);
  });
});

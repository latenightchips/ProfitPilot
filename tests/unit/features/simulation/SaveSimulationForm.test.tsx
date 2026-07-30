import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { SaveSimulationForm } from '@/features/simulation';
import type { ApplicationPortfolio } from '@/services';
import { useSimulationStore } from '@/stores/simulationStore';

/**
 * Save Simulation Form — 06_TASKS.md M6-015 ("Save Simulation"). DoD:
 * "Saved simulations can be reopened later." Every assertion below
 * checks a value the real `saveCurrentScenario` Store action actually
 * stored, never a hand-crafted mock result.
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

const PORTFOLIO_UPDATED_AT = '2026-01-01T00:00:00.000Z';

beforeEach(() => {
  useSimulationStore.getState().reset();
});

describe('SaveSimulationForm — no active scenario result', () => {
  it('prompts the user to run a scenario, rather than rendering an empty form', () => {
    render(
      <SaveSimulationForm portfolioId="portfolio-1" portfolioUpdatedAt={PORTFOLIO_UPDATED_AT} />,
    );
    expect(screen.getByText('Run a price or interest scenario to save it.')).toBeInTheDocument();
  });

  it('stays hidden for a portfolio action alone — saving is scoped to price/interest scenarios', () => {
    useSimulationStore
      .getState()
      .runPortfolioActionSimulation(PORTFOLIO, { collateralDelta: 1, debtDelta: 0 });
    render(
      <SaveSimulationForm portfolioId="portfolio-1" portfolioUpdatedAt={PORTFOLIO_UPDATED_AT} />,
    );
    expect(screen.getByText('Run a price or interest scenario to save it.')).toBeInTheDocument();
  });
});

describe('SaveSimulationForm — active scenario result', () => {
  function activateScenario() {
    useSimulationStore.getState().setCurrentScenario({
      type: 'price',
      priceScenario: { type: 'absolute', btcPriceUsd: 60000 },
    });
    useSimulationStore.getState().runSimulation(PORTFOLIO);
  }

  it('shows an inline error and does not save when Name is empty', async () => {
    const user = userEvent.setup();
    activateScenario();
    render(
      <SaveSimulationForm portfolioId="portfolio-1" portfolioUpdatedAt={PORTFOLIO_UPDATED_AT} />,
    );

    await user.click(screen.getByRole('button', { name: 'Save Scenario' }));

    expect(screen.getByText('Name is required.')).toBeInTheDocument();
    expect(useSimulationStore.getState().savedScenarios).toEqual([]);
  });

  it('saves the current scenario with the real name/description/portfolioId on submit', async () => {
    const user = userEvent.setup();
    activateScenario();
    render(
      <SaveSimulationForm portfolioId="portfolio-42" portfolioUpdatedAt={PORTFOLIO_UPDATED_AT} />,
    );

    await user.type(screen.getByLabelText('Name'), 'My Bull Case');
    await user.type(screen.getByLabelText('Description'), 'BTC to 60k');
    await user.click(screen.getByRole('button', { name: 'Save Scenario' }));

    const saved = useSimulationStore.getState().savedScenarios;
    expect(saved).toHaveLength(1);
    expect(saved[0].name).toBe('My Bull Case');
    expect(saved[0].description).toBe('BTC to 60k');
    expect(saved[0].portfolioId).toBe('portfolio-42');
    expect(saved[0].portfolioUpdatedAt).toBe(PORTFOLIO_UPDATED_AT);
    expect(saved[0].result.scenario.equity).toBe(100000);
    expect(screen.getByText('Saved.')).toBeInTheDocument();
  });

  it('saves with description as null when left blank', async () => {
    const user = userEvent.setup();
    activateScenario();
    render(
      <SaveSimulationForm portfolioId="portfolio-1" portfolioUpdatedAt={PORTFOLIO_UPDATED_AT} />,
    );

    await user.type(screen.getByLabelText('Name'), 'No Description Scenario');
    await user.click(screen.getByRole('button', { name: 'Save Scenario' }));

    expect(useSimulationStore.getState().savedScenarios[0].description).toBeNull();
  });

  it('clears the form fields after a successful save', async () => {
    const user = userEvent.setup();
    activateScenario();
    render(
      <SaveSimulationForm portfolioId="portfolio-1" portfolioUpdatedAt={PORTFOLIO_UPDATED_AT} />,
    );

    const nameInput = screen.getByLabelText('Name');
    await user.type(nameInput, 'Clears After Save');
    await user.click(screen.getByRole('button', { name: 'Save Scenario' }));

    expect(nameInput).toHaveValue('');
  });
});

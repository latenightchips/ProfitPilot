import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { ScenarioTimeline } from '@/features/simulation';
import type { ApplicationPortfolio } from '@/services';
import { useSimulationStore } from '@/stores/simulationStore';

/**
 * Scenario Timeline — 06_TASKS.md M6-012 ("Implement Scenario Timeline").
 * DoD: "Users can visualize projected changes over time." Every numeric
 * assertion below checks a value already sitting in the Store's own
 * `timelineProjection`, computed by the real `runTimelineProjection`
 * action — never freshly recalculated by this component or this test.
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

describe('ScenarioTimeline — empty state', () => {
  it('prompts the user to change Borrow Rate or Holding Period, rather than rendering empty charts', () => {
    render(<ScenarioTimeline />);
    expect(
      screen.getByText('Change Borrow Rate or Holding Period to see the timeline.'),
    ).toBeInTheDocument();
  });

  it('stays empty for a price scenario, which has no time horizon', () => {
    useSimulationStore.getState().setCurrentScenario({
      type: 'price',
      priceScenario: { type: 'absolute', btcPriceUsd: 60000 },
    });
    useSimulationStore.getState().runTimelineProjection(PORTFOLIO);

    render(<ScenarioTimeline />);
    expect(
      screen.getByText('Change Borrow Rate or Holding Period to see the timeline.'),
    ).toBeInTheDocument();
  });
});

describe('ScenarioTimeline — with an active interest scenario', () => {
  it('renders all 3 timeline charts with accessible role="img" summaries reflecting real computed values', () => {
    useSimulationStore.getState().setCurrentScenario({
      type: 'interest',
      priceScenario: { type: 'absolute', btcPriceUsd: 60000 },
      borrowApr: 0.1,
      timeHorizonDays: 100,
    });
    useSimulationStore.getState().runTimelineProjection(PORTFOLIO);

    render(<ScenarioTimeline />);

    expect(screen.getByText('Portfolio Value Over Time')).toBeInTheDocument();
    expect(screen.getByText('Health Factor Over Time')).toBeInTheDocument();
    expect(screen.getByText('Interest Cost Over Time')).toBeInTheDocument();

    // Day 0: 2 BTC * $60,000 - $20,000 = $100,000, no interest accrued yet.
    const equityChart = screen.getByRole('img', { name: /Portfolio Value Over Time/ });
    expect(equityChart).toHaveAccessibleName(/Day 0 \$100,000\.00/);

    // Day 100: $20,000 * 10% / 365 * 100 ≈ $547.95 accrued interest.
    const interestChart = screen.getByRole('img', { name: /Interest Cost Over Time/ });
    expect(interestChart).toHaveAccessibleName(/Day 100 \$547\.95/);
  });
});

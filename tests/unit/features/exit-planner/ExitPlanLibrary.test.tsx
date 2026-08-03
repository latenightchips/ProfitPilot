import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { ExitPlanLibrary } from '@/features/exit-planner';
import { type SavedExitPlan, useExitPlannerStore } from '@/stores/exitPlannerStore';
import type { Portfolio } from '@/types/portfolio';

/**
 * Exit Plan Library — 06_TASKS.md M7-029 ("load" half). DoD: "Saved
 * plans remain reproducible and show when the source portfolio has
 * changed."
 */
const INITIAL_STATE = {
  exitType: null,
  targetInputs: null,
  currentResult: null,
  status: 'idle' as const,
  errors: [],
  warnings: [],
  lastMetadata: null,
  priceSensitivity: null,
  priceSensitivityErrors: [],
  savedPlans: [],
  selectedPlanId: null,
};

function fakePortfolio(overrides: Partial<Portfolio> = {}): Portfolio {
  return {
    id: 'p1',
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
    archivedAt: null,
    marketUpdatedAt: '2026-01-01T00:00:00.000Z',
    protocolUpdatedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function fakeSavedPlan(overrides: Partial<SavedExitPlan> = {}): SavedExitPlan {
  return {
    id: 's1',
    name: 'My Exit',
    portfolioId: 'p1',
    portfolioUpdatedAt: '2026-01-01T00:00:00.000Z',
    exitType: 'fullExit',
    targetInputs: {},
    result: { feasible: true } as never,
    warnings: [],
    metadata: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  useExitPlannerStore.setState(INITIAL_STATE);
});

describe('ExitPlanLibrary — empty state', () => {
  it('shows a message when no plans are saved', () => {
    render(<ExitPlanLibrary portfolio={fakePortfolio()} />);
    expect(screen.getByText('No exit plans saved yet.')).toBeInTheDocument();
  });
});

describe('ExitPlanLibrary — Load/Duplicate/Delete', () => {
  it('Load restores the saved exitType/result onto the Store', async () => {
    const user = userEvent.setup();
    useExitPlannerStore.setState({ savedPlans: [fakeSavedPlan()] });
    render(<ExitPlanLibrary portfolio={fakePortfolio()} />);

    await user.click(screen.getByRole('button', { name: 'Load' }));

    expect(useExitPlannerStore.getState().currentResult).toEqual({ feasible: true });
    expect(useExitPlannerStore.getState().selectedPlanId).toBe('s1');
  });

  it('Duplicate creates a second entry with a " (Copy)" suffix', async () => {
    const user = userEvent.setup();
    useExitPlannerStore.setState({ savedPlans: [fakeSavedPlan()] });
    render(<ExitPlanLibrary portfolio={fakePortfolio()} />);

    await user.click(screen.getByRole('button', { name: 'Duplicate' }));

    const saved = useExitPlannerStore.getState().savedPlans;
    expect(saved).toHaveLength(2);
    expect(saved.some((plan) => plan.name === 'My Exit (Copy)')).toBe(true);
  });

  it('Delete requires confirmation before removing the record', async () => {
    const user = userEvent.setup();
    useExitPlannerStore.setState({ savedPlans: [fakeSavedPlan()] });
    render(<ExitPlanLibrary portfolio={fakePortfolio()} />);

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByText('Delete “My Exit”?')).toBeInTheDocument();
    expect(useExitPlannerStore.getState().savedPlans).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Confirm Delete' }));
    expect(useExitPlannerStore.getState().savedPlans).toHaveLength(0);
  });

  it('Cancel dismisses the delete confirmation without deleting', async () => {
    const user = userEvent.setup();
    useExitPlannerStore.setState({ savedPlans: [fakeSavedPlan()] });
    render(<ExitPlanLibrary portfolio={fakePortfolio()} />);

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText('Delete “My Exit”?')).not.toBeInTheDocument();
    expect(useExitPlannerStore.getState().savedPlans).toHaveLength(1);
  });
});

describe('ExitPlanLibrary — drift notice', () => {
  it('shows no drift notice when the portfolio is unchanged since saving', () => {
    useExitPlannerStore.setState({ savedPlans: [fakeSavedPlan()] });
    render(<ExitPlanLibrary portfolio={fakePortfolio()} />);
    expect(screen.queryByText(/Saved against a different portfolio/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Portfolio has changed since/)).not.toBeInTheDocument();
  });

  it('shows "Portfolio has changed since this was saved." when the same portfolio has since been updated', () => {
    useExitPlannerStore.setState({ savedPlans: [fakeSavedPlan()] });
    render(
      <ExitPlanLibrary portfolio={fakePortfolio({ updatedAt: '2026-06-01T00:00:00.000Z' })} />,
    );
    expect(screen.getByText(/Portfolio has changed since this was saved\./)).toBeInTheDocument();
  });

  it('shows "Saved against a different portfolio." when the plan belongs to a different portfolio', () => {
    useExitPlannerStore.setState({ savedPlans: [fakeSavedPlan()] });
    render(<ExitPlanLibrary portfolio={fakePortfolio({ id: 'p2' })} />);
    expect(screen.getByText(/Saved against a different portfolio\./)).toBeInTheDocument();
  });
});

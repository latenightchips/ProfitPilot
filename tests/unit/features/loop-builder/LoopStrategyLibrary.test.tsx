import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { LoopStrategyLibrary } from '@/features/loop-builder';
import { type SavedLoopStrategy, useLoopBuilderStore } from '@/stores/loopBuilderStore';
import type { Portfolio } from '@/types/portfolio';

/**
 * Loop Strategy Library — 06_TASKS.md M7-017 ("load" half). Mirrors
 * `ScenarioComparison.tsx`'s own Load/Duplicate/Delete/drift-notice
 * pattern.
 */
const INITIAL_STATE = {
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

function fakePortfolio(overrides: Partial<Portfolio> = {}): Portfolio {
  return {
    id: 'p1',
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
    archivedAt: null,
    marketUpdatedAt: '2026-01-01T00:00:00.000Z',
    protocolUpdatedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function fakeSavedStrategy(overrides: Partial<SavedLoopStrategy> = {}): SavedLoopStrategy {
  return {
    id: 's1',
    name: 'My Loop',
    portfolioId: 'p1',
    portfolioUpdatedAt: '2026-01-01T00:00:00.000Z',
    settings: { targetBorrowPercentage: 0.5, maxLoops: 3, minHealthFactor: 1.1 },
    result: { viable: true } as never,
    warnings: [],
    metadata: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  useLoopBuilderStore.setState(INITIAL_STATE);
});

describe('LoopStrategyLibrary — empty state', () => {
  it('shows a message when no strategies are saved', () => {
    render(<LoopStrategyLibrary portfolio={fakePortfolio()} />);
    expect(screen.getByText('No strategies saved yet.')).toBeInTheDocument();
  });
});

describe('LoopStrategyLibrary — Load/Duplicate/Delete', () => {
  it('Load restores the saved settings/result onto the Store', async () => {
    const user = userEvent.setup();
    useLoopBuilderStore.setState({ savedStrategies: [fakeSavedStrategy()] });
    render(<LoopStrategyLibrary portfolio={fakePortfolio()} />);

    await user.click(screen.getByRole('button', { name: 'Load' }));

    expect(useLoopBuilderStore.getState().currentResult).toEqual({ viable: true });
    expect(useLoopBuilderStore.getState().selectedStrategyId).toBe('s1');
  });

  it('Duplicate creates a second entry with a " (Copy)" suffix', async () => {
    const user = userEvent.setup();
    useLoopBuilderStore.setState({ savedStrategies: [fakeSavedStrategy()] });
    render(<LoopStrategyLibrary portfolio={fakePortfolio()} />);

    await user.click(screen.getByRole('button', { name: 'Duplicate' }));

    const saved = useLoopBuilderStore.getState().savedStrategies;
    expect(saved).toHaveLength(2);
    expect(saved.some((strategy) => strategy.name === 'My Loop (Copy)')).toBe(true);
  });

  it('Delete requires confirmation before removing the record', async () => {
    const user = userEvent.setup();
    useLoopBuilderStore.setState({ savedStrategies: [fakeSavedStrategy()] });
    render(<LoopStrategyLibrary portfolio={fakePortfolio()} />);

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByText('Delete “My Loop”?')).toBeInTheDocument();
    expect(useLoopBuilderStore.getState().savedStrategies).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Confirm Delete' }));
    expect(useLoopBuilderStore.getState().savedStrategies).toHaveLength(0);
  });

  it('Cancel dismisses the delete confirmation without deleting', async () => {
    const user = userEvent.setup();
    useLoopBuilderStore.setState({ savedStrategies: [fakeSavedStrategy()] });
    render(<LoopStrategyLibrary portfolio={fakePortfolio()} />);

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText('Delete “My Loop”?')).not.toBeInTheDocument();
    expect(useLoopBuilderStore.getState().savedStrategies).toHaveLength(1);
  });
});

describe('LoopStrategyLibrary — drift notice', () => {
  it('shows no drift notice when the portfolio is unchanged since saving', () => {
    useLoopBuilderStore.setState({ savedStrategies: [fakeSavedStrategy()] });
    render(<LoopStrategyLibrary portfolio={fakePortfolio()} />);
    expect(screen.queryByText(/Saved against a different portfolio/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Portfolio has changed since/)).not.toBeInTheDocument();
  });

  it('shows "Portfolio has changed since this was saved." when the same portfolio has since been updated', () => {
    useLoopBuilderStore.setState({ savedStrategies: [fakeSavedStrategy()] });
    render(
      <LoopStrategyLibrary portfolio={fakePortfolio({ updatedAt: '2026-06-01T00:00:00.000Z' })} />,
    );
    expect(screen.getByText(/Portfolio has changed since this was saved\./)).toBeInTheDocument();
  });

  it('shows "Saved against a different portfolio." when the strategy belongs to a different portfolio', () => {
    useLoopBuilderStore.setState({ savedStrategies: [fakeSavedStrategy()] });
    render(<LoopStrategyLibrary portfolio={fakePortfolio({ id: 'p2' })} />);
    expect(screen.getByText(/Saved against a different portfolio\./)).toBeInTheDocument();
  });
});

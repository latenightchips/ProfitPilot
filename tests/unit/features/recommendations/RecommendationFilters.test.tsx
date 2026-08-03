import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { RecommendationFilters } from '@/features/recommendations';
import { useRecommendationCenterStore } from '@/stores/recommendationCenterStore';

/** Recommendation Filters — 06_TASKS.md M7-032 "Filter by". */
const INITIAL_STATE = {
  status: 'idle' as const,
  portfolioId: null,
  targetHealthFactor: null,
  actions: null,
  errors: [],
  lastMetadata: null,
  categoryFilter: 'all' as const,
  selectedItemId: null,
  acknowledgements: {},
};

beforeEach(() => {
  useRecommendationCenterStore.setState(INITIAL_STATE);
});

describe('RecommendationFilters', () => {
  it('renders "All" plus all six documented filter categories', () => {
    render(<RecommendationFilters />);
    ['All', 'Safety', 'Debt', 'Collateral', 'Interest', 'Leverage', 'Exit Readiness'].forEach(
      (label) => {
        expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
      },
    );
  });

  it('marks "All" as pressed by default', () => {
    render(<RecommendationFilters />);
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Debt' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking a category sets it as the active filter', async () => {
    const user = userEvent.setup();
    render(<RecommendationFilters />);

    await user.click(screen.getByRole('button', { name: 'Collateral' }));

    expect(useRecommendationCenterStore.getState().categoryFilter).toBe('collateral');
    expect(screen.getByRole('button', { name: 'Collateral' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking "All" after selecting a category resets the filter', async () => {
    const user = userEvent.setup();
    useRecommendationCenterStore.getState().setCategoryFilter('safety');
    render(<RecommendationFilters />);

    await user.click(screen.getByRole('button', { name: 'All' }));

    expect(useRecommendationCenterStore.getState().categoryFilter).toBe('all');
  });
});

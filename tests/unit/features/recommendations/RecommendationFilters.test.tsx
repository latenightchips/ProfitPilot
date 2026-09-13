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
  it('renders "All" plus the five remaining supported filter categories', () => {
    render(<RecommendationFilters />);
    ['All', 'Safety', 'Debt', 'Collateral', 'Interest', 'Leverage'].forEach((label) => {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    });
  });

  /**
   * Exit Readiness Removal batch (PROJECT_STATUS.md conflict #11, closed
   * WON'T-IMPLEMENT) — M7-032's own original task text named "Exit
   * readiness" as a sixth filter category; no button, tab, or unavailable
   * placeholder for it may render anywhere in this group, on any state.
   */
  it('renders no "Exit Readiness" filter/button/tab at all', () => {
    render(<RecommendationFilters />);
    expect(screen.queryByRole('button', { name: /exit readiness/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/exit readiness/i)).not.toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(6); // All + 5 categories, not 7.
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

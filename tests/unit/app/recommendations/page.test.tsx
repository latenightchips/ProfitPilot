import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import RecommendationsPage from '@/app/recommendations/page';
import { usePortfolioStore } from '@/stores/portfolioStore';
import { useRecommendationCenterStore } from '@/stores/recommendationCenterStore';

/**
 * Recommendation Center Route — 06_TASKS.md M7-031. Include: "Portfolio
 * summary, Recommendation filters, Prioritized list, Recommendation
 * details, Related actions." DoD: "Users can review more
 * recommendations than the Dashboard summary displays." Also exercises
 * M7-036 (Recalculation) end to end.
 */
const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

beforeEach(() => {
  usePortfolioStore.setState({
    portfolios: {},
    activePortfolioId: null,
    loadStatus: 'idle',
    saveStatus: 'idle',
    errors: [],
    lastSynchronizedAt: null,
  });
  useRecommendationCenterStore.setState({
    status: 'idle',
    portfolioId: null,
    targetHealthFactor: null,
    actions: null,
    errors: [],
    lastMetadata: null,
    categoryFilter: 'all',
    selectedItemId: null,
    acknowledgements: {},
  });
  push.mockClear();
});

function validInput(overrides: Record<string, unknown> = {}) {
  return {
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
    settings: { safetyTargets: { targetHealthFactor: 8 } },
    ...overrides,
  };
}

function selectActivePortfolio(overrides: Record<string, unknown> = {}) {
  const created = usePortfolioStore.getState().create(validInput(overrides));
  if (!created.ok) throw new Error('setup failed');
  usePortfolioStore.getState().select(created.data.id);
  return created.data;
}

describe('RecommendationsPage — no active portfolio', () => {
  it('shows a prompt to select or create a portfolio', () => {
    render(<RecommendationsPage />);
    expect(screen.getByText(/No portfolio is currently selected/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Select or create one' })).toHaveAttribute(
      'href',
      '/portfolios',
    );
  });

  it('does not render the Recommendation Center sections', () => {
    render(<RecommendationsPage />);
    expect(screen.queryByText('Portfolio Summary')).not.toBeInTheDocument();
    expect(screen.queryByText('Filters')).not.toBeInTheDocument();
  });
});

describe('RecommendationsPage — with an active portfolio (M7-036 recalculation)', () => {
  it('recalculates on mount and renders the real, computed recommendations — more than the Dashboard summary shows', () => {
    selectActivePortfolio();
    render(<RecommendationsPage />);

    expect(useRecommendationCenterStore.getState().status).toBe('ready');
    expect(screen.getByText('Portfolio Summary')).toBeInTheDocument();
    expect(screen.getByText('Filters')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Current debt exceeds the target debt required to reach the requested Health Factor.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Current collateral is insufficient to reach the requested Health Factor.'),
    ).toBeInTheDocument();
  });

  it('recalculates again when the active portfolio is edited (a real position-update trigger)', () => {
    const portfolio = selectActivePortfolio();
    render(<RecommendationsPage />);
    expect(
      useRecommendationCenterStore.getState().actions?.repayment.relevantValues.requiredRepayment,
    ).toBe(10000);

    // A real debt increase — should genuinely change the computed
    // repayment recommendation, not just re-run the same numbers.
    act(() => {
      usePortfolioStore
        .getState()
        .update(portfolio.id, { debt: { asset: 'USDC', balance: 25000 } });
    });

    expect(
      useRecommendationCenterStore.getState().actions?.repayment.relevantValues.requiredRepayment,
    ).toBe(15000);
  });

  it('recalculates for the newly selected portfolio on an active-portfolio switch', () => {
    selectActivePortfolio({ name: 'Portfolio A' });
    render(<RecommendationsPage />);
    const firstPortfolioId = useRecommendationCenterStore.getState().portfolioId;

    let second!: ReturnType<typeof selectActivePortfolio>;
    act(() => {
      second = selectActivePortfolio({
        name: 'Portfolio B',
        debt: { asset: 'USDC', balance: 5000 },
      });
    });

    expect(useRecommendationCenterStore.getState().portfolioId).toBe(second.id);
    expect(useRecommendationCenterStore.getState().portfolioId).not.toBe(firstPortfolioId);
  });

  it('shows a real, non-fabricated message when the portfolio has no configured target Health Factor', () => {
    selectActivePortfolio({ settings: {} });
    render(<RecommendationsPage />);

    expect(useRecommendationCenterStore.getState().status).toBe('noTarget');
    expect(screen.getByText(/No target Health Factor is configured/)).toBeInTheDocument();
  });

  it('lets the user select a recommendation and see its full detail', async () => {
    const user = userEvent.setup();
    selectActivePortfolio();
    render(<RecommendationsPage />);

    await user.click(
      screen.getByText(
        'Current debt exceeds the target debt required to reach the requested Health Factor.',
      ),
    );

    expect(screen.getByText('Triggering Condition')).toBeInTheDocument();
    expect(screen.getByText('Related Strategy Tool')).toBeInTheDocument();
  });
});

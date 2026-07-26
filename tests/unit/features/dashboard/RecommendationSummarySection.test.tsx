import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { buildRecommendationSummary, RecommendationSummarySection } from '@/features/dashboard';
import { usePortfolioStore } from '@/stores/portfolioStore';

/**
 * Recommendation Summary Section — 06_TASKS.md M5-015.
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
    settings: {},
    ...overrides,
  };
}

function createPortfolio(overrides: Record<string, unknown> = {}) {
  const created = usePortfolioStore.getState().create(validInput(overrides));
  if (!created.ok) throw new Error('setup failed');
  return created.data;
}

describe('RecommendationSummarySection — no recommendations', () => {
  it('renders nothing when the list is empty', () => {
    const portfolio = createPortfolio();
    const { container } = render(
      <RecommendationSummarySection summary={buildRecommendationSummary(portfolio)} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe('RecommendationSummarySection — active recommendations', () => {
  it('renders the section heading and both recommendation entries', () => {
    const portfolio = createPortfolio({
      settings: { safetyTargets: { targetHealthFactor: 5 } },
    });
    render(<RecommendationSummarySection summary={buildRecommendationSummary(portfolio)} />);

    expect(screen.getByText('Recommendations')).toBeInTheDocument();
    expect(screen.getByText('Priority 1')).toBeInTheDocument();
    expect(screen.getByText('Priority 2')).toBeInTheDocument();
    expect(screen.getByText('Category: debtManagement')).toBeInTheDocument();
    expect(screen.getByText('Category: collateralManagement')).toBeInTheDocument();
  });
});

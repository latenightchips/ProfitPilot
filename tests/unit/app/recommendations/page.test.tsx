import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import RecommendationsPage from '@/app/recommendations/page';
import { useAaveLiveDataStore } from '@/stores/aaveLiveDataStore';
import { useAaveV4LiveDataStore } from '@/stores/aaveV4LiveDataStore';
import { usePortfolioStore } from '@/stores/portfolioStore';
import { useRecommendationCenterStore } from '@/stores/recommendationCenterStore';

const V4_ADDRESS = '0x1234567890123456789012345678901234567890';

/**
 * V4 Readiness Audit §12 Stage 21 — mirrors `tests/unit/app/page.test.tsx`'s
 * own `matchingAaveLiveState` helper exactly: stubs a `'ready'` V3 quote
 * matching `validInput()`'s own `market`/`protocol` defaults, so the
 * live-sync equality gate is a no-op for every pre-existing test below and
 * no unmocked real `fetch()` call happens during render now that this
 * route also mounts `useAaveLiveSync`/`useAaveV4LiveSync`.
 */
function matchingAaveLiveState(
  overrides: Partial<ReturnType<typeof useAaveLiveDataStore.getState>> = {},
) {
  return {
    status: 'ready' as const,
    marketQuote: {
      asset: 'BTC',
      currency: 'USD',
      freshness: 'fresh' as const,
      price: 50000,
      origin: 'provider' as const,
      timestamp: new Date().toISOString(),
    },
    protocolQuote: {
      available: true as const,
      collateralAsset: 'WBTC',
      borrowAsset: 'USDC',
      parameters: {
        maxLoanToValue: 0.75,
        liquidationThreshold: 0.8,
        borrowApr: 0.05,
        supplyApr: 0.02,
      },
      origin: 'live' as const,
      timestamp: new Date().toISOString(),
    },
    collateralSymbol: 'WBTC',
    borrowSymbol: 'USDC',
    source: {
      protocol: 'aave' as const,
      version: 'v3' as const,
      network: 'Ethereum Mainnet',
      method: 'rpc' as const,
      blockNumber: '21000000',
    },
    errorMessage: null,
    fetchLiveAaveData: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

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
  useAaveLiveDataStore.setState(matchingAaveLiveState());
  useAaveV4LiveDataStore.setState({
    status: 'idle',
    engineInputs: null,
    userAddress: null,
    debtAsset: null,
    errorMessage: null,
    lastFetchedAt: new Date().toISOString(),
    fetchAaveV4LiveData: vi.fn().mockResolvedValue(undefined),
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

/**
 * V4 Readiness Audit §12 Stage 21 — this route previously mounted neither
 * `useAaveLiveSync` nor `useAaveV4LiveSync`, so a user who navigated
 * straight here (never having visited Dashboard/Portfolio first) would
 * have `StrategyAssumptionsPanel`'s Manual-Data Status derived from a
 * live-data store still at its default `'idle'` state, which
 * `deriveProtocolStatus` reports as permanently "Loading" for a V4
 * portfolio. This describe block proves the fix: the route's own mount
 * now fetches independently, exactly like Dashboard/Portfolio already do.
 */
describe('RecommendationsPage — V4 live-sync invocation (Stage 21)', () => {
  it('fetches live Aave V3 data on mount, independently of Dashboard/Portfolio', () => {
    selectActivePortfolio();
    render(<RecommendationsPage />);
    expect(useAaveLiveDataStore.getState().fetchLiveAaveData).toHaveBeenCalled();
  });

  it('fetches live Aave V4 data on mount once a V4 address is set — status does not stay stuck at idle/loading on direct navigation', () => {
    const portfolio = selectActivePortfolio();
    usePortfolioStore.getState().setProtocolVersion(portfolio.id, 'v4');
    usePortfolioStore.getState().setAaveV4Position(portfolio.id, { userAddress: V4_ADDRESS });

    render(<RecommendationsPage />);

    expect(useAaveV4LiveDataStore.getState().fetchAaveV4LiveData).toHaveBeenCalledWith(
      V4_ADDRESS,
      'USDC',
    );
  });

  it('shows real "Aave V4 · Live" status in the Portfolio Summary panel for a fully-synced V4 portfolio, not a stuck Loading state', () => {
    const portfolio = selectActivePortfolio();
    usePortfolioStore.getState().setProtocolVersion(portfolio.id, 'v4');
    usePortfolioStore.getState().setAaveV4Position(portfolio.id, { userAddress: V4_ADDRESS });
    usePortfolioStore.getState().setAaveV4DebtState(portfolio.id, {
      drawnDebt: 15000,
      premiumDebt: 500,
      baseDrawnApr: 0.05,
      riskPremium: 0.01,
    });
    useAaveV4LiveDataStore.setState({ status: 'ready' });

    render(<RecommendationsPage />);

    expect(screen.getByText('Aave V4 · Live')).toBeInTheDocument();
    expect(screen.queryByText('Aave V4 · Loading')).not.toBeInTheDocument();
  });

  it('never displays the raw V3 protocol.borrowApr for a V4 portfolio, and both Borrow Rate display locations agree', () => {
    const portfolio = usePortfolioStore.getState().create(
      validInput({
        protocol: {
          maxLoanToValue: 0.75,
          liquidationThreshold: 0.8,
          borrowApr: 0.99,
          supplyApr: 0.02,
        },
      }),
    );
    if (!portfolio.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(portfolio.data.id);
    usePortfolioStore.getState().setProtocolVersion(portfolio.data.id, 'v4');
    usePortfolioStore.getState().setAaveV4Position(portfolio.data.id, { userAddress: V4_ADDRESS });
    usePortfolioStore.getState().setAaveV4DebtState(portfolio.data.id, {
      drawnDebt: 15000,
      premiumDebt: 500,
      baseDrawnApr: 0.05,
      riskPremium: 0.01,
    });
    useAaveV4LiveDataStore.setState({ status: 'ready' });

    render(<RecommendationsPage />);

    expect(screen.queryByText(/99\.00%/)).not.toBeInTheDocument();
    const borrowRateLabel = screen.getByText('Borrow Rate');
    const borrowRateValue = borrowRateLabel.nextElementSibling?.textContent;
    expect(borrowRateValue).not.toBe('Not available');
    const protocolParamsValue = screen.getByText('Protocol Parameters').nextElementSibling;
    expect(protocolParamsValue?.textContent).toContain(borrowRateValue ?? '__unmatched__');
  });
});

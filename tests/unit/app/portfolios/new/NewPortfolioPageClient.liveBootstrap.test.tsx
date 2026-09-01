import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NewPortfolioPageClient } from '@/app/portfolios/new/NewPortfolioPageClient';
import { useAaveLiveDataStore } from '@/stores/aaveLiveDataStore';
import { useAaveV4CollateralRiskLiveDataStore } from '@/stores/aaveV4CollateralRiskLiveDataStore';
import { useAaveV4LiveDataStore } from '@/stores/aaveV4LiveDataStore';
import { usePortfolioStore } from '@/stores/portfolioStore';

/**
 * V3 New-Portfolio Live Bootstrap — production smoke-test finding.
 * `useAaveLiveDataStore.setState(...)` is driven directly rather than
 * mocking `fetch`, the same technique
 * `tests/unit/hooks/useAaveLiveSync.test.ts` already established for the
 * same underlying store — these tests exercise the form's own prefill/
 * dirty-tracking/provenance logic in isolation from the already-covered
 * fetch-and-normalize pipeline (`tests/unit/stores/aaveLiveDataStore.test.ts`,
 * `tests/unit/services/{market,protocol}/quote.test.ts`).
 */
const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

const INITIAL_PORTFOLIO_STATE = {
  portfolios: {},
  activePortfolioId: null,
  loadStatus: 'idle' as const,
  saveStatus: 'idle' as const,
  errors: [],
  lastSynchronizedAt: null,
};

const IDLE_AAVE_STATE = {
  status: 'idle' as const,
  marketQuote: null,
  protocolQuote: null,
  collateralSymbol: null,
  borrowSymbol: null,
  source: null,
  errorMessage: null,
  fetchLiveAaveData: vi.fn().mockResolvedValue(undefined),
};

function readyAaveState(overrides: { borrowAsset?: string; freshness?: 'fresh' | 'stale' } = {}) {
  return {
    status: 'ready' as const,
    marketQuote: {
      asset: 'BTC',
      currency: 'USD',
      freshness: overrides.freshness ?? ('fresh' as const),
      price: 65000,
      origin: 'provider' as const,
      timestamp: new Date().toISOString(),
    },
    protocolQuote: {
      available: true as const,
      collateralAsset: 'BTC',
      borrowAsset: overrides.borrowAsset ?? 'USDC',
      parameters: {
        maxLoanToValue: 0.75,
        liquidationThreshold: 0.8,
        borrowApr: 0.05,
        supplyApr: 0.02,
      },
      origin: 'live' as const,
      timestamp: new Date().toISOString(),
    },
    collateralSymbol: 'BTC',
    borrowSymbol: overrides.borrowAsset ?? 'USDC',
    source: {
      protocol: 'aave' as const,
      version: 'v3' as const,
      network: 'Ethereum Mainnet',
      method: 'rpc' as const,
      blockNumber: '21000000',
    },
    errorMessage: null,
    fetchLiveAaveData: vi.fn().mockResolvedValue(undefined),
  };
}

const IDLE_V4_DEBT_STATE = {
  status: 'idle' as const,
  engineInputs: null,
  userAddress: null,
  debtAsset: null,
  errorMessage: null,
  errorCode: null,
  attemptedUserAddress: null,
  attemptedDebtAsset: null,
  lastFetchedAt: null,
  fetchAaveV4LiveData: vi.fn().mockResolvedValue(undefined),
};

const IDLE_V4_COLLATERAL_RISK_STATE = {
  status: 'idle' as const,
  canonical: null,
  userAddress: null,
  errorMessage: null,
  errorCode: null,
  attemptedUserAddress: null,
  lastFetchedAt: null,
  fetchAaveV4CollateralRiskLiveData: vi.fn().mockResolvedValue(undefined),
};

beforeEach(() => {
  usePortfolioStore.setState(INITIAL_PORTFOLIO_STATE);
  useAaveLiveDataStore.setState(IDLE_AAVE_STATE);
  useAaveV4LiveDataStore.setState(IDLE_V4_DEBT_STATE);
  useAaveV4CollateralRiskLiveDataStore.setState(IDLE_V4_COLLATERAL_RISK_STATE);
  push.mockClear();
});

async function fillNonPrefilledFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Portfolio name', { exact: false }), 'My Portfolio');
  await user.clear(screen.getByLabelText('BTC quantity', { exact: false }));
  await user.type(screen.getByLabelText('BTC quantity', { exact: false }), '2');
  await user.clear(screen.getByLabelText('Debt balance', { exact: false }));
  await user.type(screen.getByLabelText('Debt balance', { exact: false }), '20000');
}

describe('NewPortfolioPageClient — live bootstrap: fetch triggering (1, 8, 9)', () => {
  it('1. attempts the live bootstrap on initial load', () => {
    render(<NewPortfolioPageClient />);
    expect(useAaveLiveDataStore.getState().fetchLiveAaveData).toHaveBeenCalledWith('USDC');
  });

  it('8. re-fetches when the selected debt asset changes', async () => {
    const user = userEvent.setup();
    render(<NewPortfolioPageClient />);
    expect(useAaveLiveDataStore.getState().fetchLiveAaveData).toHaveBeenCalledWith('USDC');

    await user.selectOptions(screen.getByLabelText('Debt asset', { exact: false }), 'USDT');
    await waitFor(() => {
      expect(useAaveLiveDataStore.getState().fetchLiveAaveData).toHaveBeenCalledWith('USDT');
    });
  });

  it('9. does not prefill protocol fields from a quote whose borrowAsset no longer matches the selected debt asset (stale-response guard)', () => {
    useAaveLiveDataStore.setState(readyAaveState({ borrowAsset: 'USDT' }));
    render(<NewPortfolioPageClient />);

    // Form's own debt-asset default is USDC; the ready quote is for USDT
    // (as if it landed just after a switch back to USDC) — protocol must
    // stay at its manual-entry default. Market price has no such
    // per-asset guard (BTC price is asset-independent) and still
    // prefills.
    expect(screen.getByLabelText('Maximum LTV (%)', { exact: false })).toHaveValue(0);
    expect(screen.getByLabelText('Current BTC price (USD)', { exact: false })).toHaveValue(65000);
  });
});

describe('NewPortfolioPageClient — live bootstrap: prefill values (2)', () => {
  it('2. prefills BTC price and all four protocol fields, percent-scaled correctly', () => {
    useAaveLiveDataStore.setState(readyAaveState());
    render(<NewPortfolioPageClient />);

    expect(screen.getByLabelText('Current BTC price (USD)', { exact: false })).toHaveValue(65000);
    expect(screen.getByLabelText('Maximum LTV (%)', { exact: false })).toHaveValue(75);
    expect(screen.getByLabelText('Liquidation threshold (%)', { exact: false })).toHaveValue(80);
    expect(screen.getByLabelText('Borrow APR (%)', { exact: false })).toHaveValue(5);
    expect(screen.getByLabelText('Supply APR (%)', { exact: false })).toHaveValue(2);
  });

  it('clearly labels the prefilled values as live', () => {
    useAaveLiveDataStore.setState(readyAaveState());
    render(<NewPortfolioPageClient />);
    expect(screen.getAllByText('Aave V3 · Live').length).toBeGreaterThan(0);
  });
});

describe('NewPortfolioPageClient — live bootstrap: provenance at submission (3, 4, 5, 6)', () => {
  it('3. persists marketSource and protocolSource as live when both prefilled values are left untouched', async () => {
    useAaveLiveDataStore.setState(readyAaveState());
    const user = userEvent.setup();
    render(<NewPortfolioPageClient />);
    await fillNonPrefilledFields(user);
    await user.click(screen.getByRole('button', { name: 'Create Portfolio' }));

    const portfolios = Object.values(usePortfolioStore.getState().portfolios);
    expect(portfolios).toHaveLength(1);
    expect(portfolios[0].portfolio.marketSource).toBe('live');
    expect(portfolios[0].portfolio.protocolSource).toBe('live');
    expect(portfolios[0].portfolio.market.btcPriceUsd).toBe(65000);
    expect(portfolios[0].portfolio.protocol.maxLoanToValue).toBe(0.75);
  });

  it('4. persists marketSource: manual when the live-prefilled BTC price is edited, protocolSource stays live', async () => {
    useAaveLiveDataStore.setState(readyAaveState());
    const user = userEvent.setup();
    render(<NewPortfolioPageClient />);
    await fillNonPrefilledFields(user);

    await user.clear(screen.getByLabelText('Current BTC price (USD)', { exact: false }));
    await user.type(screen.getByLabelText('Current BTC price (USD)', { exact: false }), '70000');
    await user.click(screen.getByRole('button', { name: 'Create Portfolio' }));

    const portfolios = Object.values(usePortfolioStore.getState().portfolios);
    expect(portfolios).toHaveLength(1);
    expect(portfolios[0].portfolio.marketSource).toBe('manual');
    expect(portfolios[0].portfolio.protocolSource).toBe('live');
    expect(portfolios[0].portfolio.market.btcPriceUsd).toBe(70000);
  });

  it('5. persists protocolSource: manual when only one live-prefilled protocol field is edited, marketSource stays live', async () => {
    useAaveLiveDataStore.setState(readyAaveState());
    const user = userEvent.setup();
    render(<NewPortfolioPageClient />);
    await fillNonPrefilledFields(user);

    await user.clear(screen.getByLabelText('Borrow APR (%)', { exact: false }));
    await user.type(screen.getByLabelText('Borrow APR (%)', { exact: false }), '6');
    await user.click(screen.getByRole('button', { name: 'Create Portfolio' }));

    const portfolios = Object.values(usePortfolioStore.getState().portfolios);
    expect(portfolios).toHaveLength(1);
    expect(portfolios[0].portfolio.marketSource).toBe('live');
    expect(portfolios[0].portfolio.protocolSource).toBe('manual');
    expect(portfolios[0].portfolio.protocol.borrowApr).toBeCloseTo(0.06);
    // Untouched protocol fields still carry the live-prefilled values —
    // one edited field marks the whole atomic `protocol` group manual,
    // it does not revert the sibling fields' own values.
    expect(portfolios[0].portfolio.protocol.maxLoanToValue).toBe(0.75);
  });

  it('6. persists both manual when both groups are edited', async () => {
    useAaveLiveDataStore.setState(readyAaveState());
    const user = userEvent.setup();
    render(<NewPortfolioPageClient />);
    await fillNonPrefilledFields(user);

    await user.clear(screen.getByLabelText('Current BTC price (USD)', { exact: false }));
    await user.type(screen.getByLabelText('Current BTC price (USD)', { exact: false }), '70000');
    await user.clear(screen.getByLabelText('Maximum LTV (%)', { exact: false }));
    await user.type(screen.getByLabelText('Maximum LTV (%)', { exact: false }), '70');
    await user.click(screen.getByRole('button', { name: 'Create Portfolio' }));

    const portfolios = Object.values(usePortfolioStore.getState().portfolios);
    expect(portfolios).toHaveLength(1);
    expect(portfolios[0].portfolio.marketSource).toBe('manual');
    expect(portfolios[0].portfolio.protocolSource).toBe('manual');
  });
});

describe('NewPortfolioPageClient — live bootstrap: graceful fallback (7, 10)', () => {
  it('7a. loading state: fields stay at manual defaults, status line says so, never claims live', () => {
    useAaveLiveDataStore.setState({ ...IDLE_AAVE_STATE, status: 'loading' as const });
    render(<NewPortfolioPageClient />);

    expect(screen.getByLabelText('Current BTC price (USD)', { exact: false })).toHaveValue(0);
    expect(screen.getAllByText('Checking for live Aave V3 data…').length).toBeGreaterThan(0);
    expect(screen.queryByText('Aave V3 · Live')).not.toBeInTheDocument();
  });

  it('7b. error state: fields stay at manual defaults, status line is honest, does not claim live', () => {
    useAaveLiveDataStore.setState({
      ...IDLE_AAVE_STATE,
      status: 'error' as const,
      errorMessage: 'Live Aave data is temporarily unavailable.',
    });
    render(<NewPortfolioPageClient />);

    expect(screen.getByLabelText('Current BTC price (USD)', { exact: false })).toHaveValue(0);
    expect(screen.getAllByText(/unavailable right now/i).length).toBeGreaterThan(0);
    expect(screen.queryByText('Aave V3 · Live')).not.toBeInTheDocument();
  });

  it('7c. ready but unavailable market quote: fields stay at manual defaults, never claims live', () => {
    useAaveLiveDataStore.setState({
      status: 'ready' as const,
      marketQuote: { asset: 'BTC', currency: 'USD', freshness: 'unavailable' as const },
      protocolQuote: { available: false as const, collateralAsset: 'BTC', borrowAsset: 'USDC' },
      collateralSymbol: 'BTC',
      borrowSymbol: 'USDC',
      source: null,
      errorMessage: null,
      fetchLiveAaveData: vi.fn().mockResolvedValue(undefined),
    });
    render(<NewPortfolioPageClient />);

    expect(screen.getByLabelText('Current BTC price (USD)', { exact: false })).toHaveValue(0);
    expect(screen.getByLabelText('Maximum LTV (%)', { exact: false })).toHaveValue(0);
    expect(screen.queryByText('Aave V3 · Live')).not.toBeInTheDocument();
  });

  it('10. creation still succeeds, fully manually, when live data never becomes available', async () => {
    useAaveLiveDataStore.setState({ ...IDLE_AAVE_STATE, status: 'error' as const });
    const user = userEvent.setup();
    render(<NewPortfolioPageClient />);
    await fillNonPrefilledFields(user);
    await user.type(screen.getByLabelText('Current BTC price (USD)', { exact: false }), '50000');
    await user.type(screen.getByLabelText('Maximum LTV (%)', { exact: false }), '75');
    await user.type(screen.getByLabelText('Liquidation threshold (%)', { exact: false }), '80');
    await user.type(screen.getByLabelText('Borrow APR (%)', { exact: false }), '5');
    await user.type(screen.getByLabelText('Supply APR (%)', { exact: false }), '2');
    await user.click(screen.getByRole('button', { name: 'Create Portfolio' }));

    const portfolios = Object.values(usePortfolioStore.getState().portfolios);
    expect(portfolios).toHaveLength(1);
    expect(portfolios[0].portfolio.marketSource).toBe('manual');
    expect(portfolios[0].portfolio.protocolSource).toBe('manual');
    expect(push).toHaveBeenCalledWith('/portfolio');
  });
});

describe('NewPortfolioPageClient — V3 default, V4 opt-in (11)', () => {
  it('11. a portfolio created through the V3 live bootstrap (default selection, untouched) is still plain V3-shaped — no protocolVersion, no V4 fields', async () => {
    useAaveLiveDataStore.setState(readyAaveState());
    const user = userEvent.setup();
    render(<NewPortfolioPageClient />);
    await fillNonPrefilledFields(user);
    await user.click(screen.getByRole('button', { name: 'Create Portfolio' }));

    const portfolios = Object.values(usePortfolioStore.getState().portfolios);
    expect(portfolios).toHaveLength(1);
    expect(portfolios[0].portfolio.protocolVersion).toBeUndefined();
    expect(portfolios[0].portfolio.v4Position).toBeUndefined();
    expect(portfolios[0].portfolio.v4DebtState).toBeUndefined();
  });

  it('renders an Aave protocol version selector defaulted to V3 (Protocol Selection at Portfolio Creation)', () => {
    render(<NewPortfolioPageClient />);
    const radiogroup = screen.getByRole('radiogroup', { name: 'Aave protocol version' });
    expect(radiogroup).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Aave V3' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Aave V4' })).not.toBeChecked();
    // V3 remains selected by default: the V4-only fieldset is not rendered.
    expect(screen.queryByLabelText('On-chain address (optional)')).not.toBeInTheDocument();
  });
});

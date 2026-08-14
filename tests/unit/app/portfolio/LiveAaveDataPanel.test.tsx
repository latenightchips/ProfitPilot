import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LiveAaveDataPanel } from '@/app/portfolio/LiveAaveDataPanel';
import { useAaveLiveDataStore } from '@/stores/aaveLiveDataStore';

/**
 * Live Aave Data panel — Phase 1 read-only live-data integration.
 * `fetchLiveAaveData` itself is exercised elsewhere
 * (`tests/unit/stores/aaveLiveDataStore.test.ts`); these tests only
 * check that this component renders the right thing for each Store
 * state, and never exposes GraphQL/contract/implementation language.
 */
const READY_STATE = {
  status: 'ready' as const,
  marketQuote: {
    asset: 'BTC',
    currency: 'USD',
    freshness: 'fresh' as const,
    price: 60000,
    origin: 'provider' as const,
    timestamp: new Date().toISOString(),
  },
  protocolQuote: {
    available: true as const,
    collateralAsset: 'WBTC',
    borrowAsset: 'USDC',
    parameters: {
      maxLoanToValue: 0.73,
      liquidationThreshold: 0.78,
      borrowApr: 0.05,
      supplyApr: 0.005,
    },
    origin: 'live' as const,
    timestamp: new Date().toISOString(),
  },
  collateralSymbol: 'WBTC',
  borrowSymbol: 'USDC',
  errorMessage: null,
};

const IDLE_STATE = {
  status: 'idle' as const,
  marketQuote: null,
  protocolQuote: null,
  collateralSymbol: null,
  borrowSymbol: null,
  errorMessage: null,
};

beforeEach(() => {
  useAaveLiveDataStore.setState({
    ...IDLE_STATE,
    fetchLiveAaveData: vi.fn().mockResolvedValue(undefined),
  });
});

describe('LiveAaveDataPanel — loading state', () => {
  it('shows a loading message before any data has arrived', () => {
    useAaveLiveDataStore.setState({ status: 'loading' });
    render(<LiveAaveDataPanel />);
    expect(screen.getByText('Loading live Aave data…')).toBeInTheDocument();
  });
});

describe('LiveAaveDataPanel — ready state', () => {
  it('shows the four named values with plain, non-technical labels', () => {
    useAaveLiveDataStore.setState(READY_STATE);
    render(<LiveAaveDataPanel />);

    expect(screen.getByText('Live Aave data')).toBeInTheDocument();
    expect(screen.getByText(/Updated:/)).toBeInTheDocument();
    expect(screen.getByText('BTC price')).toBeInTheDocument();
    expect(screen.getByText('$60,000.00')).toBeInTheDocument();
    expect(screen.getByText('Maximum LTV')).toBeInTheDocument();
    expect(screen.getByText('73.00%')).toBeInTheDocument();
    expect(screen.getByText('Liquidation threshold')).toBeInTheDocument();
    expect(screen.getByText('78.00%')).toBeInTheDocument();
    expect(screen.getByText('Borrow rate')).toBeInTheDocument();
    expect(screen.getByText('5.00%')).toBeInTheDocument();
  });

  it('never renders GraphQL/contract/implementation jargon', () => {
    useAaveLiveDataStore.setState(READY_STATE);
    render(<LiveAaveDataPanel />);

    const bodyText = document.body.textContent ?? '';
    for (const forbidden of ['GraphQL', 'subgraph', 'WBTC', 'reserve', 'Formula', '0x2260fac']) {
      expect(bodyText).not.toContain(forbidden);
    }
  });

  it('states plainly that manual entry below is still what the portfolio uses', () => {
    useAaveLiveDataStore.setState(READY_STATE);
    render(<LiveAaveDataPanel />);
    expect(screen.getByText(/still uses the manual entries below/)).toBeInTheDocument();
  });
});

describe('LiveAaveDataPanel — error state, no prior data', () => {
  it('shows a simple fallback message, not raw error internals', () => {
    useAaveLiveDataStore.setState({
      ...IDLE_STATE,
      status: 'error',
      errorMessage: 'Live Aave data is temporarily unavailable.',
    });
    render(<LiveAaveDataPanel />);

    expect(
      screen.getByText(/Live Aave data is temporarily unavailable\. You can still enter values/),
    ).toBeInTheDocument();
  });
});

describe('LiveAaveDataPanel — error state, with prior good data (fallback preserves last values)', () => {
  it('keeps showing the last known values alongside a refresh-failed notice', () => {
    useAaveLiveDataStore.setState({
      ...READY_STATE,
      status: 'error',
      errorMessage: 'Live Aave data is temporarily unavailable.',
    });
    render(<LiveAaveDataPanel />);

    expect(screen.getByText(/Couldn.t refresh just now/)).toBeInTheDocument();
    // The last-known values are still visible underneath the notice.
    expect(screen.getByText('$60,000.00')).toBeInTheDocument();
    expect(screen.getByText('73.00%')).toBeInTheDocument();
  });
});

describe('LiveAaveDataPanel — refresh action', () => {
  it('fetches once on mount, and again when Refresh is clicked', async () => {
    const fetchLiveAaveData = vi.fn().mockResolvedValue(undefined);
    useAaveLiveDataStore.setState({ ...IDLE_STATE, fetchLiveAaveData });

    const user = userEvent.setup();
    render(<LiveAaveDataPanel />);
    expect(fetchLiveAaveData).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(fetchLiveAaveData).toHaveBeenCalledTimes(2);
  });

  it('disables the Refresh button while a fetch is in flight', () => {
    useAaveLiveDataStore.setState({ ...IDLE_STATE, status: 'loading' });
    render(<LiveAaveDataPanel />);
    expect(screen.getByRole('button', { name: 'Refreshing…' })).toBeDisabled();
  });
});

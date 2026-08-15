import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { AaveTechnicalDetails } from '@/app/portfolio/AaveTechnicalDetails';
import { useAaveLiveDataStore } from '@/stores/aaveLiveDataStore';
import { useDeveloperModeStore } from '@/stores/developerModeStore';

/**
 * Technical details — Portfolio Live-State Cleanup batch. Approved
 * design: one shared block, gated behind Developer Mode, showing
 * verification data (protocol/version, network, block number, method,
 * fetch timestamp) — never shown to a user with Developer Mode off.
 */
const READY_STATE = {
  status: 'ready' as const,
  marketQuote: {
    asset: 'BTC',
    currency: 'USD',
    freshness: 'fresh' as const,
    price: 65000,
    origin: 'provider' as const,
    timestamp: '2026-08-15T12:00:00.000Z',
  },
  protocolQuote: {
    available: true as const,
    collateralAsset: 'WBTC',
    borrowAsset: 'USDC',
    parameters: {
      maxLoanToValue: 0.73,
      liquidationThreshold: 0.78,
      borrowApr: 0.0399,
      supplyApr: 0.005,
    },
    origin: 'live' as const,
    timestamp: '2026-08-15T12:00:00.000Z',
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
};

const IDLE_STATE = {
  status: 'idle' as const,
  marketQuote: null,
  protocolQuote: null,
  collateralSymbol: null,
  borrowSymbol: null,
  source: null,
  errorMessage: null,
};

beforeEach(() => {
  useAaveLiveDataStore.setState(IDLE_STATE);
  useDeveloperModeStore.setState({ enabled: false });
});

describe('AaveTechnicalDetails — Developer Mode gating', () => {
  it('renders nothing when Developer Mode is off, even with live data available', () => {
    useAaveLiveDataStore.setState(READY_STATE);
    useDeveloperModeStore.setState({ enabled: false });
    const { container } = render(<AaveTechnicalDetails />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders when Developer Mode is on', () => {
    useAaveLiveDataStore.setState(READY_STATE);
    useDeveloperModeStore.setState({ enabled: true });
    render(<AaveTechnicalDetails />);
    expect(screen.getByText('Technical details')).toBeInTheDocument();
  });
});

describe('AaveTechnicalDetails — verification data shown in Developer Mode', () => {
  beforeEach(() => {
    useDeveloperModeStore.setState({ enabled: true });
  });

  it('shows protocol/version, network, method, and block number', () => {
    useAaveLiveDataStore.setState(READY_STATE);
    render(<AaveTechnicalDetails />);

    expect(screen.getByText('aave v3')).toBeInTheDocument();
    expect(screen.getByText('Ethereum Mainnet')).toBeInTheDocument();
    expect(screen.getByText('rpc')).toBeInTheDocument();
    expect(screen.getByText('21000000')).toBeInTheDocument();
  });

  it('shows the fetch timestamp', () => {
    useAaveLiveDataStore.setState(READY_STATE);
    render(<AaveTechnicalDetails />);
    expect(screen.getByText('Fetched at')).toBeInTheDocument();
  });

  it('shows the Live/Stale/Unavailable status', () => {
    useAaveLiveDataStore.setState(READY_STATE);
    render(<AaveTechnicalDetails />);
    expect(screen.getByText('Aave V3 · Live')).toBeInTheDocument();
  });

  it('shows a "no data yet" message before any fetch has ever succeeded', () => {
    render(<AaveTechnicalDetails />);
    expect(screen.getByText('No live Aave data fetched yet.')).toBeInTheDocument();
  });

  it('shows the last refresh failure message when status is error', () => {
    useAaveLiveDataStore.setState({
      ...READY_STATE,
      status: 'error',
      errorMessage: 'RPC network error: timeout',
    });
    render(<AaveTechnicalDetails />);
    expect(screen.getByText(/Last refresh failed: RPC network error: timeout/)).toBeInTheDocument();
  });
});

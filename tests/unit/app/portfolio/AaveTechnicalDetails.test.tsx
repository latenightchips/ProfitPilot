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
    const { container } = render(<AaveTechnicalDetails protocolVersion="v3" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders when Developer Mode is on', () => {
    useAaveLiveDataStore.setState(READY_STATE);
    useDeveloperModeStore.setState({ enabled: true });
    render(<AaveTechnicalDetails protocolVersion="v3" />);
    expect(screen.getByText('Technical details')).toBeInTheDocument();
  });

  it('renders nothing for a V4 portfolio when Developer Mode is off', () => {
    useAaveLiveDataStore.setState(READY_STATE);
    useDeveloperModeStore.setState({ enabled: false });
    const { container } = render(<AaveTechnicalDetails protocolVersion="v4" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('AaveTechnicalDetails — verification data shown in Developer Mode (V3)', () => {
  beforeEach(() => {
    useDeveloperModeStore.setState({ enabled: true });
  });

  it('shows protocol/version, network, method, and block number', () => {
    useAaveLiveDataStore.setState(READY_STATE);
    render(<AaveTechnicalDetails protocolVersion="v3" />);

    expect(screen.getByText('aave v3')).toBeInTheDocument();
    expect(screen.getByText('Ethereum Mainnet')).toBeInTheDocument();
    expect(screen.getByText('rpc')).toBeInTheDocument();
    expect(screen.getByText('21000000')).toBeInTheDocument();
  });

  it('shows the fetch timestamp', () => {
    useAaveLiveDataStore.setState(READY_STATE);
    render(<AaveTechnicalDetails protocolVersion="v3" />);
    expect(screen.getByText('Fetched at')).toBeInTheDocument();
  });

  it('shows the Live/Stale/Unavailable status', () => {
    useAaveLiveDataStore.setState(READY_STATE);
    render(<AaveTechnicalDetails protocolVersion="v3" />);
    expect(screen.getByText('Aave V3 · Live')).toBeInTheDocument();
  });

  it('shows a "no data yet" message before any fetch has ever succeeded', () => {
    render(<AaveTechnicalDetails protocolVersion="v3" />);
    expect(screen.getByText('No live Aave data fetched yet.')).toBeInTheDocument();
  });

  it('shows the last refresh failure message when status is error', () => {
    useAaveLiveDataStore.setState({
      ...READY_STATE,
      status: 'error',
      errorMessage: 'RPC network error: timeout',
    });
    render(<AaveTechnicalDetails protocolVersion="v3" />);
    expect(screen.getByText(/Last refresh failed: RPC network error: timeout/)).toBeInTheDocument();
  });
});

/**
 * `protocolVersion: undefined` reads as V3 — the same backward-compatibility
 * convention `utils/protocolStatus.ts`'s own `ProtocolStatusInput.protocolVersion`
 * doc comment establishes, applied here rather than re-decided.
 */
describe('AaveTechnicalDetails — protocolVersion undefined reads as V3', () => {
  it('shows the same V3 verification data as an explicit "v3"', () => {
    useAaveLiveDataStore.setState(READY_STATE);
    useDeveloperModeStore.setState({ enabled: true });
    render(<AaveTechnicalDetails protocolVersion={undefined} />);
    expect(screen.getByText('Aave V3 · Live')).toBeInTheDocument();
    expect(screen.getByText('Ethereum Mainnet')).toBeInTheDocument();
  });
});

/**
 * v1.23.0 pre-release bugfix — confirmed diagnosis: this component
 * previously always rendered `useAaveLiveDataStore`'s own V3-only
 * protocol/network/block metadata, regardless of the active portfolio's
 * real `protocolVersion`. A V4-configured portfolio could therefore show
 * "Aave V3 · Live" technical details describing nothing about its own
 * real position. These tests seed the V3 store with real "Aave V3 · Live"
 * data (exactly as if a V3 fetch had genuinely succeeded elsewhere in the
 * app) to prove that data is never presented as this V4 portfolio's own
 * Technical Details.
 */
describe('AaveTechnicalDetails — Aave V4 portfolio (v1.23.0 pre-release bugfix)', () => {
  beforeEach(() => {
    useDeveloperModeStore.setState({ enabled: true });
    useAaveLiveDataStore.setState(READY_STATE);
  });

  it('never renders V3 protocol identity or live metadata for a V4-configured portfolio', () => {
    render(<AaveTechnicalDetails protocolVersion="v4" />);

    expect(screen.queryByText('Aave V3 · Live')).not.toBeInTheDocument();
    expect(screen.queryByText('aave v3')).not.toBeInTheDocument();
    expect(screen.queryByText('Ethereum Mainnet')).not.toBeInTheDocument();
    expect(screen.queryByText('rpc')).not.toBeInTheDocument();
    expect(screen.queryByText('21000000')).not.toBeInTheDocument();
    expect(screen.queryByText('Fetched at')).not.toBeInTheDocument();
    expect(screen.queryByText('Protocol/version')).not.toBeInTheDocument();
    expect(screen.queryByText('Network')).not.toBeInTheDocument();
  });

  it('renders an explicit, honest "not applicable" state instead of fabricating V4 metadata', () => {
    render(<AaveTechnicalDetails protocolVersion="v4" />);

    expect(screen.getByText('Technical details')).toBeInTheDocument();
    expect(screen.getByText(/not applicable for aave v4/i)).toBeInTheDocument();
  });

  it('switching protocolVersion from V3 to V4 (rerender, no remount) cannot leave misleading V3 details visible', () => {
    const { rerender } = render(<AaveTechnicalDetails protocolVersion="v3" />);
    expect(screen.getByText('Aave V3 · Live')).toBeInTheDocument();
    expect(screen.getByText('Ethereum Mainnet')).toBeInTheDocument();

    // The V3 live-data store is untouched by a protocol-version switch
    // (confirmed in the diagnostic pass: `setProtocolVersion` only ever
    // mutates `protocolVersion`/`updatedAt`) — still holding the exact
    // same V3 data as before.
    rerender(<AaveTechnicalDetails protocolVersion="v4" />);

    expect(screen.queryByText('Aave V3 · Live')).not.toBeInTheDocument();
    expect(screen.queryByText('Ethereum Mainnet')).not.toBeInTheDocument();
    expect(screen.getByText(/not applicable for aave v4/i)).toBeInTheDocument();
  });
});

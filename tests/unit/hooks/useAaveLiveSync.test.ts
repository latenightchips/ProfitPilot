import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAaveLiveSync } from '@/hooks/useAaveLiveSync';
import { useAaveLiveDataStore } from '@/stores/aaveLiveDataStore';
import { usePortfolioStore } from '@/stores/portfolioStore';

/**
 * `useAaveLiveSync` — Portfolio Live-State Cleanup batch. Drives
 * `useAaveLiveDataStore.setState(...)` directly rather than mocking
 * `fetch` (the same technique the old `LiveAaveDataPanel.test.tsx` used)
 * so each test can assert on the sync effect in isolation from the
 * fetch-and-normalize pipeline already covered by
 * `tests/unit/stores/aaveLiveDataStore.test.ts`.
 */
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

beforeEach(() => {
  usePortfolioStore.setState(INITIAL_PORTFOLIO_STATE);
  useAaveLiveDataStore.setState(IDLE_AAVE_STATE);
});

function createPortfolio(overrides: Record<string, unknown> = {}) {
  const result = usePortfolioStore.getState().create({
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
  });
  if (!result.ok) throw new Error('setup failed');
  return result.data;
}

function readyState(overrides: Record<string, unknown> = {}) {
  return {
    status: 'ready' as const,
    marketQuote: {
      asset: 'BTC',
      currency: 'USD',
      freshness: 'fresh' as const,
      price: 63000,
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
        borrowApr: 0.0399,
        supplyApr: 0.005,
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

describe('useAaveLiveSync — successful sync', () => {
  it('syncs a genuinely different live price/protocol into the portfolio', async () => {
    const portfolio = createPortfolio();
    renderHook(() => useAaveLiveSync(portfolio.id));

    useAaveLiveDataStore.setState(readyState());

    await waitFor(() => {
      const updated = usePortfolioStore.getState().portfolios[portfolio.id].portfolio;
      expect(updated.market.btcPriceUsd).toBe(63000);
      expect(updated.protocol.maxLoanToValue).toBe(0.73);
      expect(updated.protocol.borrowApr).toBe(0.0399);
    });
  });

  it('fetches live Aave data on mount', () => {
    const portfolio = createPortfolio();
    renderHook(() => useAaveLiveSync(portfolio.id));
    expect(useAaveLiveDataStore.getState().fetchLiveAaveData).toHaveBeenCalled();
  });
});

describe('useAaveLiveSync — identical data causes no portfolio update', () => {
  it('does not bump updatedAt when the fetched values already match the stored portfolio', async () => {
    const portfolio = createPortfolio();
    const updatedAtBefore =
      usePortfolioStore.getState().portfolios[portfolio.id].portfolio.updatedAt;

    renderHook(() => useAaveLiveSync(portfolio.id));
    useAaveLiveDataStore.setState(
      readyState({
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
      }),
    );

    // Give any (incorrect) effect a chance to run before asserting nothing changed.
    await new Promise((resolve) => setTimeout(resolve, 10));

    const after = usePortfolioStore.getState().portfolios[portfolio.id].portfolio;
    expect(after.updatedAt).toBe(updatedAtBefore);
    expect(after.market.btcPriceUsd).toBe(50000);
  });
});

describe('useAaveLiveSync — RPC failure preserves last-known values', () => {
  it('leaves the portfolio untouched when the live store is in an error state', async () => {
    const portfolio = createPortfolio();
    renderHook(() => useAaveLiveSync(portfolio.id));

    useAaveLiveDataStore.setState({
      status: 'error',
      marketQuote: null,
      protocolQuote: null,
      collateralSymbol: null,
      borrowSymbol: null,
      source: null,
      errorMessage: 'Live Aave data is temporarily unavailable.',
      fetchLiveAaveData: vi.fn().mockResolvedValue(undefined),
    });

    await new Promise((resolve) => setTimeout(resolve, 10));

    const after = usePortfolioStore.getState().portfolios[portfolio.id].portfolio;
    expect(after.market.btcPriceUsd).toBe(50000);
    expect(after.protocol.maxLoanToValue).toBe(0.75);
  });

  it('does nothing while still idle/loading (no fetch has resolved yet)', async () => {
    const portfolio = createPortfolio();
    renderHook(() => useAaveLiveSync(portfolio.id));

    useAaveLiveDataStore.setState({ status: 'loading' });
    await new Promise((resolve) => setTimeout(resolve, 10));

    const after = usePortfolioStore.getState().portfolios[portfolio.id].portfolio;
    expect(after.market.btcPriceUsd).toBe(50000);
  });
});

describe('useAaveLiveSync — never overwrites collateral quantity, debt asset, or debt amount', () => {
  it('leaves collateral/debt untouched even when market/protocol genuinely change', async () => {
    const portfolio = createPortfolio({
      collateral: { asset: 'BTC', quantity: 2 },
      debt: { asset: 'USDC', balance: 20000 },
    });
    renderHook(() => useAaveLiveSync(portfolio.id));

    useAaveLiveDataStore.setState(readyState());

    await waitFor(() => {
      const updated = usePortfolioStore.getState().portfolios[portfolio.id].portfolio;
      expect(updated.market.btcPriceUsd).toBe(63000);
    });

    const after = usePortfolioStore.getState().portfolios[portfolio.id].portfolio;
    expect(after.collateral.quantity).toBe(2);
    expect(after.debt.asset).toBe('USDC');
    expect(after.debt.balance).toBe(20000);
  });
});

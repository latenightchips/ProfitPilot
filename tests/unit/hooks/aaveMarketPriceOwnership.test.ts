import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAaveLiveSync } from '@/hooks/useAaveLiveSync';
import { useAaveV4CollateralRiskLiveSync } from '@/hooks/useAaveV4CollateralRiskLiveSync';
import { useAaveLiveDataStore } from '@/stores/aaveLiveDataStore';
import { useAaveV4CollateralRiskLiveDataStore } from '@/stores/aaveV4CollateralRiskLiveDataStore';
import { usePortfolioStore } from '@/stores/portfolioStore';

/**
 * V4 Readiness Audit §12 P1-C — `portfolio.market.btcPriceUsd` ownership,
 * proven with BOTH live-sync hooks mounted together on the same
 * component, the way `PortfolioPageClient`/`DashboardPageClient` actually
 * mount them in production. `useAaveLiveSync.test.ts` and
 * `useAaveV4CollateralRiskLiveSync.test.ts` already prove each hook's own
 * gating in isolation; this file proves the cross-hook INVARIANT itself —
 * a successful V3 refresh can never overwrite a successfully-obtained V4
 * oracle price on a V4 portfolio, and vice versa — which no single-hook
 * test can demonstrate on its own. V3 and V4 fixture prices are
 * deliberately far apart (63000 vs 91000) so any accidental
 * cross-protocol reuse is impossible to miss.
 */
const INITIAL_PORTFOLIO_STATE = {
  portfolios: {},
  activePortfolioId: null,
  loadStatus: 'idle' as const,
  saveStatus: 'idle' as const,
  errors: [],
  lastSynchronizedAt: null,
};

const IDLE_V3_STATE = {
  status: 'idle' as const,
  marketQuote: null,
  protocolQuote: null,
  collateralSymbol: null,
  borrowSymbol: null,
  source: null,
  errorMessage: null,
  fetchLiveAaveData: vi.fn().mockResolvedValue(undefined),
};

const IDLE_V4_RISK_STATE = {
  status: 'idle' as const,
  canonical: null,
  userAddress: null,
  errorMessage: null,
  errorCode: null,
  attemptedUserAddress: null,
  lastFetchedAt: null,
  fetchAaveV4CollateralRiskLiveData: vi.fn().mockResolvedValue(undefined),
};

const V4_ADDRESS = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' as `0x${string}`;
const V3_PRICE = 63000;
const V4_PRICE = 91000;

beforeEach(() => {
  usePortfolioStore.setState(INITIAL_PORTFOLIO_STATE);
  useAaveLiveDataStore.setState(IDLE_V3_STATE);
  useAaveV4CollateralRiskLiveDataStore.setState(IDLE_V4_RISK_STATE);
});

function createPortfolio(overrides: Record<string, unknown> = {}) {
  const result = usePortfolioStore.getState().create({
    name: 'My Portfolio',
    baseCurrency: 'USD',
    collateral: { asset: 'BTC', quantity: 2 },
    debt: { asset: 'USDC', balance: 20000 },
    market: { btcPriceUsd: 50000 },
    protocol: { maxLoanToValue: 0.75, liquidationThreshold: 0.8, borrowApr: 0.05, supplyApr: 0.02 },
    settings: {},
    ...overrides,
  });
  if (!result.ok) throw new Error('setup failed');
  return result.data;
}

function createV4Portfolio(address: `0x${string}` = V4_ADDRESS) {
  const portfolio = createPortfolio();
  usePortfolioStore.getState().setProtocolVersion(portfolio.id, 'v4');
  const result = usePortfolioStore
    .getState()
    .setAaveV4Position(portfolio.id, { userAddress: address });
  if (!result.ok) throw new Error('setup failed');
  return result.data;
}

function v3ReadyState(overrides: Record<string, unknown> = {}) {
  return {
    status: 'ready' as const,
    marketQuote: {
      asset: 'BTC',
      currency: 'USD',
      freshness: 'fresh' as const,
      price: V3_PRICE,
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

function v4ReadyState(overrides: Record<string, unknown> = {}) {
  return {
    status: 'ready' as const,
    canonical: { collateralFactor: 0.8, dynamicConfigKey: 1, collateralPriceUsd: V4_PRICE },
    userAddress: V4_ADDRESS,
    errorMessage: null,
    errorCode: null,
    lastFetchedAt: new Date().toISOString(),
    fetchAaveV4CollateralRiskLiveData: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function mountBothHooks(portfolioId: string) {
  return renderHook(() => {
    useAaveLiveSync(portfolioId);
    useAaveV4CollateralRiskLiveSync(portfolioId);
  });
}

describe('market.btcPriceUsd ownership — required invariant: V3 refresh never overwrites an obtained V4 oracle price', () => {
  it('a V4 oracle price obtained first survives a LATER V3 refresh on the same V4 portfolio', async () => {
    const portfolio = createV4Portfolio();
    mountBothHooks(portfolio.id);

    // V4 succeeds first.
    useAaveV4CollateralRiskLiveDataStore.setState(v4ReadyState());
    await waitFor(() => {
      expect(
        usePortfolioStore.getState().portfolios[portfolio.id].portfolio.market.btcPriceUsd,
      ).toBe(V4_PRICE);
    });

    // A V3 refresh lands AFTER — must not overwrite the V4 price.
    useAaveLiveDataStore.setState(v3ReadyState());
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(usePortfolioStore.getState().portfolios[portfolio.id].portfolio.market.btcPriceUsd).toBe(
      V4_PRICE,
    );
  });

  it('a V3 refresh landing FIRST still never applies to a V4 portfolio, and the V4 oracle price wins once it lands', async () => {
    const portfolio = createV4Portfolio();
    mountBothHooks(portfolio.id);

    // V3 resolves first — must be rejected for this V4 portfolio.
    useAaveLiveDataStore.setState(v3ReadyState());
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(usePortfolioStore.getState().portfolios[portfolio.id].portfolio.market.btcPriceUsd).toBe(
      50000, // unchanged from creation — never V3_PRICE
    );

    // V4 then resolves — its price is the one that lands.
    useAaveV4CollateralRiskLiveDataStore.setState(v4ReadyState());
    await waitFor(() => {
      expect(
        usePortfolioStore.getState().portfolios[portfolio.id].portfolio.market.btcPriceUsd,
      ).toBe(V4_PRICE);
    });
  });

  it('repeated V3 refreshes after the V4 price landed keep failing to overwrite it', async () => {
    const portfolio = createV4Portfolio();
    mountBothHooks(portfolio.id);

    useAaveV4CollateralRiskLiveDataStore.setState(v4ReadyState());
    await waitFor(() => {
      expect(
        usePortfolioStore.getState().portfolios[portfolio.id].portfolio.market.btcPriceUsd,
      ).toBe(V4_PRICE);
    });

    for (const price of [64000, 65000, 66000]) {
      useAaveLiveDataStore.setState(
        v3ReadyState({
          marketQuote: {
            asset: 'BTC',
            currency: 'USD',
            freshness: 'fresh' as const,
            price,
            origin: 'provider' as const,
            timestamp: new Date().toISOString(),
          },
        }),
      );
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(
        usePortfolioStore.getState().portfolios[portfolio.id].portfolio.market.btcPriceUsd,
      ).toBe(V4_PRICE);
    }
  });

  it('a V3-only portfolio (mounted alongside the same hooks) is completely unaffected — only the V3 price ever lands', async () => {
    const portfolio = createPortfolio(); // no protocolVersion set — V3
    mountBothHooks(portfolio.id);

    useAaveLiveDataStore.setState(v3ReadyState());
    await waitFor(() => {
      expect(
        usePortfolioStore.getState().portfolios[portfolio.id].portfolio.market.btcPriceUsd,
      ).toBe(V3_PRICE);
    });

    // The V4 store happening to hold ready data must never leak into this
    // V3 portfolio (it has no v4Position to fetch against in the first
    // place, but confirm no accidental write occurs).
    useAaveV4CollateralRiskLiveDataStore.setState(v4ReadyState());
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(usePortfolioStore.getState().portfolios[portfolio.id].portfolio.market.btcPriceUsd).toBe(
      V3_PRICE,
    );
  });

  it('switching between a V3 and a V4 portfolio never leaks one price into the other', async () => {
    const v3Portfolio = createPortfolio();
    const v4Portfolio = createV4Portfolio();

    mountBothHooks(v3Portfolio.id);
    useAaveLiveDataStore.setState(v3ReadyState());
    await waitFor(() => {
      expect(
        usePortfolioStore.getState().portfolios[v3Portfolio.id].portfolio.market.btcPriceUsd,
      ).toBe(V3_PRICE);
    });

    mountBothHooks(v4Portfolio.id);
    useAaveV4CollateralRiskLiveDataStore.setState(v4ReadyState());
    await waitFor(() => {
      expect(
        usePortfolioStore.getState().portfolios[v4Portfolio.id].portfolio.market.btcPriceUsd,
      ).toBe(V4_PRICE);
    });

    // Neither portfolio's price was contaminated by the other's protocol.
    expect(
      usePortfolioStore.getState().portfolios[v3Portfolio.id].portfolio.market.btcPriceUsd,
    ).toBe(V3_PRICE);
    expect(
      usePortfolioStore.getState().portfolios[v4Portfolio.id].portfolio.market.btcPriceUsd,
    ).toBe(V4_PRICE);
  });
});

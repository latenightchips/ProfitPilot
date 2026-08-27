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
  it('a genuinely different live price/protocol becomes a pending candidate, and syncs once accepted (V1.1 Batch 1 trust parity)', async () => {
    const portfolio = createPortfolio();
    renderHook(() => useAaveLiveSync(portfolio.id));

    useAaveLiveDataStore.setState(readyState());

    // A fresh portfolio's market/protocol is manual-sourced; a genuinely
    // different live fetch must not silently overwrite it — it becomes a
    // pending candidate instead.
    await waitFor(() => {
      const state = usePortfolioStore.getState();
      expect(state.marketCandidates[portfolio.id]).toEqual({ btcPriceUsd: 63000 });
      expect(state.protocolCandidates[portfolio.id]?.maxLoanToValue).toBe(0.73);
    });
    const unchanged = usePortfolioStore.getState().portfolios[portfolio.id].portfolio;
    expect(unchanged.market.btcPriceUsd).toBe(50000);
    expect(unchanged.protocol.maxLoanToValue).toBe(0.75);

    // "Use Live Data" — the candidate becomes canonical.
    usePortfolioStore.getState().acceptMarketCandidate(portfolio.id);
    usePortfolioStore.getState().acceptProtocolCandidate(portfolio.id);

    const updated = usePortfolioStore.getState().portfolios[portfolio.id].portfolio;
    expect(updated.market.btcPriceUsd).toBe(63000);
    expect(updated.protocol.maxLoanToValue).toBe(0.73);
    expect(updated.protocol.borrowApr).toBe(0.0399);
    expect(updated.marketSource).toBe('live');
    expect(updated.protocolSource).toBe('live');
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

    // The differing fetch becomes a candidate first (V1.1 Batch 1 trust
    // parity) — accept it to reach the synced state this test cares about.
    await waitFor(() => {
      expect(usePortfolioStore.getState().marketCandidates[portfolio.id]).toBeDefined();
    });
    usePortfolioStore.getState().acceptMarketCandidate(portfolio.id);
    usePortfolioStore.getState().acceptProtocolCandidate(portfolio.id);

    const updated = usePortfolioStore.getState().portfolios[portfolio.id].portfolio;
    expect(updated.market.btcPriceUsd).toBe(63000);

    const after = usePortfolioStore.getState().portfolios[portfolio.id].portfolio;
    expect(after.collateral.quantity).toBe(2);
    expect(after.debt.asset).toBe('USDC');
    expect(after.debt.balance).toBe(20000);
  });
});

describe("useAaveLiveSync — fetches for the portfolio's own debt asset (USDT Support milestone)", () => {
  it('fetches USDC for a USDC-debt portfolio', () => {
    const portfolio = createPortfolio({ debt: { asset: 'USDC', balance: 20000 } });
    renderHook(() => useAaveLiveSync(portfolio.id));
    expect(useAaveLiveDataStore.getState().fetchLiveAaveData).toHaveBeenCalledWith('USDC');
  });

  it('fetches USDT for a USDT-debt portfolio', () => {
    const portfolio = createPortfolio({ debt: { asset: 'USDT', balance: 20000 } });
    renderHook(() => useAaveLiveSync(portfolio.id));
    expect(useAaveLiveDataStore.getState().fetchLiveAaveData).toHaveBeenCalledWith('USDT');
  });

  it('switching the active portfolio from a USDC-debt one to a USDT-debt one triggers a new fetch for USDT', () => {
    const usdcPortfolio = createPortfolio({ debt: { asset: 'USDC', balance: 20000 } });
    const usdtResult = usePortfolioStore.getState().create({
      name: 'USDT Portfolio',
      baseCurrency: 'USD',
      collateral: { asset: 'BTC', quantity: 1 },
      debt: { asset: 'USDT', balance: 10000 },
      market: { btcPriceUsd: 50000 },
      protocol: {
        maxLoanToValue: 0.75,
        liquidationThreshold: 0.8,
        borrowApr: 0.05,
        supplyApr: 0.02,
      },
      settings: {},
    });
    if (!usdtResult.ok) throw new Error('setup failed');

    const { rerender } = renderHook(({ id }) => useAaveLiveSync(id), {
      initialProps: { id: usdcPortfolio.id },
    });
    expect(useAaveLiveDataStore.getState().fetchLiveAaveData).toHaveBeenCalledWith('USDC');

    rerender({ id: usdtResult.data.id });
    expect(useAaveLiveDataStore.getState().fetchLiveAaveData).toHaveBeenCalledWith('USDT');
  });
});

describe('useAaveLiveSync — mismatch guard: a live quote for a different asset is never applied (USDT Support milestone)', () => {
  it('does not sync a USDT live quote into a USDC-debt portfolio', async () => {
    const portfolio = createPortfolio({ debt: { asset: 'USDC', balance: 20000 } });
    const updatedAtBefore =
      usePortfolioStore.getState().portfolios[portfolio.id].portfolio.updatedAt;
    renderHook(() => useAaveLiveSync(portfolio.id));

    useAaveLiveDataStore.setState(
      readyState({
        protocolQuote: {
          available: true as const,
          collateralAsset: 'WBTC',
          borrowAsset: 'USDT',
          parameters: {
            maxLoanToValue: 0.73,
            liquidationThreshold: 0.78,
            borrowApr: 0.09,
            supplyApr: 0.005,
          },
          origin: 'live' as const,
          timestamp: new Date().toISOString(),
        },
      }),
    );

    await new Promise((resolve) => setTimeout(resolve, 10));

    const after = usePortfolioStore.getState().portfolios[portfolio.id].portfolio;
    expect(after.updatedAt).toBe(updatedAtBefore);
    expect(after.protocol.borrowApr).toBe(0.05);
  });

  it('does not sync a USDC live quote into a USDT-debt portfolio', async () => {
    const portfolio = createPortfolio({ debt: { asset: 'USDT', balance: 20000 } });
    const updatedAtBefore =
      usePortfolioStore.getState().portfolios[portfolio.id].portfolio.updatedAt;
    renderHook(() => useAaveLiveSync(portfolio.id));

    useAaveLiveDataStore.setState(readyState());

    await new Promise((resolve) => setTimeout(resolve, 10));

    const after = usePortfolioStore.getState().portfolios[portfolio.id].portfolio;
    expect(after.updatedAt).toBe(updatedAtBefore);
    expect(after.protocol.borrowApr).toBe(0.05);
  });

  it('syncs correctly once the live store catches up to a matching asset', async () => {
    const portfolio = createPortfolio({ debt: { asset: 'USDT', balance: 20000 } });
    renderHook(() => useAaveLiveSync(portfolio.id));

    // First, a mismatched USDC quote lands — must be ignored.
    useAaveLiveDataStore.setState(readyState());
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(usePortfolioStore.getState().portfolios[portfolio.id].portfolio.protocol.borrowApr).toBe(
      0.05,
    );

    // Then a USDT-asset quote lands (the portfolio's own debt asset) —
    // no longer mismatch-guarded, so it's free to reach the conflict
    // logic below.
    useAaveLiveDataStore.setState(
      readyState({
        protocolQuote: {
          available: true as const,
          collateralAsset: 'WBTC',
          borrowAsset: 'USDT',
          parameters: {
            maxLoanToValue: 0.73,
            liquidationThreshold: 0.78,
            borrowApr: 0.09,
            supplyApr: 0.005,
          },
          origin: 'live' as const,
          timestamp: new Date().toISOString(),
        },
      }),
    );

    // Genuinely differs from the manual value — becomes a candidate first
    // (V1.1 Batch 1 trust parity), not a direct write.
    await waitFor(() => {
      expect(usePortfolioStore.getState().protocolCandidates[portfolio.id]?.borrowApr).toBe(0.09);
    });
    usePortfolioStore.getState().acceptProtocolCandidate(portfolio.id);

    const updated = usePortfolioStore.getState().portfolios[portfolio.id].portfolio;
    expect(updated.protocol.borrowApr).toBe(0.09);
  });
});

/**
 * V4 Readiness Audit §12 Stage 23A / P1-C — `protocol` (V3-pool risk
 * parameters) must never be written into a portfolio whose
 * `protocolVersion === 'v4'`. As of P1-C, `market` (BTC price) is no
 * longer protocol-agnostic either — it stops syncing from this V3 hook
 * for a V4 portfolio too, since `hooks/useAaveV4CollateralRiskLiveSync.ts`
 * is now that portfolio's sole `market` writer (see that hook's own
 * header comment). `protocolQuote.parameters`/`marketQuote.price` below
 * are deliberately different from the portfolio's own stored values in
 * every fixture, so any accidental write is directly observable, the
 * same fixture discipline every prior V4 rate/status stage already
 * established.
 */
describe('useAaveLiveSync — V4 protocol-parameter isolation (Stage 23A)', () => {
  it('still reaches protocol parameters for an explicit V3 portfolio — gate unaffected by V1.1 Batch 1 trust parity', async () => {
    const portfolio = createPortfolio();
    usePortfolioStore.getState().setProtocolVersion(portfolio.id, 'v3');
    renderHook(() => useAaveLiveSync(portfolio.id));

    useAaveLiveDataStore.setState(readyState());

    // Differing manual values become candidates (V1.1 Batch 1), then sync
    // once accepted — the V3 gate itself (this test's actual subject) is
    // unaffected either way.
    await waitFor(() => {
      expect(usePortfolioStore.getState().marketCandidates[portfolio.id]).toBeDefined();
    });
    usePortfolioStore.getState().acceptMarketCandidate(portfolio.id);
    usePortfolioStore.getState().acceptProtocolCandidate(portfolio.id);

    const updated = usePortfolioStore.getState().portfolios[portfolio.id].portfolio;
    expect(updated.market.btcPriceUsd).toBe(63000);
    expect(updated.protocol.maxLoanToValue).toBe(0.73);
    expect(updated.protocol.borrowApr).toBe(0.0399);
  });

  it('V4 Readiness Audit §12 P1-C — no longer syncs market/price data for a V4 portfolio (V3 price ownership excludes V4)', async () => {
    const portfolio = createPortfolio();
    usePortfolioStore.getState().setProtocolVersion(portfolio.id, 'v4');
    renderHook(() => useAaveLiveSync(portfolio.id));

    useAaveLiveDataStore.setState(readyState());

    // Give the effect a chance to run before asserting nothing changed.
    await new Promise((resolve) => setTimeout(resolve, 10));

    const after = usePortfolioStore.getState().portfolios[portfolio.id].portfolio;
    expect(after.market.btcPriceUsd).toBe(50000); // unchanged from creation, never 63000
  });

  it('never overwrites a V4 portfolio’s legacy protocol risk fields with the V3 live source', async () => {
    const portfolio = createPortfolio();
    usePortfolioStore.getState().setProtocolVersion(portfolio.id, 'v4');
    renderHook(() => useAaveLiveSync(portfolio.id));

    useAaveLiveDataStore.setState(readyState());
    await new Promise((resolve) => setTimeout(resolve, 10));

    const after = usePortfolioStore.getState().portfolios[portfolio.id].portfolio;
    expect(after.protocol.maxLoanToValue).toBe(0.75);
    expect(after.protocol.liquidationThreshold).toBe(0.8);
    expect(after.protocol.borrowApr).toBe(0.05);
    expect(after.protocol.supplyApr).toBe(0.02);
  });

  it('P1-C — commits NO update at all for a V4 portfolio when the only changes are the now-withheld market/protocol fields (no updatedAt bump)', async () => {
    const portfolio = createPortfolio();
    usePortfolioStore.getState().setProtocolVersion(portfolio.id, 'v4');
    const updatedAtBefore =
      usePortfolioStore.getState().portfolios[portfolio.id].portfolio.updatedAt;
    renderHook(() => useAaveLiveSync(portfolio.id));

    useAaveLiveDataStore.setState(readyState());

    // Give any (incorrect) effect a chance to run before asserting nothing changed.
    await new Promise((resolve) => setTimeout(resolve, 10));

    const after = usePortfolioStore.getState().portfolios[portfolio.id].portfolio;
    expect(after.updatedAt).toBe(updatedAtBefore);
  });

  it('does not bump updatedAt for a V4 portfolio when only protocol parameters "changed" (market already matches)', async () => {
    const portfolio = createPortfolio({ market: { btcPriceUsd: 63000 } });
    usePortfolioStore.getState().setProtocolVersion(portfolio.id, 'v4');
    const updatedAtBefore =
      usePortfolioStore.getState().portfolios[portfolio.id].portfolio.updatedAt;
    renderHook(() => useAaveLiveSync(portfolio.id));

    useAaveLiveDataStore.setState(readyState());

    // Give any (incorrect) effect a chance to run before asserting nothing changed.
    await new Promise((resolve) => setTimeout(resolve, 10));

    const after = usePortfolioStore.getState().portfolios[portfolio.id].portfolio;
    expect(after.updatedAt).toBe(updatedAtBefore);
    expect(after.protocol.maxLoanToValue).toBe(0.75);
  });

  it('switching a portfolio from V3 to V4 mid-session stops a later live-sync cycle from writing market OR protocol — proves the gate reads the current portfolio, not a stale closure', async () => {
    const portfolio = createPortfolio();
    usePortfolioStore.getState().setProtocolVersion(portfolio.id, 'v3');
    renderHook(() => useAaveLiveSync(portfolio.id));

    // First cycle, still V3 — the differing manual values become
    // candidates (V1.1 Batch 1 trust parity); accept both to reach the
    // synced, `'live'`-sourced state this test's second half depends on.
    useAaveLiveDataStore.setState(readyState());
    await waitFor(() => {
      expect(usePortfolioStore.getState().marketCandidates[portfolio.id]).toBeDefined();
      expect(usePortfolioStore.getState().protocolCandidates[portfolio.id]).toBeDefined();
    });
    usePortfolioStore.getState().acceptMarketCandidate(portfolio.id);
    usePortfolioStore.getState().acceptProtocolCandidate(portfolio.id);
    const afterFirstCycle = usePortfolioStore.getState().portfolios[portfolio.id].portfolio;
    expect(afterFirstCycle.protocol.maxLoanToValue).toBe(0.73);
    expect(afterFirstCycle.market.btcPriceUsd).toBe(63000);

    // Switch to V4 — no live-sync fetch involved, a pure Store action.
    usePortfolioStore.getState().setProtocolVersion(portfolio.id, 'v4');
    const protocolAfterSwitch =
      usePortfolioStore.getState().portfolios[portfolio.id].portfolio.protocol;
    const marketAfterSwitch =
      usePortfolioStore.getState().portfolios[portfolio.id].portfolio.market;

    // Second cycle, a genuinely new, different live quote lands after the switch.
    useAaveLiveDataStore.setState(
      readyState({
        marketQuote: {
          asset: 'BTC',
          currency: 'USD',
          freshness: 'fresh' as const,
          price: 70000,
          origin: 'provider' as const,
          timestamp: new Date().toISOString(),
        },
        protocolQuote: {
          available: true as const,
          collateralAsset: 'WBTC',
          borrowAsset: 'USDC',
          parameters: {
            maxLoanToValue: 0.6,
            liquidationThreshold: 0.65,
            borrowApr: 0.15,
            supplyApr: 0.01,
          },
          origin: 'live' as const,
          timestamp: new Date().toISOString(),
        },
      }),
    );

    // Give the (now-gated) second cycle a chance to run before asserting.
    await new Promise((resolve) => setTimeout(resolve, 10));

    const after = usePortfolioStore.getState().portfolios[portfolio.id].portfolio;
    expect(after.protocol).toEqual(protocolAfterSwitch);
    expect(after.protocol.maxLoanToValue).not.toBe(0.6);
    expect(after.market).toEqual(marketAfterSwitch);
    expect(after.market.btcPriceUsd).not.toBe(70000);
  });
});

/**
 * V1.1 Batch 1 — Live-Data Trust Parity. Full coverage of the
 * manual/live conflict rule this file's own header comment documents:
 * no pointless conflict on a coincidental match, no silent overwrite on
 * a genuine difference, both confirmation actions, the post-adoption
 * live→live refresh model, portfolio-scoped isolation, and V3/V4
 * candidate-map isolation. Complements (does not replace) the
 * `AaveV3ConflictConfirmation` component's own dedicated test file.
 */
describe('useAaveLiveSync — V1.1 Batch 1 manual/live conflict rule', () => {
  it('a matching manual value creates no candidate at all — not a pointless conflict', async () => {
    const portfolio = createPortfolio(); // market/protocol match readyState()'s defaults below
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

    await new Promise((resolve) => setTimeout(resolve, 10));

    const state = usePortfolioStore.getState();
    expect(state.marketCandidates[portfolio.id]).toBeUndefined();
    expect(state.protocolCandidates[portfolio.id]).toBeUndefined();
    expect(state.portfolios[portfolio.id].portfolio.marketSource).toBe('manual');
    expect(state.portfolios[portfolio.id].portfolio.protocolSource).toBe('manual');
  });

  it('"Keep Manual" discards the candidate, preserves manual state, and does not disable future live sync', async () => {
    const portfolio = createPortfolio();
    renderHook(() => useAaveLiveSync(portfolio.id));

    useAaveLiveDataStore.setState(readyState());
    await waitFor(() => {
      expect(usePortfolioStore.getState().marketCandidates[portfolio.id]).toBeDefined();
    });

    usePortfolioStore.getState().dismissMarketCandidate(portfolio.id);
    usePortfolioStore.getState().dismissProtocolCandidate(portfolio.id);

    const afterDismiss = usePortfolioStore.getState();
    expect(afterDismiss.marketCandidates[portfolio.id]).toBeUndefined();
    expect(afterDismiss.protocolCandidates[portfolio.id]).toBeUndefined();
    expect(afterDismiss.portfolios[portfolio.id].portfolio.market.btcPriceUsd).toBe(50000);
    expect(afterDismiss.portfolios[portfolio.id].portfolio.marketSource).toBe('manual');

    // A genuinely NEW, further-different fetch must still be able to
    // surface a new candidate — dismissal is not a permanent opt-out.
    useAaveLiveDataStore.setState(
      readyState({
        marketQuote: {
          asset: 'BTC',
          currency: 'USD',
          freshness: 'fresh' as const,
          price: 71000,
          origin: 'provider' as const,
          timestamp: new Date().toISOString(),
        },
      }),
    );
    await waitFor(() => {
      expect(usePortfolioStore.getState().marketCandidates[portfolio.id]?.btcPriceUsd).toBe(71000);
    });
  });

  it('after "Use Live Data", a further genuinely different fetch auto-applies directly — no repeat conflict', async () => {
    const portfolio = createPortfolio();
    renderHook(() => useAaveLiveSync(portfolio.id));

    useAaveLiveDataStore.setState(readyState());
    await waitFor(() => {
      expect(usePortfolioStore.getState().marketCandidates[portfolio.id]).toBeDefined();
    });
    usePortfolioStore.getState().acceptMarketCandidate(portfolio.id);
    expect(usePortfolioStore.getState().portfolios[portfolio.id].portfolio.marketSource).toBe(
      'live',
    );

    // A further, genuinely different live quote lands — must apply
    // directly (ordinary live→live refresh), never a new candidate.
    useAaveLiveDataStore.setState(
      readyState({
        marketQuote: {
          asset: 'BTC',
          currency: 'USD',
          freshness: 'fresh' as const,
          price: 71000,
          origin: 'provider' as const,
          timestamp: new Date().toISOString(),
        },
      }),
    );

    await waitFor(() => {
      expect(
        usePortfolioStore.getState().portfolios[portfolio.id].portfolio.market.btcPriceUsd,
      ).toBe(71000);
    });
    expect(usePortfolioStore.getState().marketCandidates[portfolio.id]).toBeUndefined();
  });

  it('portfolio switching does not leak a pending candidate between portfolios', async () => {
    const portfolioA = createPortfolio({ name: 'A' });
    const portfolioB = createPortfolio({ name: 'B', market: { btcPriceUsd: 63000 } }); // already matches the live fetch below

    const { rerender } = renderHook(({ id }) => useAaveLiveSync(id), {
      initialProps: { id: portfolioA.id },
    });
    useAaveLiveDataStore.setState(readyState());
    await waitFor(() => {
      expect(usePortfolioStore.getState().marketCandidates[portfolioA.id]).toBeDefined();
    });

    // Switch the active hook to portfolio B — A's own pending candidate
    // must remain exactly where it was, scoped to A alone.
    rerender({ id: portfolioB.id });
    await new Promise((resolve) => setTimeout(resolve, 10));

    const state = usePortfolioStore.getState();
    expect(state.marketCandidates[portfolioA.id]).toBeDefined();
    expect(state.marketCandidates[portfolioB.id]).toBeUndefined();
    // B's protocol still differs from the fetch — B gets its own,
    // independent candidate; A's is untouched by B's evaluation.
    expect(state.protocolCandidates[portfolioB.id]).toBeDefined();
    expect(state.marketCandidates[portfolioA.id]).toEqual({ btcPriceUsd: 63000 });
  });

  it('a V3 market/protocol conflict never touches the V4 candidate maps, and vice versa', async () => {
    const portfolio = createPortfolio();
    renderHook(() => useAaveLiveSync(portfolio.id));

    useAaveLiveDataStore.setState(readyState());
    await waitFor(() => {
      expect(usePortfolioStore.getState().marketCandidates[portfolio.id]).toBeDefined();
      expect(usePortfolioStore.getState().protocolCandidates[portfolio.id]).toBeDefined();
    });

    const state = usePortfolioStore.getState();
    expect(state.v4DebtStateCandidates[portfolio.id]).toBeUndefined();
    expect(state.v4CollateralRiskCandidates[portfolio.id]).toBeUndefined();

    // The reverse direction: a V4 candidate, set directly at the Store
    // level (the same seam `useAaveV4LiveSync.ts` itself writes through),
    // must never appear in the V3 maps.
    usePortfolioStore.getState().setAaveV4DebtStateCandidate(portfolio.id, {
      drawnDebt: 1000,
      premiumDebt: 10,
      baseDrawnApr: 0.04,
      riskPremium: 0.01,
      debtAssetPriceUsd: 1,
    });
    const afterV4 = usePortfolioStore.getState();
    expect(afterV4.marketCandidates[portfolio.id]).toEqual(state.marketCandidates[portfolio.id]);
    expect(afterV4.protocolCandidates[portfolio.id]).toEqual(
      state.protocolCandidates[portfolio.id],
    );
  });
});

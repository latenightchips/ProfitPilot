import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAaveV4CollateralRiskLiveSync } from '@/hooks/useAaveV4CollateralRiskLiveSync';
import { useAaveV4CollateralRiskLiveDataStore } from '@/stores/aaveV4CollateralRiskLiveDataStore';
import { usePortfolioStore } from '@/stores/portfolioStore';

/**
 * `useAaveV4CollateralRiskLiveSync` — V4 Readiness Audit §12 Stage 23F.
 * Mirrors `tests/unit/hooks/useAaveV4LiveSync.test.ts`'s own technique:
 * drives `useAaveV4CollateralRiskLiveDataStore.setState(...)` directly
 * rather than mocking `fetch` (the fetch-and-normalize pipeline is
 * already covered by `tests/unit/stores/aaveV4CollateralRiskLiveDataStore.test.ts`),
 * so this suite proves the sync effect's own gating/identity/equality
 * logic in isolation — plus the one structural addition this stage's own
 * requirements call for: actively clearing a stale `v4CollateralRisk`
 * when the V4 identity is removed (see the hook's own header comment for
 * why this differs from `useAaveV4LiveSync`).
 */
const INITIAL_PORTFOLIO_STATE = {
  portfolios: {},
  activePortfolioId: null,
  loadStatus: 'idle' as const,
  saveStatus: 'idle' as const,
  errors: [],
  lastSynchronizedAt: null,
};

const IDLE_STATE = {
  status: 'idle' as const,
  canonical: null,
  userAddress: null,
  errorMessage: null,
  lastFetchedAt: null,
  fetchAaveV4CollateralRiskLiveData: vi.fn().mockResolvedValue(undefined),
};

const VALID_ADDRESS = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' as `0x${string}`;
const OTHER_ADDRESS = '0x1111111111111111111111111111111111111111' as `0x${string}`;

beforeEach(() => {
  usePortfolioStore.setState(INITIAL_PORTFOLIO_STATE);
  useAaveV4CollateralRiskLiveDataStore.setState(IDLE_STATE);
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

function createV4Portfolio(address: `0x${string}` = VALID_ADDRESS) {
  const portfolio = createPortfolio();
  usePortfolioStore.getState().setProtocolVersion(portfolio.id, 'v4');
  const result = usePortfolioStore
    .getState()
    .setAaveV4Position(portfolio.id, { userAddress: address });
  if (!result.ok) throw new Error('setup failed');
  return result.data;
}

const VALID_CANONICAL = { collateralFactor: 0.8, dynamicConfigKey: 1 };

function readyState(overrides: Record<string, unknown> = {}) {
  return {
    status: 'ready' as const,
    canonical: VALID_CANONICAL,
    userAddress: VALID_ADDRESS,
    errorMessage: null,
    lastFetchedAt: new Date().toISOString(),
    fetchAaveV4CollateralRiskLiveData: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('useAaveV4CollateralRiskLiveSync — V3 isolation (strict no-op for every portfolio without both protocolVersion:"v4" and v4Position)', () => {
  it('never fetches for an ordinary V3 portfolio (neither field set)', () => {
    const portfolio = createPortfolio();
    renderHook(() => useAaveV4CollateralRiskLiveSync(portfolio.id));
    expect(
      useAaveV4CollateralRiskLiveDataStore.getState().fetchAaveV4CollateralRiskLiveData,
    ).not.toHaveBeenCalled();
  });

  it('never fetches when only v4Position is set (protocolVersion still v3/unset)', () => {
    const portfolio = createPortfolio();
    usePortfolioStore.getState().setAaveV4Position(portfolio.id, { userAddress: VALID_ADDRESS });
    renderHook(() => useAaveV4CollateralRiskLiveSync(portfolio.id));
    expect(
      useAaveV4CollateralRiskLiveDataStore.getState().fetchAaveV4CollateralRiskLiveData,
    ).not.toHaveBeenCalled();
  });

  it('never fetches when only protocolVersion is "v4" (no v4Position set)', () => {
    const portfolio = createPortfolio();
    usePortfolioStore.getState().setProtocolVersion(portfolio.id, 'v4');
    renderHook(() => useAaveV4CollateralRiskLiveSync(portfolio.id));
    expect(
      useAaveV4CollateralRiskLiveDataStore.getState().fetchAaveV4CollateralRiskLiveData,
    ).not.toHaveBeenCalled();
  });

  it('never writes v4CollateralRisk onto a V3 portfolio even if the store happens to hold ready data', async () => {
    const portfolio = createPortfolio();
    renderHook(() => useAaveV4CollateralRiskLiveSync(portfolio.id));

    useAaveV4CollateralRiskLiveDataStore.setState(readyState());
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(
      usePortfolioStore.getState().portfolios[portfolio.id].portfolio.v4CollateralRisk,
    ).toBeUndefined();
  });

  it('does nothing when portfolioId is null', () => {
    renderHook(() => useAaveV4CollateralRiskLiveSync(null));
    expect(
      useAaveV4CollateralRiskLiveDataStore.getState().fetchAaveV4CollateralRiskLiveData,
    ).not.toHaveBeenCalled();
  });
});

describe('useAaveV4CollateralRiskLiveSync — successful sync for an opted-in V4 portfolio', () => {
  it("fetches using the portfolio's own v4Position.userAddress, not a debt asset (there is none for this fetch)", () => {
    const portfolio = createV4Portfolio();
    renderHook(() => useAaveV4CollateralRiskLiveSync(portfolio.id));
    expect(
      useAaveV4CollateralRiskLiveDataStore.getState().fetchAaveV4CollateralRiskLiveData,
    ).toHaveBeenCalledWith(VALID_ADDRESS);
  });

  it('syncs a genuinely different canonical value into v4CollateralRisk, including the exact user-bound dynamicConfigKey', async () => {
    const portfolio = createV4Portfolio();
    renderHook(() => useAaveV4CollateralRiskLiveSync(portfolio.id));

    useAaveV4CollateralRiskLiveDataStore.setState(readyState());

    await waitFor(() => {
      const updated = usePortfolioStore.getState().portfolios[portfolio.id].portfolio;
      expect(updated.v4CollateralRisk).toEqual(VALID_CANONICAL);
    });
  });
});

describe('useAaveV4CollateralRiskLiveSync — identical data causes no portfolio update (equality gate)', () => {
  it('does not bump updatedAt when the fetched canonical value already matches the stored v4CollateralRisk', async () => {
    const portfolio = createV4Portfolio();
    const withRisk = usePortfolioStore
      .getState()
      .setAaveV4CollateralRisk(portfolio.id, VALID_CANONICAL);
    if (!withRisk.ok) throw new Error('setup failed');
    const updatedAtBefore = withRisk.data.updatedAt;

    renderHook(() => useAaveV4CollateralRiskLiveSync(portfolio.id));
    useAaveV4CollateralRiskLiveDataStore.setState(readyState());

    await new Promise((resolve) => setTimeout(resolve, 10));

    const after = usePortfolioStore.getState().portfolios[portfolio.id].portfolio;
    expect(after.updatedAt).toBe(updatedAtBefore);
  });

  it('a changed dynamicConfigKey with a coincidentally-equal collateralFactor still counts as a real change', async () => {
    const portfolio = createV4Portfolio();
    usePortfolioStore
      .getState()
      .setAaveV4CollateralRisk(portfolio.id, { collateralFactor: 0.8, dynamicConfigKey: 1 });

    renderHook(() => useAaveV4CollateralRiskLiveSync(portfolio.id));
    useAaveV4CollateralRiskLiveDataStore.setState(
      readyState({ canonical: { collateralFactor: 0.8, dynamicConfigKey: 2 } }),
    );

    await waitFor(() => {
      expect(
        usePortfolioStore.getState().portfolios[portfolio.id].portfolio.v4CollateralRisk,
      ).toEqual({ collateralFactor: 0.8, dynamicConfigKey: 2 });
    });
  });
});

describe('useAaveV4CollateralRiskLiveSync — RPC failure preserves last-known v4CollateralRisk (fail closed, never fabricated)', () => {
  it('leaves v4CollateralRisk untouched when the store is in an error state', async () => {
    const portfolio = createV4Portfolio();
    usePortfolioStore.getState().setAaveV4CollateralRisk(portfolio.id, VALID_CANONICAL);
    renderHook(() => useAaveV4CollateralRiskLiveSync(portfolio.id));

    useAaveV4CollateralRiskLiveDataStore.setState({
      status: 'error',
      canonical: null,
      userAddress: null,
      errorMessage: 'Live Aave V4 collateral-risk data is temporarily unavailable.',
      lastFetchedAt: null,
      fetchAaveV4CollateralRiskLiveData: vi.fn().mockResolvedValue(undefined),
    });

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(
      usePortfolioStore.getState().portfolios[portfolio.id].portfolio.v4CollateralRisk,
    ).toEqual(VALID_CANONICAL);
  });

  it('does nothing while still idle/loading (no fetch has resolved yet)', async () => {
    const portfolio = createV4Portfolio();
    renderHook(() => useAaveV4CollateralRiskLiveSync(portfolio.id));

    useAaveV4CollateralRiskLiveDataStore.setState({ status: 'loading' });
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(
      usePortfolioStore.getState().portfolios[portfolio.id].portfolio.v4CollateralRisk,
    ).toBeUndefined();
  });
});

describe('useAaveV4CollateralRiskLiveSync — identity boundary: fetched data is never applied to the wrong wallet/portfolio', () => {
  it('does not sync a response fetched for a different userAddress than this portfolio currently has configured', async () => {
    const portfolio = createV4Portfolio(VALID_ADDRESS);
    renderHook(() => useAaveV4CollateralRiskLiveSync(portfolio.id));

    useAaveV4CollateralRiskLiveDataStore.setState(readyState({ userAddress: OTHER_ADDRESS }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(
      usePortfolioStore.getState().portfolios[portfolio.id].portfolio.v4CollateralRisk,
    ).toBeUndefined();
  });

  it('syncs correctly once the store catches up to a matching identity', async () => {
    const portfolio = createV4Portfolio();
    renderHook(() => useAaveV4CollateralRiskLiveSync(portfolio.id));

    useAaveV4CollateralRiskLiveDataStore.setState(readyState({ userAddress: OTHER_ADDRESS }));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(
      usePortfolioStore.getState().portfolios[portfolio.id].portfolio.v4CollateralRisk,
    ).toBeUndefined();

    useAaveV4CollateralRiskLiveDataStore.setState(readyState());
    await waitFor(() => {
      expect(
        usePortfolioStore.getState().portfolios[portfolio.id].portfolio.v4CollateralRisk,
      ).toEqual(VALID_CANONICAL);
    });
  });

  it("switching the active portfolio to a different V4 wallet never leaks the first portfolio's fetched data into the second", async () => {
    const first = createV4Portfolio(VALID_ADDRESS);
    const second = createV4Portfolio(OTHER_ADDRESS);

    const { rerender } = renderHook(({ id }) => useAaveV4CollateralRiskLiveSync(id), {
      initialProps: { id: first.id },
    });
    expect(
      useAaveV4CollateralRiskLiveDataStore.getState().fetchAaveV4CollateralRiskLiveData,
    ).toHaveBeenCalledWith(VALID_ADDRESS);

    rerender({ id: second.id });
    expect(
      useAaveV4CollateralRiskLiveDataStore.getState().fetchAaveV4CollateralRiskLiveData,
    ).toHaveBeenCalledWith(OTHER_ADDRESS);

    // A late response for the FIRST portfolio's address now lands — must
    // never be written into the now-active second portfolio.
    useAaveV4CollateralRiskLiveDataStore.setState(readyState({ userAddress: VALID_ADDRESS }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(
      usePortfolioStore.getState().portfolios[second.id].portfolio.v4CollateralRisk,
    ).toBeUndefined();
    expect(
      usePortfolioStore.getState().portfolios[first.id].portfolio.v4CollateralRisk,
    ).toBeUndefined();
  });
});

describe('useAaveV4CollateralRiskLiveSync — does not fabricate or infer data', () => {
  it('never writes v4CollateralRisk from anything other than the exact canonical value the store received', async () => {
    const portfolio = createV4Portfolio();
    renderHook(() => useAaveV4CollateralRiskLiveSync(portfolio.id));

    const distinctive = { collateralFactor: 0.7314, dynamicConfigKey: 42 };
    useAaveV4CollateralRiskLiveDataStore.setState(readyState({ canonical: distinctive }));

    await waitFor(() => {
      expect(
        usePortfolioStore.getState().portfolios[portfolio.id].portfolio.v4CollateralRisk,
      ).toEqual(distinctive);
    });
  });
});

/**
 * "Clears on identity removal" — V4 Readiness Audit §12 Stage 23F's own
 * explicit requirement ("clearing/removing the V4 identity should not
 * leave a misleading 'live' risk snapshot attached"), and the one
 * structural difference from `useAaveV4LiveSync`. See the hook's own
 * header comment for why this matters beyond the status badge:
 * `resolveRiskCapacityFraction` reads `v4CollateralRisk.collateralFactor`
 * whenever `protocolVersion === 'v4'` regardless of whether `v4Position`
 * is still set, so a lingering value would silently feed a real
 * Health-Factor/liquidation calculation.
 */
describe('useAaveV4CollateralRiskLiveSync — clears a stale v4CollateralRisk when the V4 identity is removed', () => {
  it('clears v4CollateralRisk when v4Position is removed while still protocolVersion "v4"', async () => {
    const portfolio = createV4Portfolio();
    usePortfolioStore.getState().setAaveV4CollateralRisk(portfolio.id, VALID_CANONICAL);
    renderHook(() => useAaveV4CollateralRiskLiveSync(portfolio.id));

    usePortfolioStore.getState().setAaveV4Position(portfolio.id, undefined);

    await waitFor(() => {
      expect(
        usePortfolioStore.getState().portfolios[portfolio.id].portfolio.v4CollateralRisk,
      ).toBeUndefined();
    });
  });

  it('clears v4CollateralRisk when the portfolio switches from V4 back to V3', async () => {
    const portfolio = createV4Portfolio();
    usePortfolioStore.getState().setAaveV4CollateralRisk(portfolio.id, VALID_CANONICAL);
    renderHook(() => useAaveV4CollateralRiskLiveSync(portfolio.id));

    usePortfolioStore.getState().setProtocolVersion(portfolio.id, 'v3');

    await waitFor(() => {
      expect(
        usePortfolioStore.getState().portfolios[portfolio.id].portfolio.v4CollateralRisk,
      ).toBeUndefined();
    });
  });

  it('is a genuine no-op (no Store write) for a V3 portfolio that never had v4CollateralRisk set', async () => {
    const portfolio = createPortfolio();
    const updatedAtBefore = portfolio.updatedAt;
    renderHook(() => useAaveV4CollateralRiskLiveSync(portfolio.id));

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(usePortfolioStore.getState().portfolios[portfolio.id].portfolio.updatedAt).toBe(
      updatedAtBefore,
    );
  });

  it('does not clear v4CollateralRisk while the identity is still present (only removal triggers the clear)', async () => {
    const portfolio = createV4Portfolio();
    usePortfolioStore.getState().setAaveV4CollateralRisk(portfolio.id, VALID_CANONICAL);
    renderHook(() => useAaveV4CollateralRiskLiveSync(portfolio.id));

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(
      usePortfolioStore.getState().portfolios[portfolio.id].portfolio.v4CollateralRisk,
    ).toEqual(VALID_CANONICAL);
  });
});

import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAaveV4LiveSync } from '@/hooks/useAaveV4LiveSync';
import { useAaveV4LiveDataStore } from '@/stores/aaveV4LiveDataStore';
import { usePortfolioStore } from '@/stores/portfolioStore';

/**
 * `useAaveV4LiveSync` — V4 Readiness Audit §12 Stage 7. Mirrors
 * `tests/unit/hooks/useAaveLiveSync.test.ts`'s own technique: drives
 * `useAaveV4LiveDataStore.setState(...)` directly rather than mocking
 * `fetch` (the fetch-and-normalize pipeline is already covered by
 * `tests/unit/stores/aaveV4LiveDataStore.test.ts`), so this suite proves
 * the sync effect's own gating/identity/equality logic in isolation.
 */
const INITIAL_PORTFOLIO_STATE = {
  portfolios: {},
  activePortfolioId: null,
  loadStatus: 'idle' as const,
  saveStatus: 'idle' as const,
  errors: [],
  lastSynchronizedAt: null,
};

const IDLE_V4_STATE = {
  status: 'idle' as const,
  engineInputs: null,
  userAddress: null,
  debtAsset: null,
  errorMessage: null,
  fetchAaveV4LiveData: vi.fn().mockResolvedValue(undefined),
};

const VALID_ADDRESS = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' as `0x${string}`;
const OTHER_ADDRESS = '0x1111111111111111111111111111111111111111' as `0x${string}`;

beforeEach(() => {
  usePortfolioStore.setState(INITIAL_PORTFOLIO_STATE);
  useAaveV4LiveDataStore.setState(IDLE_V4_STATE);
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

const VALID_ENGINE_INPUTS = {
  drawnDebt: 15000,
  premiumDebt: 500,
  baseDrawnApr: 0.05,
  riskPremium: 0.01,
};

function readyState(overrides: Record<string, unknown> = {}) {
  return {
    status: 'ready' as const,
    engineInputs: VALID_ENGINE_INPUTS,
    userAddress: VALID_ADDRESS,
    debtAsset: 'USDC',
    errorMessage: null,
    fetchAaveV4LiveData: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('useAaveV4LiveSync — V3 isolation (strict no-op for every portfolio without both protocolVersion:"v4" and v4Position)', () => {
  it('never fetches for an ordinary V3 portfolio (neither field set)', () => {
    const portfolio = createPortfolio();
    renderHook(() => useAaveV4LiveSync(portfolio.id));
    expect(useAaveV4LiveDataStore.getState().fetchAaveV4LiveData).not.toHaveBeenCalled();
  });

  it('never fetches when only v4Position is set (protocolVersion still v3/unset)', () => {
    const portfolio = createPortfolio();
    usePortfolioStore.getState().setAaveV4Position(portfolio.id, { userAddress: VALID_ADDRESS });
    renderHook(() => useAaveV4LiveSync(portfolio.id));
    expect(useAaveV4LiveDataStore.getState().fetchAaveV4LiveData).not.toHaveBeenCalled();
  });

  it('never fetches when only protocolVersion is "v4" (no v4Position set)', () => {
    const portfolio = createPortfolio();
    usePortfolioStore.getState().setProtocolVersion(portfolio.id, 'v4');
    renderHook(() => useAaveV4LiveSync(portfolio.id));
    expect(useAaveV4LiveDataStore.getState().fetchAaveV4LiveData).not.toHaveBeenCalled();
  });

  it('never writes v4DebtState onto a V3 portfolio even if the V4 store happens to hold ready data', async () => {
    const portfolio = createPortfolio();
    renderHook(() => useAaveV4LiveSync(portfolio.id));

    useAaveV4LiveDataStore.setState(readyState());
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(
      usePortfolioStore.getState().portfolios[portfolio.id].portfolio.v4DebtState,
    ).toBeUndefined();
  });

  it("does not touch market/protocol/collateral/debt for a V3 portfolio (no cross-contamination with useAaveLiveSync's own fields)", () => {
    const portfolio = createPortfolio();
    renderHook(() => useAaveV4LiveSync(portfolio.id));
    const after = usePortfolioStore.getState().portfolios[portfolio.id].portfolio;
    expect(after.market).toEqual(portfolio.market);
    expect(after.protocol).toEqual(portfolio.protocol);
    expect(after.collateral).toEqual(portfolio.collateral);
    expect(after.debt).toEqual(portfolio.debt);
  });

  it('does nothing when portfolioId is null', () => {
    renderHook(() => useAaveV4LiveSync(null));
    expect(useAaveV4LiveDataStore.getState().fetchAaveV4LiveData).not.toHaveBeenCalled();
  });
});

describe('useAaveV4LiveSync — successful sync for an opted-in V4 portfolio', () => {
  it("fetches using the portfolio's own v4Position.userAddress and debt.asset", () => {
    const portfolio = createV4Portfolio();
    renderHook(() => useAaveV4LiveSync(portfolio.id));
    expect(useAaveV4LiveDataStore.getState().fetchAaveV4LiveData).toHaveBeenCalledWith(
      VALID_ADDRESS,
      'USDC',
    );
  });

  it('syncs a genuinely different engineInputs value into v4DebtState', async () => {
    const portfolio = createV4Portfolio();
    renderHook(() => useAaveV4LiveSync(portfolio.id));

    useAaveV4LiveDataStore.setState(readyState());

    await waitFor(() => {
      const updated = usePortfolioStore.getState().portfolios[portfolio.id].portfolio;
      expect(updated.v4DebtState).toEqual(VALID_ENGINE_INPUTS);
    });
  });
});

describe('useAaveV4LiveSync — identical data causes no portfolio update (equality gate)', () => {
  it('does not bump updatedAt when the fetched engineInputs already match the stored v4DebtState', async () => {
    const portfolio = createV4Portfolio();
    const withDebtState = usePortfolioStore
      .getState()
      .setAaveV4DebtState(portfolio.id, VALID_ENGINE_INPUTS);
    if (!withDebtState.ok) throw new Error('setup failed');
    const updatedAtBefore = withDebtState.data.updatedAt;

    renderHook(() => useAaveV4LiveSync(portfolio.id));
    useAaveV4LiveDataStore.setState(readyState());

    await new Promise((resolve) => setTimeout(resolve, 10));

    const after = usePortfolioStore.getState().portfolios[portfolio.id].portfolio;
    expect(after.updatedAt).toBe(updatedAtBefore);
  });
});

describe('useAaveV4LiveSync — RPC failure preserves last-known v4DebtState', () => {
  it('leaves v4DebtState untouched when the V4 store is in an error state', async () => {
    const portfolio = createV4Portfolio();
    usePortfolioStore.getState().setAaveV4DebtState(portfolio.id, VALID_ENGINE_INPUTS);
    renderHook(() => useAaveV4LiveSync(portfolio.id));

    useAaveV4LiveDataStore.setState({
      status: 'error',
      engineInputs: null,
      userAddress: null,
      debtAsset: null,
      errorMessage: 'Live Aave V4 data is temporarily unavailable.',
      fetchAaveV4LiveData: vi.fn().mockResolvedValue(undefined),
    });

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(usePortfolioStore.getState().portfolios[portfolio.id].portfolio.v4DebtState).toEqual(
      VALID_ENGINE_INPUTS,
    );
  });

  it('does nothing while still idle/loading (no fetch has resolved yet)', async () => {
    const portfolio = createV4Portfolio();
    renderHook(() => useAaveV4LiveSync(portfolio.id));

    useAaveV4LiveDataStore.setState({ status: 'loading' });
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(
      usePortfolioStore.getState().portfolios[portfolio.id].portfolio.v4DebtState,
    ).toBeUndefined();
  });
});

describe('useAaveV4LiveSync — identity boundary: fetched data is never applied to the wrong wallet/portfolio', () => {
  it('does not sync a response fetched for a different userAddress than this portfolio currently has configured', async () => {
    const portfolio = createV4Portfolio(VALID_ADDRESS);
    renderHook(() => useAaveV4LiveSync(portfolio.id));

    // A response for a DIFFERENT address lands (e.g. a stale fetch from
    // before the address was changed, or a race with another portfolio).
    useAaveV4LiveDataStore.setState(readyState({ userAddress: OTHER_ADDRESS }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(
      usePortfolioStore.getState().portfolios[portfolio.id].portfolio.v4DebtState,
    ).toBeUndefined();
  });

  it('does not sync a response fetched for a different debtAsset than this portfolio currently has configured', async () => {
    const portfolio = createV4Portfolio();
    renderHook(() => useAaveV4LiveSync(portfolio.id));

    useAaveV4LiveDataStore.setState(readyState({ debtAsset: 'USDT' }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(
      usePortfolioStore.getState().portfolios[portfolio.id].portfolio.v4DebtState,
    ).toBeUndefined();
  });

  it('syncs correctly once the V4 store catches up to a matching identity', async () => {
    const portfolio = createV4Portfolio();
    renderHook(() => useAaveV4LiveSync(portfolio.id));

    // First, a mismatched-address response lands — must be ignored.
    useAaveV4LiveDataStore.setState(readyState({ userAddress: OTHER_ADDRESS }));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(
      usePortfolioStore.getState().portfolios[portfolio.id].portfolio.v4DebtState,
    ).toBeUndefined();

    // Then a matching response lands — must sync.
    useAaveV4LiveDataStore.setState(readyState());
    await waitFor(() => {
      expect(usePortfolioStore.getState().portfolios[portfolio.id].portfolio.v4DebtState).toEqual(
        VALID_ENGINE_INPUTS,
      );
    });
  });

  it("switching the active portfolio to a different V4 wallet never leaks the first portfolio's fetched data into the second", async () => {
    const first = createV4Portfolio(VALID_ADDRESS);
    const second = createV4Portfolio(OTHER_ADDRESS);

    const { rerender } = renderHook(({ id }) => useAaveV4LiveSync(id), {
      initialProps: { id: first.id },
    });
    expect(useAaveV4LiveDataStore.getState().fetchAaveV4LiveData).toHaveBeenCalledWith(
      VALID_ADDRESS,
      'USDC',
    );

    // Switch to the second portfolio before any response has landed.
    rerender({ id: second.id });
    expect(useAaveV4LiveDataStore.getState().fetchAaveV4LiveData).toHaveBeenCalledWith(
      OTHER_ADDRESS,
      'USDC',
    );

    // A late response for the FIRST portfolio's address now lands — must
    // never be written into the now-active second portfolio.
    useAaveV4LiveDataStore.setState(readyState({ userAddress: VALID_ADDRESS }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(
      usePortfolioStore.getState().portfolios[second.id].portfolio.v4DebtState,
    ).toBeUndefined();
    expect(usePortfolioStore.getState().portfolios[first.id].portfolio.v4DebtState).toBeUndefined();
  });
});

describe('useAaveV4LiveSync — does not fabricate or infer data', () => {
  it('never writes v4DebtState from anything other than the exact engineInputs the V4 store received', async () => {
    const portfolio = createV4Portfolio();
    renderHook(() => useAaveV4LiveSync(portfolio.id));

    const distinctiveInputs = {
      drawnDebt: 12345.6789,
      premiumDebt: 42.1,
      baseDrawnApr: 0.0731,
      riskPremium: 0.0042,
    };
    useAaveV4LiveDataStore.setState(readyState({ engineInputs: distinctiveInputs }));

    await waitFor(() => {
      expect(usePortfolioStore.getState().portfolios[portfolio.id].portfolio.v4DebtState).toEqual(
        distinctiveInputs,
      );
    });
  });
});

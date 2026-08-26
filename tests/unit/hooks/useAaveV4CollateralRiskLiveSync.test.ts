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

// V4 Readiness Audit §12 P1-C — `VALID_CANONICAL` is the FETCH-STORE
// shape (`AaveV4CollateralRiskCanonicalData`, includes the P1-B oracle
// price); `VALID_RISK_CONFIG` is the narrowed shape the hook actually
// writes into `portfolio.v4CollateralRisk` (price is written to
// `market.btcPriceUsd` separately — see the hook's own header comment).
// Same numbers throughout so existing collateralFactor/dynamicConfigKey
// assertions are unaffected by this split.
const VALID_CANONICAL = { collateralFactor: 0.8, dynamicConfigKey: 1, collateralPriceUsd: 69000 };
const VALID_RISK_CONFIG = { collateralFactor: 0.8, dynamicConfigKey: 1 };

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
      expect(updated.v4CollateralRisk).toEqual(VALID_RISK_CONFIG);
    });
  });

  it('also syncs market.btcPriceUsd from the V4 oracle price (collateralPriceUsd), independent of collateralFactor', async () => {
    const portfolio = createV4Portfolio();
    renderHook(() => useAaveV4CollateralRiskLiveSync(portfolio.id));

    useAaveV4CollateralRiskLiveDataStore.setState(readyState());

    await waitFor(() => {
      const updated = usePortfolioStore.getState().portfolios[portfolio.id].portfolio;
      expect(updated.market.btcPriceUsd).toBe(69000);
    });
  });
});

describe('useAaveV4CollateralRiskLiveSync — identical data causes no portfolio update (equality gate)', () => {
  it('does not bump updatedAt when the fetched canonical value (collateralFactor/dynamicConfigKey AND price) already matches stored state', async () => {
    const portfolio = createV4Portfolio();
    const withRisk = usePortfolioStore
      .getState()
      .setAaveV4CollateralRisk(portfolio.id, VALID_RISK_CONFIG);
    if (!withRisk.ok) throw new Error('setup failed');
    // Also pre-set market to the fetch's collateralPriceUsd — otherwise
    // the P1-C market write below would itself bump updatedAt, which is
    // not what this test is isolating.
    const withMarket = usePortfolioStore
      .getState()
      .update(portfolio.id, { market: { btcPriceUsd: VALID_CANONICAL.collateralPriceUsd } });
    if (!withMarket.ok) throw new Error('setup failed');
    const updatedAtBefore = withMarket.data.updatedAt;

    renderHook(() => useAaveV4CollateralRiskLiveSync(portfolio.id));
    useAaveV4CollateralRiskLiveDataStore.setState(readyState());

    await new Promise((resolve) => setTimeout(resolve, 10));

    const after = usePortfolioStore.getState().portfolios[portfolio.id].portfolio;
    expect(after.updatedAt).toBe(updatedAtBefore);
  });

  /**
   * V4 Readiness Audit §12 P2-3 — same gap and fix as
   * `useAaveV4LiveSync.test.ts`'s own identically-named test, applied
   * here for `v4CollateralRisk`.
   */
  it('still refreshes v4CollateralRiskUpdatedAt on an unchanged live refresh, honestly reflecting the fresh confirmation', async () => {
    const portfolio = createV4Portfolio();
    const withRisk = usePortfolioStore
      .getState()
      .setAaveV4CollateralRisk(portfolio.id, VALID_RISK_CONFIG, 'live');
    if (!withRisk.ok) throw new Error('setup failed');
    const withMarket = usePortfolioStore
      .getState()
      .update(portfolio.id, { market: { btcPriceUsd: VALID_CANONICAL.collateralPriceUsd } });
    if (!withMarket.ok) throw new Error('setup failed');
    const stampBefore = withMarket.data.v4CollateralRiskUpdatedAt;
    expect(stampBefore).toBeDefined();

    await new Promise((resolve) => setTimeout(resolve, 5));

    renderHook(() => useAaveV4CollateralRiskLiveSync(portfolio.id));
    useAaveV4CollateralRiskLiveDataStore.setState(readyState());

    await waitFor(() => {
      const after = usePortfolioStore.getState().portfolios[portfolio.id].portfolio;
      expect(after.v4CollateralRiskUpdatedAt).not.toBe(stampBefore);
    });

    const after = usePortfolioStore.getState().portfolios[portfolio.id].portfolio;
    expect(after.v4CollateralRisk).toEqual(VALID_RISK_CONFIG);
    expect(after.v4CollateralRiskSource).toBe('live');
  });

  it('a changed dynamicConfigKey with a coincidentally-equal collateralFactor still counts as a real change', async () => {
    const portfolio = createV4Portfolio();
    usePortfolioStore
      .getState()
      .setAaveV4CollateralRisk(portfolio.id, { collateralFactor: 0.8, dynamicConfigKey: 1 });

    renderHook(() => useAaveV4CollateralRiskLiveSync(portfolio.id));
    useAaveV4CollateralRiskLiveDataStore.setState(
      readyState({
        canonical: { collateralFactor: 0.8, dynamicConfigKey: 2, collateralPriceUsd: 69000 },
      }),
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
    usePortfolioStore.getState().setAaveV4CollateralRisk(portfolio.id, VALID_RISK_CONFIG);
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
    ).toEqual(VALID_RISK_CONFIG);
  });

  it('leaves market.btcPriceUsd untouched (no fallback to $0/$1/V3) when the V4 oracle fetch is in an error state', async () => {
    const portfolio = createV4Portfolio();
    usePortfolioStore.getState().update(portfolio.id, { market: { btcPriceUsd: 50000 } });
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

    expect(usePortfolioStore.getState().portfolios[portfolio.id].portfolio.market.btcPriceUsd).toBe(
      50000,
    );
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
      ).toEqual(VALID_RISK_CONFIG);
    });
  });

  it("switching the active portfolio to a different V4 wallet never leaks the first portfolio's fetched market price into the second", async () => {
    const first = createV4Portfolio(VALID_ADDRESS);
    const second = createV4Portfolio(OTHER_ADDRESS);

    const { rerender } = renderHook(({ id }) => useAaveV4CollateralRiskLiveSync(id), {
      initialProps: { id: first.id },
    });
    rerender({ id: second.id });

    // A late response for the FIRST portfolio's address now lands —
    // must never be written into the now-active second portfolio's
    // market price either.
    useAaveV4CollateralRiskLiveDataStore.setState(readyState({ userAddress: VALID_ADDRESS }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(usePortfolioStore.getState().portfolios[second.id].portfolio.market.btcPriceUsd).toBe(
      50000,
    );
    expect(usePortfolioStore.getState().portfolios[first.id].portfolio.market.btcPriceUsd).toBe(
      50000,
    );
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

    const distinctive = {
      collateralFactor: 0.7314,
      dynamicConfigKey: 42,
      collateralPriceUsd: 71234,
    };
    useAaveV4CollateralRiskLiveDataStore.setState(readyState({ canonical: distinctive }));

    await waitFor(() => {
      expect(
        usePortfolioStore.getState().portfolios[portfolio.id].portfolio.v4CollateralRisk,
      ).toEqual({ collateralFactor: 0.7314, dynamicConfigKey: 42 });
    });
  });

  it('never writes market.btcPriceUsd from anything other than the exact collateralPriceUsd the store received', async () => {
    const portfolio = createV4Portfolio();
    renderHook(() => useAaveV4CollateralRiskLiveSync(portfolio.id));

    const distinctive = {
      collateralFactor: 0.7314,
      dynamicConfigKey: 42,
      collateralPriceUsd: 71234,
    };
    useAaveV4CollateralRiskLiveDataStore.setState(readyState({ canonical: distinctive }));

    await waitFor(() => {
      expect(
        usePortfolioStore.getState().portfolios[portfolio.id].portfolio.market.btcPriceUsd,
      ).toBe(71234);
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
    usePortfolioStore.getState().setAaveV4CollateralRisk(portfolio.id, VALID_RISK_CONFIG);
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
    usePortfolioStore.getState().setAaveV4CollateralRisk(portfolio.id, VALID_RISK_CONFIG);
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
    usePortfolioStore.getState().setAaveV4CollateralRisk(portfolio.id, VALID_RISK_CONFIG);
    renderHook(() => useAaveV4CollateralRiskLiveSync(portfolio.id));

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(
      usePortfolioStore.getState().portfolios[portfolio.id].portfolio.v4CollateralRisk,
    ).toEqual(VALID_RISK_CONFIG);
  });
});

/**
 * Manual/hypothetical mode — V4 Readiness Audit §12 Stage 25. A manual
 * `v4CollateralRisk` has no dependency on a wallet address at all, by
 * design (the whole point of manual mode), so it must NEVER be cleared
 * by this hook's own "orphaned by identity removal" logic — that logic
 * exists specifically for a `'live'`-sourced value that no longer has an
 * address to have been read from. Confirms the fix made alongside this
 * stage: the clearing branch now checks `v4CollateralRiskSource ===
 * 'live'`, not just `v4CollateralRisk !== undefined`.
 */
describe('useAaveV4CollateralRiskLiveSync — manual/hypothetical mode (Stage 25)', () => {
  it('never clears a MANUAL v4CollateralRisk for a portfolio with no address at all', async () => {
    const portfolio = createPortfolio();
    usePortfolioStore.getState().setProtocolVersion(portfolio.id, 'v4');
    usePortfolioStore.getState().setAaveV4CollateralRisk(portfolio.id, VALID_RISK_CONFIG, 'manual');
    renderHook(() => useAaveV4CollateralRiskLiveSync(portfolio.id));

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(
      usePortfolioStore.getState().portfolios[portfolio.id].portfolio.v4CollateralRisk,
    ).toEqual(VALID_RISK_CONFIG);
    expect(
      usePortfolioStore.getState().portfolios[portfolio.id].portfolio.v4CollateralRiskSource,
    ).toBe('manual');
  });

  it('never clears a MANUAL v4CollateralRisk when the v4Position address is removed (manual has no address dependency)', async () => {
    const portfolio = createV4Portfolio();
    usePortfolioStore.getState().setAaveV4CollateralRisk(portfolio.id, VALID_RISK_CONFIG, 'manual');
    renderHook(() => useAaveV4CollateralRiskLiveSync(portfolio.id));

    usePortfolioStore.getState().setAaveV4Position(portfolio.id, undefined);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(
      usePortfolioStore.getState().portfolios[portfolio.id].portfolio.v4CollateralRisk,
    ).toEqual(VALID_RISK_CONFIG);
  });

  it('a successful live fetch still transitions a manual value to "live", even with coincidentally-equal numbers', async () => {
    const portfolio = createV4Portfolio();
    usePortfolioStore.getState().setAaveV4CollateralRisk(portfolio.id, VALID_RISK_CONFIG, 'manual');
    renderHook(() => useAaveV4CollateralRiskLiveSync(portfolio.id));

    // The live store resolves with the EXACT SAME numbers already stored
    // manually — a real, if coincidental, possibility.
    useAaveV4CollateralRiskLiveDataStore.setState(readyState({ canonical: VALID_CANONICAL }));

    await waitFor(() => {
      expect(
        usePortfolioStore.getState().portfolios[portfolio.id].portfolio.v4CollateralRiskSource,
      ).toBe('live');
    });
    expect(
      usePortfolioStore.getState().portfolios[portfolio.id].portfolio.v4CollateralRisk,
    ).toEqual(VALID_RISK_CONFIG);
  });

  it('a failed live fetch preserves the manual value and its "manual" source untouched', async () => {
    const portfolio = createV4Portfolio();
    usePortfolioStore.getState().setAaveV4CollateralRisk(portfolio.id, VALID_RISK_CONFIG, 'manual');
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

    const after = usePortfolioStore.getState().portfolios[portfolio.id].portfolio;
    expect(after.v4CollateralRisk).toEqual(VALID_RISK_CONFIG);
    expect(after.v4CollateralRiskSource).toBe('manual');
  });
});

/**
 * P0-1 — manual/live conflict confirmation (V4 Readiness Audit §12).
 * Mirrors `tests/unit/hooks/useAaveV4LiveSync.test.ts`'s own identically-named
 * suite for the identical mechanism applied here. Deliberately distinct
 * fixture values throughout.
 */
const MANUAL_RISK = { collateralFactor: 0.55, dynamicConfigKey: 9 };
// `DIFFERING_LIVE_CANONICAL` is the FETCH-STORE shape (includes price);
// `DIFFERING_LIVE_RISK_CONFIG` is what actually lands in
// `portfolio.v4CollateralRisk`/candidates — same split as
// `VALID_CANONICAL`/`VALID_RISK_CONFIG` above, same reason.
const DIFFERING_LIVE_CANONICAL = {
  collateralFactor: 0.71,
  dynamicConfigKey: 3,
  collateralPriceUsd: 82000,
};
const DIFFERING_LIVE_RISK_CONFIG = { collateralFactor: 0.71, dynamicConfigKey: 3 };

describe('useAaveV4CollateralRiskLiveSync — P0-1: a differing MANUAL value is never auto-overwritten, becomes a pending candidate', () => {
  it('canonical v4CollateralRisk/source stay manual and unchanged; the fetched value is registered as a candidate instead', async () => {
    const portfolio = createV4Portfolio();
    usePortfolioStore.getState().setAaveV4CollateralRisk(portfolio.id, MANUAL_RISK, 'manual');
    renderHook(() => useAaveV4CollateralRiskLiveSync(portfolio.id));

    useAaveV4CollateralRiskLiveDataStore.setState(
      readyState({ canonical: DIFFERING_LIVE_CANONICAL }),
    );

    await waitFor(() => {
      expect(usePortfolioStore.getState().v4CollateralRiskCandidates[portfolio.id]).toEqual(
        DIFFERING_LIVE_RISK_CONFIG,
      );
    });
    const after = usePortfolioStore.getState().portfolios[portfolio.id].portfolio;
    expect(after.v4CollateralRisk).toEqual(MANUAL_RISK);
    expect(after.v4CollateralRiskSource).toBe('manual');
  });
});

describe('useAaveV4CollateralRiskLiveSync — P0-1: identical manual value auto-adopts silently, no candidate', () => {
  it('numerically identical manual and fetched values transition to live directly, never creating a candidate', async () => {
    const portfolio = createV4Portfolio();
    usePortfolioStore.getState().setAaveV4CollateralRisk(portfolio.id, VALID_RISK_CONFIG, 'manual');
    renderHook(() => useAaveV4CollateralRiskLiveSync(portfolio.id));

    useAaveV4CollateralRiskLiveDataStore.setState(readyState({ canonical: VALID_CANONICAL }));

    await waitFor(() => {
      expect(
        usePortfolioStore.getState().portfolios[portfolio.id].portfolio.v4CollateralRiskSource,
      ).toBe('live');
    });
    expect(usePortfolioStore.getState().v4CollateralRiskCandidates[portfolio.id]).toBeUndefined();
  });
});

describe('useAaveV4CollateralRiskLiveSync — P0-1: live→live refresh remains fully automatic (unchanged freshness model)', () => {
  it('a changed refresh of an already-live value auto-applies with no candidate', async () => {
    const portfolio = createV4Portfolio();
    usePortfolioStore.getState().setAaveV4CollateralRisk(portfolio.id, VALID_RISK_CONFIG, 'live');
    renderHook(() => useAaveV4CollateralRiskLiveSync(portfolio.id));

    const freshFromChain = {
      collateralFactor: 0.88,
      dynamicConfigKey: 4,
      collateralPriceUsd: 91000,
    };
    useAaveV4CollateralRiskLiveDataStore.setState(readyState({ canonical: freshFromChain }));

    await waitFor(() => {
      expect(
        usePortfolioStore.getState().portfolios[portfolio.id].portfolio.v4CollateralRisk,
      ).toEqual({ collateralFactor: 0.88, dynamicConfigKey: 4 });
    });
    expect(usePortfolioStore.getState().v4CollateralRiskCandidates[portfolio.id]).toBeUndefined();
  });

  it('also updates market.btcPriceUsd on a live→live refresh (a genuine V4 price change, no candidate involved)', async () => {
    const portfolio = createV4Portfolio();
    usePortfolioStore.getState().setAaveV4CollateralRisk(portfolio.id, VALID_RISK_CONFIG, 'live');
    usePortfolioStore.getState().update(portfolio.id, { market: { btcPriceUsd: 69000 } });
    renderHook(() => useAaveV4CollateralRiskLiveSync(portfolio.id));

    const freshFromChain = {
      collateralFactor: 0.88,
      dynamicConfigKey: 4,
      collateralPriceUsd: 91000,
    };
    useAaveV4CollateralRiskLiveDataStore.setState(readyState({ canonical: freshFromChain }));

    await waitFor(() => {
      expect(
        usePortfolioStore.getState().portfolios[portfolio.id].portfolio.market.btcPriceUsd,
      ).toBe(91000);
    });
  });
});

describe('useAaveV4CollateralRiskLiveSync — P0-1: a failed fetch never creates a candidate; manual state stays untouched', () => {
  it('an error status leaves the manual value and source alone, and creates no candidate', async () => {
    const portfolio = createV4Portfolio();
    usePortfolioStore.getState().setAaveV4CollateralRisk(portfolio.id, MANUAL_RISK, 'manual');
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

    const after = usePortfolioStore.getState().portfolios[portfolio.id].portfolio;
    expect(after.v4CollateralRisk).toEqual(MANUAL_RISK);
    expect(after.v4CollateralRiskSource).toBe('manual');
    expect(usePortfolioStore.getState().v4CollateralRiskCandidates[portfolio.id]).toBeUndefined();
  });
});

describe('useAaveV4CollateralRiskLiveSync — P0-1: accepting/dismissing a pending candidate', () => {
  it('accepting writes the candidate as the new canonical live value and clears the candidate', async () => {
    const portfolio = createV4Portfolio();
    usePortfolioStore.getState().setAaveV4CollateralRisk(portfolio.id, MANUAL_RISK, 'manual');
    renderHook(() => useAaveV4CollateralRiskLiveSync(portfolio.id));
    useAaveV4CollateralRiskLiveDataStore.setState(
      readyState({ canonical: DIFFERING_LIVE_CANONICAL }),
    );
    await waitFor(() => {
      expect(usePortfolioStore.getState().v4CollateralRiskCandidates[portfolio.id]).toEqual(
        DIFFERING_LIVE_RISK_CONFIG,
      );
    });

    const result = usePortfolioStore.getState().acceptAaveV4CollateralRiskCandidate(portfolio.id);
    expect(result.ok).toBe(true);

    const after = usePortfolioStore.getState().portfolios[portfolio.id].portfolio;
    expect(after.v4CollateralRisk).toEqual(DIFFERING_LIVE_RISK_CONFIG);
    expect(after.v4CollateralRiskSource).toBe('live');
    expect(usePortfolioStore.getState().v4CollateralRiskCandidates[portfolio.id]).toBeUndefined();
  });

  it('accepting with no pending candidate returns a validation error and touches nothing', () => {
    const portfolio = createV4Portfolio();
    usePortfolioStore.getState().setAaveV4CollateralRisk(portfolio.id, MANUAL_RISK, 'manual');

    const result = usePortfolioStore.getState().acceptAaveV4CollateralRiskCandidate(portfolio.id);
    expect(result.ok).toBe(false);

    const after = usePortfolioStore.getState().portfolios[portfolio.id].portfolio;
    expect(after.v4CollateralRisk).toEqual(MANUAL_RISK);
    expect(after.v4CollateralRiskSource).toBe('manual');
  });

  it('"Keep Manual" (dismiss) clears the candidate and leaves canonical manual state completely untouched', async () => {
    const portfolio = createV4Portfolio();
    usePortfolioStore.getState().setAaveV4CollateralRisk(portfolio.id, MANUAL_RISK, 'manual');
    renderHook(() => useAaveV4CollateralRiskLiveSync(portfolio.id));
    useAaveV4CollateralRiskLiveDataStore.setState(
      readyState({ canonical: DIFFERING_LIVE_CANONICAL }),
    );
    await waitFor(() => {
      expect(usePortfolioStore.getState().v4CollateralRiskCandidates[portfolio.id]).toEqual(
        DIFFERING_LIVE_RISK_CONFIG,
      );
    });

    usePortfolioStore.getState().dismissAaveV4CollateralRiskCandidate(portfolio.id);

    expect(usePortfolioStore.getState().v4CollateralRiskCandidates[portfolio.id]).toBeUndefined();
    const after = usePortfolioStore.getState().portfolios[portfolio.id].portfolio;
    expect(after.v4CollateralRisk).toEqual(MANUAL_RISK);
    expect(after.v4CollateralRiskSource).toBe('manual');
  });

  it('a dismissed candidate does not instantly reappear from an unrelated portfolio update without a genuinely new fetch', async () => {
    const portfolio = createV4Portfolio();
    usePortfolioStore.getState().setAaveV4CollateralRisk(portfolio.id, MANUAL_RISK, 'manual');
    renderHook(() => useAaveV4CollateralRiskLiveSync(portfolio.id));
    useAaveV4CollateralRiskLiveDataStore.setState(
      readyState({ canonical: DIFFERING_LIVE_CANONICAL }),
    );
    await waitFor(() => {
      expect(usePortfolioStore.getState().v4CollateralRiskCandidates[portfolio.id]).toEqual(
        DIFFERING_LIVE_RISK_CONFIG,
      );
    });
    usePortfolioStore.getState().dismissAaveV4CollateralRiskCandidate(portfolio.id);

    usePortfolioStore.getState().update(portfolio.id, { name: 'Renamed' });
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(usePortfolioStore.getState().v4CollateralRiskCandidates[portfolio.id]).toBeUndefined();
  });

  it('a genuinely new fetch after a dismissal can surface a new conflict', async () => {
    const portfolio = createV4Portfolio();
    usePortfolioStore.getState().setAaveV4CollateralRisk(portfolio.id, MANUAL_RISK, 'manual');
    renderHook(() => useAaveV4CollateralRiskLiveSync(portfolio.id));
    useAaveV4CollateralRiskLiveDataStore.setState(
      readyState({ canonical: DIFFERING_LIVE_CANONICAL }),
    );
    await waitFor(() => {
      expect(usePortfolioStore.getState().v4CollateralRiskCandidates[portfolio.id]).toEqual(
        DIFFERING_LIVE_RISK_CONFIG,
      );
    });
    usePortfolioStore.getState().dismissAaveV4CollateralRiskCandidate(portfolio.id);

    const anotherDifferingFetch = {
      collateralFactor: 0.63,
      dynamicConfigKey: 5,
      collateralPriceUsd: 55000,
    };
    useAaveV4CollateralRiskLiveDataStore.setState(readyState({ canonical: anotherDifferingFetch }));

    await waitFor(() => {
      expect(usePortfolioStore.getState().v4CollateralRiskCandidates[portfolio.id]).toEqual({
        collateralFactor: 0.63,
        dynamicConfigKey: 5,
      });
    });
    expect(
      usePortfolioStore.getState().portfolios[portfolio.id].portfolio.v4CollateralRiskSource,
    ).toBe('manual');
  });
});

describe('useAaveV4CollateralRiskLiveSync — P0-1: cross-portfolio candidate isolation', () => {
  it('a candidate created for one portfolio is never visible to, or actionable from, another portfolio', async () => {
    const first = createV4Portfolio(VALID_ADDRESS);
    const second = createV4Portfolio(OTHER_ADDRESS);
    usePortfolioStore.getState().setAaveV4CollateralRisk(first.id, MANUAL_RISK, 'manual');
    const secondManual = { collateralFactor: 0.33, dynamicConfigKey: 7 };
    usePortfolioStore.getState().setAaveV4CollateralRisk(second.id, secondManual, 'manual');

    const { rerender } = renderHook(({ id }) => useAaveV4CollateralRiskLiveSync(id), {
      initialProps: { id: first.id },
    });
    useAaveV4CollateralRiskLiveDataStore.setState(
      readyState({ canonical: DIFFERING_LIVE_CANONICAL }),
    );
    await waitFor(() => {
      expect(usePortfolioStore.getState().v4CollateralRiskCandidates[first.id]).toEqual(
        DIFFERING_LIVE_RISK_CONFIG,
      );
    });
    expect(usePortfolioStore.getState().v4CollateralRiskCandidates[second.id]).toBeUndefined();

    const result = usePortfolioStore.getState().acceptAaveV4CollateralRiskCandidate(second.id);
    expect(result.ok).toBe(false);
    expect(usePortfolioStore.getState().portfolios[second.id].portfolio.v4CollateralRisk).toEqual(
      secondManual,
    );

    rerender({ id: second.id });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(usePortfolioStore.getState().v4CollateralRiskCandidates[first.id]).toEqual(
      DIFFERING_LIVE_RISK_CONFIG,
    );
  });
});

describe('useAaveV4CollateralRiskLiveSync — P0-1: identity removal invalidates the pending candidate', () => {
  it('removing v4Position while a candidate is pending clears the candidate (canonical manual value untouched)', async () => {
    const portfolio = createV4Portfolio();
    usePortfolioStore.getState().setAaveV4CollateralRisk(portfolio.id, MANUAL_RISK, 'manual');
    renderHook(() => useAaveV4CollateralRiskLiveSync(portfolio.id));
    useAaveV4CollateralRiskLiveDataStore.setState(
      readyState({ canonical: DIFFERING_LIVE_CANONICAL }),
    );
    await waitFor(() => {
      expect(usePortfolioStore.getState().v4CollateralRiskCandidates[portfolio.id]).toEqual(
        DIFFERING_LIVE_RISK_CONFIG,
      );
    });

    usePortfolioStore.getState().setAaveV4Position(portfolio.id, undefined);

    await waitFor(() => {
      expect(usePortfolioStore.getState().v4CollateralRiskCandidates[portfolio.id]).toBeUndefined();
    });
    const after = usePortfolioStore.getState().portfolios[portfolio.id].portfolio;
    expect(after.v4CollateralRisk).toEqual(MANUAL_RISK);
    expect(after.v4CollateralRiskSource).toBe('manual');
  });
});

describe('useAaveV4CollateralRiskLiveSync — P0-1: V3 remains unaffected', () => {
  it('a V3 portfolio never populates a candidate even if the V4 live store happens to hold ready data', async () => {
    const portfolio = createPortfolio();
    renderHook(() => useAaveV4CollateralRiskLiveSync(portfolio.id));

    useAaveV4CollateralRiskLiveDataStore.setState(readyState());
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(usePortfolioStore.getState().v4CollateralRiskCandidates[portfolio.id]).toBeUndefined();
  });
});

/**
 * P0-4 — classified live-fetch error surfacing (V4 Readiness Audit §12).
 * Mirrors `tests/unit/hooks/useAaveV4LiveSync.test.ts`'s own identically-named
 * suite for the identical mechanism applied here, minus the debt-asset
 * dimension this store doesn't have.
 */
function errorState(overrides: Record<string, unknown> = {}) {
  return {
    status: 'error' as const,
    canonical: null,
    userAddress: null,
    errorMessage: 'The Aave V4 data request timed out. Please try again.',
    errorCode: 'AAVE_V4_RPC_TIMEOUT',
    attemptedUserAddress: VALID_ADDRESS,
    lastFetchedAt: null,
    fetchAaveV4CollateralRiskLiveData: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('useAaveV4CollateralRiskLiveSync — P0-4: a classified failure for the CURRENT identity is recorded', () => {
  it('records the exact code/message when the attempted identity matches the current portfolio', async () => {
    const portfolio = createV4Portfolio();
    renderHook(() => useAaveV4CollateralRiskLiveSync(portfolio.id));

    useAaveV4CollateralRiskLiveDataStore.setState(errorState());

    await waitFor(() => {
      expect(usePortfolioStore.getState().v4CollateralRiskErrors[portfolio.id]).toEqual({
        code: 'AAVE_V4_RPC_TIMEOUT',
        message: 'The Aave V4 data request timed out. Please try again.',
      });
    });
  });

  it('a network-catch failure with no classified code still records with code: null', async () => {
    const portfolio = createV4Portfolio();
    renderHook(() => useAaveV4CollateralRiskLiveSync(portfolio.id));

    useAaveV4CollateralRiskLiveDataStore.setState(
      errorState({
        errorMessage: 'Live Aave V4 collateral-risk data is temporarily unavailable.',
        errorCode: null,
      }),
    );

    await waitFor(() => {
      expect(usePortfolioStore.getState().v4CollateralRiskErrors[portfolio.id]).toEqual({
        code: null,
        message: 'Live Aave V4 collateral-risk data is temporarily unavailable.',
      });
    });
  });

  it('does NOT record an error whose attempted identity does not match this portfolio (a stale/foreign failure)', async () => {
    const portfolio = createV4Portfolio();
    renderHook(() => useAaveV4CollateralRiskLiveSync(portfolio.id));

    useAaveV4CollateralRiskLiveDataStore.setState(
      errorState({ attemptedUserAddress: OTHER_ADDRESS }),
    );
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(usePortfolioStore.getState().v4CollateralRiskErrors[portfolio.id]).toBeUndefined();
  });
});

describe('useAaveV4CollateralRiskLiveSync — P0-4: manual canonical state remains usable while a live error is visible', () => {
  it('the manual v4CollateralRisk/source are completely unaffected by an error being recorded', async () => {
    const portfolio = createV4Portfolio();
    usePortfolioStore.getState().setAaveV4CollateralRisk(portfolio.id, MANUAL_RISK, 'manual');
    renderHook(() => useAaveV4CollateralRiskLiveSync(portfolio.id));

    useAaveV4CollateralRiskLiveDataStore.setState(errorState());

    await waitFor(() => {
      expect(usePortfolioStore.getState().v4CollateralRiskErrors[portfolio.id]).toBeDefined();
    });
    const after = usePortfolioStore.getState().portfolios[portfolio.id].portfolio;
    expect(after.v4CollateralRisk).toEqual(MANUAL_RISK);
    expect(after.v4CollateralRiskSource).toBe('manual');
  });
});

describe('useAaveV4CollateralRiskLiveSync — P0-4: a later successful fetch clears the previously displayed error', () => {
  it('clears the error once a genuinely new fetch succeeds (auto-adopt case)', async () => {
    const portfolio = createV4Portfolio();
    renderHook(() => useAaveV4CollateralRiskLiveSync(portfolio.id));

    useAaveV4CollateralRiskLiveDataStore.setState(errorState());
    await waitFor(() => {
      expect(usePortfolioStore.getState().v4CollateralRiskErrors[portfolio.id]).toBeDefined();
    });

    useAaveV4CollateralRiskLiveDataStore.setState(readyState());
    await waitFor(() => {
      expect(
        usePortfolioStore.getState().portfolios[portfolio.id].portfolio.v4CollateralRisk,
      ).toEqual(VALID_RISK_CONFIG);
    });
    expect(usePortfolioStore.getState().v4CollateralRiskErrors[portfolio.id]).toBeUndefined();
  });

  it('clears the error even when the success turns into a P0-1 candidate rather than an auto-apply', async () => {
    const portfolio = createV4Portfolio();
    usePortfolioStore.getState().setAaveV4CollateralRisk(portfolio.id, MANUAL_RISK, 'manual');
    renderHook(() => useAaveV4CollateralRiskLiveSync(portfolio.id));

    useAaveV4CollateralRiskLiveDataStore.setState(errorState());
    await waitFor(() => {
      expect(usePortfolioStore.getState().v4CollateralRiskErrors[portfolio.id]).toBeDefined();
    });

    useAaveV4CollateralRiskLiveDataStore.setState(
      readyState({ canonical: DIFFERING_LIVE_CANONICAL }),
    );
    await waitFor(() => {
      expect(usePortfolioStore.getState().v4CollateralRiskCandidates[portfolio.id]).toEqual(
        DIFFERING_LIVE_RISK_CONFIG,
      );
    });
    expect(usePortfolioStore.getState().v4CollateralRiskErrors[portfolio.id]).toBeUndefined();
  });
});

describe('useAaveV4CollateralRiskLiveSync — P0-4: a P0-1 pending candidate survives a later fetch error', () => {
  it('a later failed fetch does not clear or alter an already-pending candidate', async () => {
    const portfolio = createV4Portfolio();
    usePortfolioStore.getState().setAaveV4CollateralRisk(portfolio.id, MANUAL_RISK, 'manual');
    renderHook(() => useAaveV4CollateralRiskLiveSync(portfolio.id));

    useAaveV4CollateralRiskLiveDataStore.setState(
      readyState({ canonical: DIFFERING_LIVE_CANONICAL }),
    );
    await waitFor(() => {
      expect(usePortfolioStore.getState().v4CollateralRiskCandidates[portfolio.id]).toEqual(
        DIFFERING_LIVE_RISK_CONFIG,
      );
    });

    useAaveV4CollateralRiskLiveDataStore.setState(errorState());
    await waitFor(() => {
      expect(usePortfolioStore.getState().v4CollateralRiskErrors[portfolio.id]).toBeDefined();
    });

    expect(usePortfolioStore.getState().v4CollateralRiskCandidates[portfolio.id]).toEqual(
      DIFFERING_LIVE_RISK_CONFIG,
    );
    const after = usePortfolioStore.getState().portfolios[portfolio.id].portfolio;
    expect(after.v4CollateralRisk).toEqual(MANUAL_RISK);
    expect(after.v4CollateralRiskSource).toBe('manual');
  });
});

describe('useAaveV4CollateralRiskLiveSync — P0-4: identity removal invalidates a displayed error', () => {
  it('removing v4Position while an error is displayed clears it', async () => {
    const portfolio = createV4Portfolio();
    renderHook(() => useAaveV4CollateralRiskLiveSync(portfolio.id));

    useAaveV4CollateralRiskLiveDataStore.setState(errorState());
    await waitFor(() => {
      expect(usePortfolioStore.getState().v4CollateralRiskErrors[portfolio.id]).toBeDefined();
    });

    usePortfolioStore.getState().setAaveV4Position(portfolio.id, undefined);

    await waitFor(() => {
      expect(usePortfolioStore.getState().v4CollateralRiskErrors[portfolio.id]).toBeUndefined();
    });
  });
});

describe('useAaveV4CollateralRiskLiveSync — P0-4: cross-portfolio error isolation', () => {
  it("an error recorded for one portfolio is never visible under another portfolio's key, including across a hook remount/switch", async () => {
    const first = createV4Portfolio(VALID_ADDRESS);
    const second = createV4Portfolio(OTHER_ADDRESS);

    const { rerender } = renderHook(({ id }) => useAaveV4CollateralRiskLiveSync(id), {
      initialProps: { id: first.id },
    });

    useAaveV4CollateralRiskLiveDataStore.setState(errorState());
    await waitFor(() => {
      expect(usePortfolioStore.getState().v4CollateralRiskErrors[first.id]).toBeDefined();
    });
    expect(usePortfolioStore.getState().v4CollateralRiskErrors[second.id]).toBeUndefined();

    rerender({ id: second.id });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(usePortfolioStore.getState().v4CollateralRiskErrors[second.id]).toBeUndefined();
    expect(usePortfolioStore.getState().v4CollateralRiskErrors[first.id]).toEqual({
      code: 'AAVE_V4_RPC_TIMEOUT',
      message: 'The Aave V4 data request timed out. Please try again.',
    });
  });
});

describe('useAaveV4CollateralRiskLiveSync — P0-4: V3 remains unaffected', () => {
  it('a V3 portfolio never populates an error even if the V4 live store happens to hold error data', async () => {
    const portfolio = createPortfolio();
    renderHook(() => useAaveV4CollateralRiskLiveSync(portfolio.id));

    useAaveV4CollateralRiskLiveDataStore.setState(errorState());
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(usePortfolioStore.getState().v4CollateralRiskErrors[portfolio.id]).toBeUndefined();
  });
});

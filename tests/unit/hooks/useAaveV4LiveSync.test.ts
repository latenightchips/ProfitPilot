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

function idleV4State() {
  return {
    status: 'idle' as const,
    engineInputs: null,
    userAddress: null,
    debtAsset: null,
    errorMessage: null,
    fetchAaveV4LiveData: vi.fn().mockResolvedValue(undefined),
  };
}

const VALID_ADDRESS = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' as `0x${string}`;
const OTHER_ADDRESS = '0x1111111111111111111111111111111111111111' as `0x${string}`;

beforeEach(() => {
  usePortfolioStore.setState(INITIAL_PORTFOLIO_STATE);
  useAaveV4LiveDataStore.setState(idleV4State());
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
  debtAssetPriceUsd: 1.0,
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

/**
 * V4 Readiness Audit §12 Stage 14 — regression coverage for a real bug
 * this stage's own integration test (`tests/integration/portfolio/aaveV4LiveFlow.test.tsx`)
 * caught: the write effect below depends on the whole `portfolio` object
 * (needed so it re-checks after a fetch lands), so it used to re-run —
 * and needlessly re-apply the OLD `engineInputs` — after ANY portfolio
 * update, including one where the portfolio's own `v4DebtState` had
 * since been intentionally changed locally (e.g. a Stage-12 repay
 * Apply) without any new fetch. `lastAppliedEngineInputs` now makes the
 * effect a strict one-shot per distinct fetch result.
 */
describe('useAaveV4LiveSync — a later local v4DebtState edit is never clobbered by a stale, already-applied fetch (Stage 14 fix)', () => {
  it('does not re-apply the same engineInputs after an unrelated portfolio update once it has already synced once', async () => {
    const portfolio = createV4Portfolio();
    renderHook(() => useAaveV4LiveSync(portfolio.id));

    useAaveV4LiveDataStore.setState(readyState());
    await waitFor(() => {
      expect(usePortfolioStore.getState().portfolios[portfolio.id].portfolio.v4DebtState).toEqual(
        VALID_ENGINE_INPUTS,
      );
    });

    // A local edit changes v4DebtState WITHOUT any new fetch landing —
    // e.g. a Stage-12 repayment Apply. This is itself a portfolio update,
    // which re-triggers the write effect's dependency array.
    const locallyRepaid = { ...VALID_ENGINE_INPUTS, premiumDebt: 0 };
    usePortfolioStore.getState().setAaveV4DebtState(portfolio.id, locallyRepaid);

    // Give the effect a turn to (incorrectly, pre-fix) re-run.
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(usePortfolioStore.getState().portfolios[portfolio.id].portfolio.v4DebtState).toEqual(
      locallyRepaid,
    );
  });

  it('a genuinely NEW fetch result still overrides a prior local edit (live sync is not disabled by the fix)', async () => {
    const portfolio = createV4Portfolio();
    renderHook(() => useAaveV4LiveSync(portfolio.id));

    useAaveV4LiveDataStore.setState(readyState());
    await waitFor(() => {
      expect(usePortfolioStore.getState().portfolios[portfolio.id].portfolio.v4DebtState).toEqual(
        VALID_ENGINE_INPUTS,
      );
    });

    usePortfolioStore
      .getState()
      .setAaveV4DebtState(portfolio.id, { ...VALID_ENGINE_INPUTS, premiumDebt: 0 });

    // A genuinely fresh fetch (a new engineInputs value/object) lands.
    const freshFromChain = { ...VALID_ENGINE_INPUTS, drawnDebt: 16000 };
    useAaveV4LiveDataStore.setState(readyState({ engineInputs: freshFromChain }));

    await waitFor(() => {
      expect(usePortfolioStore.getState().portfolios[portfolio.id].portfolio.v4DebtState).toEqual(
        freshFromChain,
      );
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

/**
 * Manual/hypothetical mode — V4 Readiness Audit §12 Stage 25.
 */
describe('useAaveV4LiveSync — manual/hypothetical mode (Stage 25)', () => {
  it('a successful live fetch transitions a manual value to "live", even with coincidentally-equal numbers', async () => {
    const portfolio = createV4Portfolio();
    usePortfolioStore.getState().setAaveV4DebtState(portfolio.id, VALID_ENGINE_INPUTS, 'manual');
    renderHook(() => useAaveV4LiveSync(portfolio.id));

    useAaveV4LiveDataStore.setState(readyState({ engineInputs: VALID_ENGINE_INPUTS }));

    await waitFor(() => {
      expect(
        usePortfolioStore.getState().portfolios[portfolio.id].portfolio.v4DebtStateSource,
      ).toBe('live');
    });
    expect(usePortfolioStore.getState().portfolios[portfolio.id].portfolio.v4DebtState).toEqual(
      VALID_ENGINE_INPUTS,
    );
  });

  it('a failed live fetch preserves the manual value and its "manual" source untouched', async () => {
    const portfolio = createV4Portfolio();
    usePortfolioStore.getState().setAaveV4DebtState(portfolio.id, VALID_ENGINE_INPUTS, 'manual');
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

    const after = usePortfolioStore.getState().portfolios[portfolio.id].portfolio;
    expect(after.v4DebtState).toEqual(VALID_ENGINE_INPUTS);
    expect(after.v4DebtStateSource).toBe('manual');
  });

  it('a manual v4DebtState has no dependency on a wallet address — set with no v4Position at all, still usable', () => {
    const portfolio = createPortfolio();
    usePortfolioStore.getState().setProtocolVersion(portfolio.id, 'v4');
    usePortfolioStore.getState().setAaveV4DebtState(portfolio.id, VALID_ENGINE_INPUTS, 'manual');
    renderHook(() => useAaveV4LiveSync(portfolio.id));

    expect(useAaveV4LiveDataStore.getState().fetchAaveV4LiveData).not.toHaveBeenCalled();
    const after = usePortfolioStore.getState().portfolios[portfolio.id].portfolio;
    expect(after.v4DebtState).toEqual(VALID_ENGINE_INPUTS);
    expect(after.v4DebtStateSource).toBe('manual');
  });
});

/**
 * "Clears on identity removal" — mirrors
 * `tests/unit/hooks/useAaveV4CollateralRiskLiveSync.test.ts`'s own suite
 * of the same name for the identical fix applied here. Without this, a
 * stale `'live'`-sourced `v4DebtState` would keep feeding
 * `services/portfolio/mapping.ts`'s total-debt derivation (and therefore
 * Health Factor/liquidation/borrow-capacity) even after the wallet
 * address it was read from was removed.
 */
describe('useAaveV4LiveSync — clears a stale v4DebtState when the V4 identity is removed', () => {
  it('clears v4DebtState when v4Position is removed while still protocolVersion "v4"', async () => {
    const portfolio = createV4Portfolio();
    usePortfolioStore.getState().setAaveV4DebtState(portfolio.id, VALID_ENGINE_INPUTS);
    renderHook(() => useAaveV4LiveSync(portfolio.id));

    usePortfolioStore.getState().setAaveV4Position(portfolio.id, undefined);

    await waitFor(() => {
      expect(
        usePortfolioStore.getState().portfolios[portfolio.id].portfolio.v4DebtState,
      ).toBeUndefined();
    });
    expect(
      usePortfolioStore.getState().portfolios[portfolio.id].portfolio.v4DebtStateSource,
    ).toBeUndefined();
  });

  it('clears v4DebtState when the portfolio switches from V4 back to V3', async () => {
    const portfolio = createV4Portfolio();
    usePortfolioStore.getState().setAaveV4DebtState(portfolio.id, VALID_ENGINE_INPUTS);
    renderHook(() => useAaveV4LiveSync(portfolio.id));

    usePortfolioStore.getState().setProtocolVersion(portfolio.id, 'v3');

    await waitFor(() => {
      expect(
        usePortfolioStore.getState().portfolios[portfolio.id].portfolio.v4DebtState,
      ).toBeUndefined();
    });
  });

  it('is a genuine no-op (no Store write) for a V3 portfolio that never had v4DebtState set', async () => {
    const portfolio = createPortfolio();
    const updatedAtBefore = portfolio.updatedAt;
    renderHook(() => useAaveV4LiveSync(portfolio.id));

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(usePortfolioStore.getState().portfolios[portfolio.id].portfolio.updatedAt).toBe(
      updatedAtBefore,
    );
  });

  it('does not clear v4DebtState while the identity is still present (only removal triggers the clear)', async () => {
    const portfolio = createV4Portfolio();
    usePortfolioStore.getState().setAaveV4DebtState(portfolio.id, VALID_ENGINE_INPUTS);
    renderHook(() => useAaveV4LiveSync(portfolio.id));

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(usePortfolioStore.getState().portfolios[portfolio.id].portfolio.v4DebtState).toEqual(
      VALID_ENGINE_INPUTS,
    );
  });

  it('never clears a MANUAL v4DebtState for a portfolio with no address at all', async () => {
    const portfolio = createPortfolio();
    usePortfolioStore.getState().setProtocolVersion(portfolio.id, 'v4');
    usePortfolioStore.getState().setAaveV4DebtState(portfolio.id, VALID_ENGINE_INPUTS, 'manual');
    renderHook(() => useAaveV4LiveSync(portfolio.id));

    await new Promise((resolve) => setTimeout(resolve, 10));

    const after = usePortfolioStore.getState().portfolios[portfolio.id].portfolio;
    expect(after.v4DebtState).toEqual(VALID_ENGINE_INPUTS);
    expect(after.v4DebtStateSource).toBe('manual');
  });

  it('never clears a MANUAL v4DebtState when the v4Position address is removed (manual has no address dependency)', async () => {
    const portfolio = createV4Portfolio();
    usePortfolioStore.getState().setAaveV4DebtState(portfolio.id, VALID_ENGINE_INPUTS, 'manual');
    renderHook(() => useAaveV4LiveSync(portfolio.id));

    usePortfolioStore.getState().setAaveV4Position(portfolio.id, undefined);

    await new Promise((resolve) => setTimeout(resolve, 10));

    const after = usePortfolioStore.getState().portfolios[portfolio.id].portfolio;
    expect(after.v4DebtState).toEqual(VALID_ENGINE_INPUTS);
    expect(after.v4DebtStateSource).toBe('manual');
  });

  it("clearing one portfolio's stale live v4DebtState never touches another portfolio's v4DebtState", async () => {
    const first = createV4Portfolio(VALID_ADDRESS);
    const second = createV4Portfolio(OTHER_ADDRESS);
    usePortfolioStore.getState().setAaveV4DebtState(first.id, VALID_ENGINE_INPUTS);
    const secondInputs = { ...VALID_ENGINE_INPUTS, drawnDebt: 9999 };
    usePortfolioStore.getState().setAaveV4DebtState(second.id, secondInputs);

    const { rerender } = renderHook(({ id }) => useAaveV4LiveSync(id), {
      initialProps: { id: first.id },
    });

    // Remove the first portfolio's identity while the hook is mounted on
    // it — must clear only the first portfolio's v4DebtState.
    usePortfolioStore.getState().setAaveV4Position(first.id, undefined);
    await waitFor(() => {
      expect(
        usePortfolioStore.getState().portfolios[first.id].portfolio.v4DebtState,
      ).toBeUndefined();
    });
    expect(usePortfolioStore.getState().portfolios[second.id].portfolio.v4DebtState).toEqual(
      secondInputs,
    );

    // Switching the mounted hook to the second portfolio must not clear
    // it either — it still has a valid, present identity.
    rerender({ id: second.id });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(usePortfolioStore.getState().portfolios[second.id].portfolio.v4DebtState).toEqual(
      secondInputs,
    );
  });
});

/**
 * P0-1 — manual/live conflict confirmation (V4 Readiness Audit §12).
 * Deliberately distinct fixture values throughout (never a value reused
 * from elsewhere in this file with coincidentally-matching numbers), so
 * an accidental equality could never make an "these differ" assertion
 * pass by chance.
 */
const MANUAL_DEBT_STATE = {
  drawnDebt: 40000,
  premiumDebt: 1200,
  baseDrawnApr: 0.09,
  riskPremium: 0.04,
};
const DIFFERING_LIVE_ENGINE_INPUTS = {
  drawnDebt: 22222,
  premiumDebt: 777,
  baseDrawnApr: 0.061,
  riskPremium: 0.017,
};

describe('useAaveV4LiveSync — P0-1: a differing MANUAL value is never auto-overwritten, becomes a pending candidate', () => {
  it('canonical v4DebtState/source stay manual and unchanged; the fetched value is registered as a candidate instead', async () => {
    const portfolio = createV4Portfolio();
    usePortfolioStore.getState().setAaveV4DebtState(portfolio.id, MANUAL_DEBT_STATE, 'manual');
    renderHook(() => useAaveV4LiveSync(portfolio.id));

    useAaveV4LiveDataStore.setState(readyState({ engineInputs: DIFFERING_LIVE_ENGINE_INPUTS }));

    await waitFor(() => {
      expect(usePortfolioStore.getState().v4DebtStateCandidates[portfolio.id]).toEqual(
        DIFFERING_LIVE_ENGINE_INPUTS,
      );
    });
    const after = usePortfolioStore.getState().portfolios[portfolio.id].portfolio;
    expect(after.v4DebtState).toEqual(MANUAL_DEBT_STATE);
    expect(after.v4DebtStateSource).toBe('manual');
  });
});

describe('useAaveV4LiveSync — P0-1: identical manual value auto-adopts silently, no candidate', () => {
  it('numerically identical manual and fetched values transition to live directly, never creating a candidate', async () => {
    const portfolio = createV4Portfolio();
    usePortfolioStore.getState().setAaveV4DebtState(portfolio.id, VALID_ENGINE_INPUTS, 'manual');
    renderHook(() => useAaveV4LiveSync(portfolio.id));

    useAaveV4LiveDataStore.setState(readyState({ engineInputs: VALID_ENGINE_INPUTS }));

    await waitFor(() => {
      expect(
        usePortfolioStore.getState().portfolios[portfolio.id].portfolio.v4DebtStateSource,
      ).toBe('live');
    });
    expect(usePortfolioStore.getState().v4DebtStateCandidates[portfolio.id]).toBeUndefined();
  });

  /**
   * V4 Readiness Audit §12 P1-D3 — proves `aaveV4DebtStateEqual`'s own
   * deliberate exclusion of `debtAssetPriceUsd` (see its doc comment in
   * `stores/portfolioStore.ts`): a REALISTIC manual entry (no price field
   * at all — `MANUAL_DEBT_STATE` below, unlike `VALID_ENGINE_INPUTS`
   * above, never sets one) whose quantity/rates exactly match a live
   * fetch that DOES carry a real oracle price must still auto-adopt
   * silently. If price were included in this comparison, the mere
   * presence of `debtAssetPriceUsd` on the live side (impossible to match
   * on the manual side by construction) would manufacture a spurious
   * conflict for every manual entry that is otherwise numerically
   * identical to live data.
   */
  it('a realistic price-less manual entry matching a PRICED live fetch on every other field still auto-adopts, never a spurious price-presence conflict', async () => {
    const portfolio = createV4Portfolio();
    usePortfolioStore.getState().setAaveV4DebtState(portfolio.id, MANUAL_DEBT_STATE, 'manual');
    renderHook(() => useAaveV4LiveSync(portfolio.id));

    const pricedMatch = { ...MANUAL_DEBT_STATE, debtAssetPriceUsd: 0.9973 };
    useAaveV4LiveDataStore.setState(readyState({ engineInputs: pricedMatch }));

    await waitFor(() => {
      expect(
        usePortfolioStore.getState().portfolios[portfolio.id].portfolio.v4DebtStateSource,
      ).toBe('live');
    });
    const after = usePortfolioStore.getState().portfolios[portfolio.id].portfolio;
    expect(after.v4DebtState).toEqual(pricedMatch);
    expect(usePortfolioStore.getState().v4DebtStateCandidates[portfolio.id]).toBeUndefined();
  });
});

describe('useAaveV4LiveSync — P0-1: live→live refresh remains fully automatic (unchanged freshness model)', () => {
  it('a changed refresh of an already-live value auto-applies with no candidate', async () => {
    const portfolio = createV4Portfolio();
    usePortfolioStore.getState().setAaveV4DebtState(portfolio.id, VALID_ENGINE_INPUTS, 'live');
    renderHook(() => useAaveV4LiveSync(portfolio.id));

    const freshFromChain = { ...VALID_ENGINE_INPUTS, drawnDebt: 99999 };
    useAaveV4LiveDataStore.setState(readyState({ engineInputs: freshFromChain }));

    await waitFor(() => {
      expect(usePortfolioStore.getState().portfolios[portfolio.id].portfolio.v4DebtState).toEqual(
        freshFromChain,
      );
    });
    expect(usePortfolioStore.getState().v4DebtStateCandidates[portfolio.id]).toBeUndefined();
  });

  /**
   * Price-only refresh — V4 Readiness Audit §12 P1-D3, a genuine defect
   * found while reviewing that stage. `aaveV4DebtStateEqual` (used to gate
   * this branch) deliberately never compares `debtAssetPriceUsd` (see its
   * own doc comment), so a refresh that changed ONLY the oracle price
   * previously looked identical to this equality gate and was silently
   * dropped — the stale price would persist indefinitely until quantity or
   * a rate also happened to change. The live→live branch now additionally
   * compares `debtAssetPriceUsd` itself, alongside (not instead of)
   * `aaveV4DebtStateEqual`.
   */
  it('a refresh that changes ONLY debtAssetPriceUsd (quantity/rates identical) still auto-applies, updating the mapped USD debt', async () => {
    const portfolio = createV4Portfolio();
    usePortfolioStore.getState().setAaveV4DebtState(portfolio.id, VALID_ENGINE_INPUTS, 'live');
    renderHook(() => useAaveV4LiveSync(portfolio.id));

    const repricedOnly = { ...VALID_ENGINE_INPUTS, debtAssetPriceUsd: 0.9973 };
    useAaveV4LiveDataStore.setState(readyState({ engineInputs: repricedOnly }));

    await waitFor(() => {
      expect(usePortfolioStore.getState().portfolios[portfolio.id].portfolio.v4DebtState).toEqual(
        repricedOnly,
      );
    });
    expect(
      usePortfolioStore.getState().portfolios[portfolio.id].portfolio.v4DebtState
        ?.debtAssetPriceUsd,
    ).toBe(0.9973);
    expect(usePortfolioStore.getState().v4DebtStateCandidates[portfolio.id]).toBeUndefined();
  });
});

describe('useAaveV4LiveSync — P0-1: a failed fetch never creates a candidate; manual state stays untouched', () => {
  it('an error status leaves the manual value and source alone, and creates no candidate', async () => {
    const portfolio = createV4Portfolio();
    usePortfolioStore.getState().setAaveV4DebtState(portfolio.id, MANUAL_DEBT_STATE, 'manual');
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

    const after = usePortfolioStore.getState().portfolios[portfolio.id].portfolio;
    expect(after.v4DebtState).toEqual(MANUAL_DEBT_STATE);
    expect(after.v4DebtStateSource).toBe('manual');
    expect(usePortfolioStore.getState().v4DebtStateCandidates[portfolio.id]).toBeUndefined();
  });
});

describe('useAaveV4LiveSync — P0-1: accepting/dismissing a pending candidate', () => {
  it('accepting writes the candidate as the new canonical live value and clears the candidate', async () => {
    const portfolio = createV4Portfolio();
    usePortfolioStore.getState().setAaveV4DebtState(portfolio.id, MANUAL_DEBT_STATE, 'manual');
    renderHook(() => useAaveV4LiveSync(portfolio.id));
    useAaveV4LiveDataStore.setState(readyState({ engineInputs: DIFFERING_LIVE_ENGINE_INPUTS }));
    await waitFor(() => {
      expect(usePortfolioStore.getState().v4DebtStateCandidates[portfolio.id]).toEqual(
        DIFFERING_LIVE_ENGINE_INPUTS,
      );
    });

    const result = usePortfolioStore.getState().acceptAaveV4DebtStateCandidate(portfolio.id);
    expect(result.ok).toBe(true);

    const after = usePortfolioStore.getState().portfolios[portfolio.id].portfolio;
    expect(after.v4DebtState).toEqual(DIFFERING_LIVE_ENGINE_INPUTS);
    expect(after.v4DebtStateSource).toBe('live');
    expect(usePortfolioStore.getState().v4DebtStateCandidates[portfolio.id]).toBeUndefined();
  });

  it('accepting with no pending candidate returns a validation error and touches nothing', () => {
    const portfolio = createV4Portfolio();
    usePortfolioStore.getState().setAaveV4DebtState(portfolio.id, MANUAL_DEBT_STATE, 'manual');

    const result = usePortfolioStore.getState().acceptAaveV4DebtStateCandidate(portfolio.id);
    expect(result.ok).toBe(false);

    const after = usePortfolioStore.getState().portfolios[portfolio.id].portfolio;
    expect(after.v4DebtState).toEqual(MANUAL_DEBT_STATE);
    expect(after.v4DebtStateSource).toBe('manual');
  });

  it('"Keep Manual" (dismiss) clears the candidate and leaves canonical manual state completely untouched', async () => {
    const portfolio = createV4Portfolio();
    usePortfolioStore.getState().setAaveV4DebtState(portfolio.id, MANUAL_DEBT_STATE, 'manual');
    renderHook(() => useAaveV4LiveSync(portfolio.id));
    useAaveV4LiveDataStore.setState(readyState({ engineInputs: DIFFERING_LIVE_ENGINE_INPUTS }));
    await waitFor(() => {
      expect(usePortfolioStore.getState().v4DebtStateCandidates[portfolio.id]).toEqual(
        DIFFERING_LIVE_ENGINE_INPUTS,
      );
    });

    usePortfolioStore.getState().dismissAaveV4DebtStateCandidate(portfolio.id);

    expect(usePortfolioStore.getState().v4DebtStateCandidates[portfolio.id]).toBeUndefined();
    const after = usePortfolioStore.getState().portfolios[portfolio.id].portfolio;
    expect(after.v4DebtState).toEqual(MANUAL_DEBT_STATE);
    expect(after.v4DebtStateSource).toBe('manual');
  });

  it('a dismissed candidate does not instantly reappear from an unrelated portfolio update without a genuinely new fetch', async () => {
    const portfolio = createV4Portfolio();
    usePortfolioStore.getState().setAaveV4DebtState(portfolio.id, MANUAL_DEBT_STATE, 'manual');
    renderHook(() => useAaveV4LiveSync(portfolio.id));
    useAaveV4LiveDataStore.setState(readyState({ engineInputs: DIFFERING_LIVE_ENGINE_INPUTS }));
    await waitFor(() => {
      expect(usePortfolioStore.getState().v4DebtStateCandidates[portfolio.id]).toEqual(
        DIFFERING_LIVE_ENGINE_INPUTS,
      );
    });
    usePortfolioStore.getState().dismissAaveV4DebtStateCandidate(portfolio.id);

    // An unrelated portfolio update (e.g. renaming) re-triggers the write
    // effect's dependency array — the SAME `engineInputs` object is still
    // sitting in the live-data store (no new fetch happened).
    usePortfolioStore.getState().update(portfolio.id, { name: 'Renamed' });
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(usePortfolioStore.getState().v4DebtStateCandidates[portfolio.id]).toBeUndefined();
  });

  it('a genuinely new fetch after a dismissal can surface a new conflict', async () => {
    const portfolio = createV4Portfolio();
    usePortfolioStore.getState().setAaveV4DebtState(portfolio.id, MANUAL_DEBT_STATE, 'manual');
    renderHook(() => useAaveV4LiveSync(portfolio.id));
    useAaveV4LiveDataStore.setState(readyState({ engineInputs: DIFFERING_LIVE_ENGINE_INPUTS }));
    await waitFor(() => {
      expect(usePortfolioStore.getState().v4DebtStateCandidates[portfolio.id]).toEqual(
        DIFFERING_LIVE_ENGINE_INPUTS,
      );
    });
    usePortfolioStore.getState().dismissAaveV4DebtStateCandidate(portfolio.id);

    // A genuinely NEW fetch result (a fresh object) lands.
    const anotherDifferingFetch = { ...DIFFERING_LIVE_ENGINE_INPUTS, drawnDebt: 31313 };
    useAaveV4LiveDataStore.setState(readyState({ engineInputs: anotherDifferingFetch }));

    await waitFor(() => {
      expect(usePortfolioStore.getState().v4DebtStateCandidates[portfolio.id]).toEqual(
        anotherDifferingFetch,
      );
    });
    // Canonical is still untouched — still manual.
    expect(usePortfolioStore.getState().portfolios[portfolio.id].portfolio.v4DebtStateSource).toBe(
      'manual',
    );
  });
});

describe('useAaveV4LiveSync — P0-1: cross-portfolio candidate isolation', () => {
  it('a candidate created for one portfolio is never visible to, or actionable from, another portfolio', async () => {
    const first = createV4Portfolio(VALID_ADDRESS);
    const second = createV4Portfolio(OTHER_ADDRESS);
    usePortfolioStore.getState().setAaveV4DebtState(first.id, MANUAL_DEBT_STATE, 'manual');
    const secondManual = { ...MANUAL_DEBT_STATE, drawnDebt: 55555 };
    usePortfolioStore.getState().setAaveV4DebtState(second.id, secondManual, 'manual');

    const { rerender } = renderHook(({ id }) => useAaveV4LiveSync(id), {
      initialProps: { id: first.id },
    });
    useAaveV4LiveDataStore.setState(readyState({ engineInputs: DIFFERING_LIVE_ENGINE_INPUTS }));
    await waitFor(() => {
      expect(usePortfolioStore.getState().v4DebtStateCandidates[first.id]).toEqual(
        DIFFERING_LIVE_ENGINE_INPUTS,
      );
    });
    // The second portfolio never had a fetch land against it — no candidate.
    expect(usePortfolioStore.getState().v4DebtStateCandidates[second.id]).toBeUndefined();

    // Accepting the SECOND portfolio's (nonexistent) candidate must fail,
    // never pulling in the first portfolio's pending value.
    const result = usePortfolioStore.getState().acceptAaveV4DebtStateCandidate(second.id);
    expect(result.ok).toBe(false);
    expect(usePortfolioStore.getState().portfolios[second.id].portfolio.v4DebtState).toEqual(
      secondManual,
    );

    // Switching the mounted hook to the second portfolio and back must
    // not leak or destroy either portfolio's own candidate bookkeeping.
    rerender({ id: second.id });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(usePortfolioStore.getState().v4DebtStateCandidates[first.id]).toEqual(
      DIFFERING_LIVE_ENGINE_INPUTS,
    );
  });
});

describe('useAaveV4LiveSync — P0-1: identity removal invalidates the pending candidate', () => {
  it('removing v4Position while a candidate is pending clears the candidate (canonical manual value untouched)', async () => {
    const portfolio = createV4Portfolio();
    usePortfolioStore.getState().setAaveV4DebtState(portfolio.id, MANUAL_DEBT_STATE, 'manual');
    renderHook(() => useAaveV4LiveSync(portfolio.id));
    useAaveV4LiveDataStore.setState(readyState({ engineInputs: DIFFERING_LIVE_ENGINE_INPUTS }));
    await waitFor(() => {
      expect(usePortfolioStore.getState().v4DebtStateCandidates[portfolio.id]).toEqual(
        DIFFERING_LIVE_ENGINE_INPUTS,
      );
    });

    usePortfolioStore.getState().setAaveV4Position(portfolio.id, undefined);

    await waitFor(() => {
      expect(usePortfolioStore.getState().v4DebtStateCandidates[portfolio.id]).toBeUndefined();
    });
    const after = usePortfolioStore.getState().portfolios[portfolio.id].portfolio;
    expect(after.v4DebtState).toEqual(MANUAL_DEBT_STATE);
    expect(after.v4DebtStateSource).toBe('manual');
  });
});

describe('useAaveV4LiveSync — P0-1: V3 remains unaffected', () => {
  it('a V3 portfolio never populates a candidate even if the V4 live store happens to hold ready data', async () => {
    const portfolio = createPortfolio();
    renderHook(() => useAaveV4LiveSync(portfolio.id));

    useAaveV4LiveDataStore.setState(readyState());
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(usePortfolioStore.getState().v4DebtStateCandidates[portfolio.id]).toBeUndefined();
  });
});

/**
 * P0-4 — classified live-fetch error surfacing (V4 Readiness Audit §12).
 * `errorState()` mirrors `readyState()`'s own shape, adding
 * `attemptedUserAddress`/`attemptedDebtAsset` (defaulted to match
 * `VALID_ADDRESS`/`'USDC'`, the identity `createV4Portfolio()` sets up)
 * since the real `fetchAaveV4LiveData` sets those at the START of every
 * attempt — a detail these direct-`setState` tests must reproduce
 * themselves, exactly like `readyState()` already reproduces the
 * post-success shape.
 */
function errorState(overrides: Record<string, unknown> = {}) {
  return {
    status: 'error' as const,
    engineInputs: null,
    userAddress: null,
    debtAsset: null,
    errorMessage: 'The Aave V4 data request timed out. Please try again.',
    errorCode: 'AAVE_V4_RPC_TIMEOUT',
    attemptedUserAddress: VALID_ADDRESS,
    attemptedDebtAsset: 'USDC',
    fetchAaveV4LiveData: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('useAaveV4LiveSync — P0-4: a classified failure for the CURRENT identity is recorded', () => {
  it('records the exact code/message when the attempted identity matches the current portfolio', async () => {
    const portfolio = createV4Portfolio();
    renderHook(() => useAaveV4LiveSync(portfolio.id));

    useAaveV4LiveDataStore.setState(errorState());

    await waitFor(() => {
      expect(usePortfolioStore.getState().v4DebtStateErrors[portfolio.id]).toEqual({
        code: 'AAVE_V4_RPC_TIMEOUT',
        message: 'The Aave V4 data request timed out. Please try again.',
      });
    });
  });

  it('a network-catch failure with no classified code still records with code: null', async () => {
    const portfolio = createV4Portfolio();
    renderHook(() => useAaveV4LiveSync(portfolio.id));

    useAaveV4LiveDataStore.setState(
      errorState({
        errorMessage: 'Live Aave V4 data is temporarily unavailable.',
        errorCode: null,
      }),
    );

    await waitFor(() => {
      expect(usePortfolioStore.getState().v4DebtStateErrors[portfolio.id]).toEqual({
        code: null,
        message: 'Live Aave V4 data is temporarily unavailable.',
      });
    });
  });

  it('does NOT record an error whose attempted identity does not match this portfolio (a stale/foreign failure)', async () => {
    const portfolio = createV4Portfolio();
    renderHook(() => useAaveV4LiveSync(portfolio.id));

    useAaveV4LiveDataStore.setState(errorState({ attemptedUserAddress: OTHER_ADDRESS }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(usePortfolioStore.getState().v4DebtStateErrors[portfolio.id]).toBeUndefined();
  });

  it('does NOT record an error whose attempted debt asset does not match this portfolio', async () => {
    const portfolio = createV4Portfolio();
    renderHook(() => useAaveV4LiveSync(portfolio.id));

    useAaveV4LiveDataStore.setState(errorState({ attemptedDebtAsset: 'USDT' }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(usePortfolioStore.getState().v4DebtStateErrors[portfolio.id]).toBeUndefined();
  });
});

describe('useAaveV4LiveSync — P0-4: manual canonical state remains usable while a live error is visible', () => {
  it('the manual v4DebtState/source are completely unaffected by an error being recorded', async () => {
    const portfolio = createV4Portfolio();
    usePortfolioStore.getState().setAaveV4DebtState(portfolio.id, MANUAL_DEBT_STATE, 'manual');
    renderHook(() => useAaveV4LiveSync(portfolio.id));

    useAaveV4LiveDataStore.setState(errorState());

    await waitFor(() => {
      expect(usePortfolioStore.getState().v4DebtStateErrors[portfolio.id]).toBeDefined();
    });
    const after = usePortfolioStore.getState().portfolios[portfolio.id].portfolio;
    expect(after.v4DebtState).toEqual(MANUAL_DEBT_STATE);
    expect(after.v4DebtStateSource).toBe('manual');
  });
});

describe('useAaveV4LiveSync — P0-4: a later successful fetch clears the previously displayed error', () => {
  it('clears the error once a genuinely new fetch succeeds (auto-adopt case)', async () => {
    const portfolio = createV4Portfolio();
    renderHook(() => useAaveV4LiveSync(portfolio.id));

    useAaveV4LiveDataStore.setState(errorState());
    await waitFor(() => {
      expect(usePortfolioStore.getState().v4DebtStateErrors[portfolio.id]).toBeDefined();
    });

    useAaveV4LiveDataStore.setState(readyState());
    await waitFor(() => {
      expect(usePortfolioStore.getState().portfolios[portfolio.id].portfolio.v4DebtState).toEqual(
        VALID_ENGINE_INPUTS,
      );
    });
    expect(usePortfolioStore.getState().v4DebtStateErrors[portfolio.id]).toBeUndefined();
  });

  it('clears the error even when the success turns into a P0-1 candidate rather than an auto-apply', async () => {
    const portfolio = createV4Portfolio();
    usePortfolioStore.getState().setAaveV4DebtState(portfolio.id, MANUAL_DEBT_STATE, 'manual');
    renderHook(() => useAaveV4LiveSync(portfolio.id));

    useAaveV4LiveDataStore.setState(errorState());
    await waitFor(() => {
      expect(usePortfolioStore.getState().v4DebtStateErrors[portfolio.id]).toBeDefined();
    });

    useAaveV4LiveDataStore.setState(readyState({ engineInputs: DIFFERING_LIVE_ENGINE_INPUTS }));
    await waitFor(() => {
      expect(usePortfolioStore.getState().v4DebtStateCandidates[portfolio.id]).toEqual(
        DIFFERING_LIVE_ENGINE_INPUTS,
      );
    });
    expect(usePortfolioStore.getState().v4DebtStateErrors[portfolio.id]).toBeUndefined();
  });
});

describe('useAaveV4LiveSync — P0-4: a P0-1 pending candidate survives a later fetch error', () => {
  it('a later failed fetch does not clear or alter an already-pending candidate', async () => {
    const portfolio = createV4Portfolio();
    usePortfolioStore.getState().setAaveV4DebtState(portfolio.id, MANUAL_DEBT_STATE, 'manual');
    renderHook(() => useAaveV4LiveSync(portfolio.id));

    useAaveV4LiveDataStore.setState(readyState({ engineInputs: DIFFERING_LIVE_ENGINE_INPUTS }));
    await waitFor(() => {
      expect(usePortfolioStore.getState().v4DebtStateCandidates[portfolio.id]).toEqual(
        DIFFERING_LIVE_ENGINE_INPUTS,
      );
    });

    useAaveV4LiveDataStore.setState(errorState());
    await waitFor(() => {
      expect(usePortfolioStore.getState().v4DebtStateErrors[portfolio.id]).toBeDefined();
    });

    // The candidate from the earlier successful-but-differing fetch must
    // still be exactly as it was — a later error neither clears nor
    // corrupts it.
    expect(usePortfolioStore.getState().v4DebtStateCandidates[portfolio.id]).toEqual(
      DIFFERING_LIVE_ENGINE_INPUTS,
    );
    const after = usePortfolioStore.getState().portfolios[portfolio.id].portfolio;
    expect(after.v4DebtState).toEqual(MANUAL_DEBT_STATE);
    expect(after.v4DebtStateSource).toBe('manual');
  });
});

describe('useAaveV4LiveSync — P0-4: identity removal invalidates a displayed error', () => {
  it('removing v4Position while an error is displayed clears it', async () => {
    const portfolio = createV4Portfolio();
    renderHook(() => useAaveV4LiveSync(portfolio.id));

    useAaveV4LiveDataStore.setState(errorState());
    await waitFor(() => {
      expect(usePortfolioStore.getState().v4DebtStateErrors[portfolio.id]).toBeDefined();
    });

    usePortfolioStore.getState().setAaveV4Position(portfolio.id, undefined);

    await waitFor(() => {
      expect(usePortfolioStore.getState().v4DebtStateErrors[portfolio.id]).toBeUndefined();
    });
  });

  it('removing the identity clears the error even when canonical state is manual (untouched by the candidate-clearing branch)', async () => {
    const portfolio = createV4Portfolio();
    usePortfolioStore.getState().setAaveV4DebtState(portfolio.id, MANUAL_DEBT_STATE, 'manual');
    renderHook(() => useAaveV4LiveSync(portfolio.id));

    useAaveV4LiveDataStore.setState(errorState());
    await waitFor(() => {
      expect(usePortfolioStore.getState().v4DebtStateErrors[portfolio.id]).toBeDefined();
    });

    usePortfolioStore.getState().setAaveV4Position(portfolio.id, undefined);

    await waitFor(() => {
      expect(usePortfolioStore.getState().v4DebtStateErrors[portfolio.id]).toBeUndefined();
    });
    const after = usePortfolioStore.getState().portfolios[portfolio.id].portfolio;
    expect(after.v4DebtState).toEqual(MANUAL_DEBT_STATE);
    expect(after.v4DebtStateSource).toBe('manual');
  });
});

describe('useAaveV4LiveSync — P0-4: cross-portfolio error isolation', () => {
  it("an error recorded for one portfolio is never visible under another portfolio's key, including across a hook remount/switch", async () => {
    const first = createV4Portfolio(VALID_ADDRESS);
    const second = createV4Portfolio(OTHER_ADDRESS);

    const { rerender } = renderHook(({ id }) => useAaveV4LiveSync(id), {
      initialProps: { id: first.id },
    });

    useAaveV4LiveDataStore.setState(errorState());
    await waitFor(() => {
      expect(usePortfolioStore.getState().v4DebtStateErrors[first.id]).toBeDefined();
    });
    expect(usePortfolioStore.getState().v4DebtStateErrors[second.id]).toBeUndefined();

    // Switching the mounted hook to the second portfolio must not import
    // the first portfolio's error, nor clear it.
    rerender({ id: second.id });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(usePortfolioStore.getState().v4DebtStateErrors[second.id]).toBeUndefined();
    expect(usePortfolioStore.getState().v4DebtStateErrors[first.id]).toEqual({
      code: 'AAVE_V4_RPC_TIMEOUT',
      message: 'The Aave V4 data request timed out. Please try again.',
    });
  });
});

describe('useAaveV4LiveSync — P0-4: V3 remains unaffected', () => {
  it('a V3 portfolio never populates an error even if the V4 live store happens to hold error data', async () => {
    const portfolio = createPortfolio();
    renderHook(() => useAaveV4LiveSync(portfolio.id));

    useAaveV4LiveDataStore.setState(errorState());
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(usePortfolioStore.getState().v4DebtStateErrors[portfolio.id]).toBeUndefined();
  });
});

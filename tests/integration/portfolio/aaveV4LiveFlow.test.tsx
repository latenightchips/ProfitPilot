import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import PortfolioPage from '@/app/portfolio/page';
import { useAaveLiveDataStore } from '@/stores/aaveLiveDataStore';
import { useAaveV4LiveDataStore } from '@/stores/aaveV4LiveDataStore';
import { usePortfolioStore } from '@/stores/portfolioStore';

/**
 * Aave V4 Live Flow — Integration Test (V4 Readiness Audit §12 Stage 14).
 *
 * **What this proves, and what it does not.** Every V4 layer already has
 * its own deterministic, fixture-driven unit test in isolation:
 * `infrastructure/protocols/aave/v4/index.test.ts` fakes the on-chain RPC
 * client; `app/api/aave/v4-position/route.test.ts` mocks the adapter
 * module; `stores/aaveV4LiveDataStore.test.ts` mocks `fetch`;
 * `tests/unit/app/portfolio/page.test.tsx` (Stage 13) stubs
 * `fetchAaveV4LiveData` itself and drives the store's state directly.
 * None of those chain together — Stage 13's own UI tests never once call
 * the real `fetchAaveV4LiveData`. This file closes that gap: it mocks
 * ONLY `global.fetch` (the same boundary `aaveV4LiveDataStore.test.ts`
 * already mocks) with a deterministic, clearly-synthetic response, and
 * lets every layer above it — `useAaveV4LiveSync`, the real
 * `fetchAaveV4LiveData`, `PortfolioPageClient`, `AaveProtocolVersionForm`,
 * `DebtPositionForm` — run for real. It proves ProfitPilot's OWN wiring
 * is correct end-to-end.
 *
 * **This does not validate the real Aave V4 contracts, the real Hub/Spoke
 * on-chain graph, or real RPC behavior** — that is exactly what
 * `infrastructure/protocols/aave/v4/index.test.ts`'s own fixture-RPC-client
 * tests already do, one layer down, and what this repo has no way to do
 * without a real funded V4 position on mainnet. The address used below
 * (`V4_ADDRESS`) is the same placeholder Stage 13's own test suite
 * already established as this project's synthetic test-only fixture
 * address — it is not, and must never be treated as, a real wallet.
 *
 * **This file itself makes no production safeguard weaker.** The
 * production behaviors it exercises (real `fetch` call shape, real
 * `useAaveV4LiveSync` gating on `protocolVersion==='v4' && v4Position`,
 * real "never overwrite good state on failure") were already fully
 * implemented — this file is read-only proof they hold when driven
 * through the full component tree. A production deployment still
 * requires a real on-chain address and a real `/api/aave/v4-position`
 * response before any `v4DebtState` is ever written — nothing here
 * relaxes that.
 *
 * **One accompanying production fix.** Writing the repayment-preview
 * scenario below caught a real bug (not a test-authoring mistake) in
 * `hooks/useAaveV4LiveSync.ts`: its write effect depends on the whole
 * `portfolio` object, so it used to re-run — and needlessly re-apply a
 * stale, already-consumed fetch result — after ANY portfolio update,
 * including a Debt-form Apply that locally derives a newer `v4DebtState`
 * from a real Stage-12 repayment. See that file's own header comment for
 * the fix (tracking which specific `engineInputs` value has already been
 * applied); `tests/unit/hooks/useAaveV4LiveSync.test.ts` carries the
 * corresponding focused regression coverage.
 */
const INITIAL_PORTFOLIO_STATE = {
  portfolios: {},
  activePortfolioId: null,
  loadStatus: 'idle' as const,
  saveStatus: 'idle' as const,
  errors: [],
  lastSynchronizedAt: null,
};

const IDLE_AAVE_V4_STATE = {
  status: 'idle' as const,
  engineInputs: null,
  userAddress: null,
  debtAsset: null,
  errorMessage: null,
};

const IDLE_AAVE_V3_STATE = {
  status: 'idle' as const,
  marketQuote: null,
  protocolQuote: null,
  collateralSymbol: null,
  borrowSymbol: null,
  source: null,
  errorMessage: null,
};

const originalFetch = global.fetch;

/** Same synthetic placeholder address Stage 13's own test suite uses — never a real wallet. */
const V4_ADDRESS = '0x1234567890123456789012345678901234567890';

/** Deterministic fixture — the only "V4 debt state" this file ever produces, always via a mocked `fetch` response. */
const V4_FIXTURE_DEBT_STATE = {
  drawnDebt: 15000,
  premiumDebt: 5000,
  baseDrawnApr: 0.05,
  riskPremium: 0.01,
};

function v4SuccessBody(debtState: typeof V4_FIXTURE_DEBT_STATE = V4_FIXTURE_DEBT_STATE) {
  return { ok: true, data: { raw: {}, engineInputs: debtState, display: {} } };
}

function v4ErrorBody() {
  return {
    ok: false,
    errors: [
      {
        category: 'provider',
        code: 'AAVE_V4_RPC_NETWORK_ERROR',
        message: 'Could not reach the Ethereum RPC endpoint. Please try again.',
      },
    ],
  };
}

/**
 * Matches `validInput()`'s own `market`/`protocol` defaults exactly, so
 * `useAaveLiveSync`'s equality gate never calls `update()` — the same
 * "identical data causes no portfolio update" precedent
 * `tests/unit/app/portfolio/page.test.tsx` already documents, kept here
 * so this file's V3 fetch traffic never interferes with the V4
 * assertions under test.
 */
function v3SuccessBody() {
  return {
    ok: true,
    data: {
      priceCandidate: { origin: 'provider', price: 50000, timestamp: new Date().toISOString() },
      protocolCandidate: {
        origin: 'live',
        timestamp: new Date().toISOString(),
        parameters: {
          maxLoanToValue: 0.75,
          liquidationThreshold: 0.8,
          borrowApr: 0.05,
          supplyApr: 0.02,
        },
      },
      collateralSymbol: 'WBTC',
      borrowSymbol: 'USDC',
      source: {
        protocol: 'aave',
        version: 'v3',
        network: 'Ethereum Mainnet',
        method: 'rpc',
        blockNumber: '21000000',
      },
    },
  };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

interface FetchRouterOptions {
  v4: () => Response;
  v3?: () => Response;
}

/**
 * Routes `global.fetch` by URL — both `useAaveLiveSync` (V3, unconditional)
 * and `useAaveV4LiveSync` (V4, opt-in) are mounted together by
 * `PortfolioPageClient`, so any test that renders it must be able to
 * answer both same-origin routes, exactly like a real browser would.
 * Records every call so isolation ("V3 Refresh never calls the V4 route
 * and vice versa") can be asserted directly, not inferred.
 */
function installFetchRouter(options: FetchRouterOptions): { calls: string[] } {
  const calls: string[] = [];
  const v3 = options.v3 ?? (() => jsonResponse(v3SuccessBody()));
  global.fetch = vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    calls.push(url);
    if (url.includes('/api/aave/v4-position')) return Promise.resolve(options.v4());
    if (url.includes('/api/aave/reserve')) return Promise.resolve(v3());
    return Promise.reject(new Error(`aaveV4LiveFlow.test.tsx: unexpected fetch call to ${url}`));
  }) as unknown as typeof fetch;
  return { calls };
}

beforeEach(() => {
  usePortfolioStore.setState(INITIAL_PORTFOLIO_STATE);
  useAaveLiveDataStore.setState(IDLE_AAVE_V3_STATE);
  useAaveV4LiveDataStore.setState(IDLE_AAVE_V4_STATE);
  window.localStorage.clear();
});

afterEach(() => {
  global.fetch = originalFetch;
});

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    name: 'My Portfolio',
    baseCurrency: 'USD',
    collateral: { asset: 'BTC', quantity: 2 },
    debt: { asset: 'USDC', balance: 20000 },
    market: { btcPriceUsd: 50000 },
    protocol: { maxLoanToValue: 0.75, liquidationThreshold: 0.8, borrowApr: 0.05, supplyApr: 0.02 },
    settings: {},
    ...overrides,
  };
}

function createAndSelect(overrides: Record<string, unknown> = {}) {
  const result = usePortfolioStore.getState().create(validInput(overrides));
  if (!result.ok) throw new Error('setup failed');
  usePortfolioStore.getState().select(result.data.id);
  return result.data;
}

/** Real UI walkthrough: select V4, enter and save the address — the exact steps a user takes. */
async function selectV4AndSaveAddress(
  user: ReturnType<typeof userEvent.setup>,
  address: string = V4_ADDRESS,
): Promise<void> {
  const section = within(screen.getByRole('group', { name: 'Aave protocol version' }));
  await user.click(section.getByRole('radio', { name: 'Aave V4' }));
  await user.type(section.getByLabelText('On-chain address', { exact: false }), address);
  await user.click(section.getByRole('button', { name: 'Save address' }));
}

describe('Aave V4 live flow — successful sync through the real component/store/hook chain', () => {
  it('a real UI address entry drives the real fetch, lands the exact fixture v4DebtState, and flips the badge to Live', async () => {
    const created = createAndSelect();
    const { calls } = installFetchRouter({ v4: () => jsonResponse(v4SuccessBody()) });
    const user = userEvent.setup();
    render(<PortfolioPage />);

    await selectV4AndSaveAddress(user);

    const debtSection = within(screen.getByRole('group', { name: 'Debt' }).closest('form')!);
    await debtSection.findByText('Aave V4 · Live');

    expect(usePortfolioStore.getState().portfolios[created.id].portfolio.v4DebtState).toEqual(
      V4_FIXTURE_DEBT_STATE,
    );
    expect(calls.some((url) => url.includes('/api/aave/v4-position'))).toBe(true);
    const v4Call = calls.find((url) => url.includes('/api/aave/v4-position'))!;
    expect(v4Call).toContain(`userAddress=${V4_ADDRESS}`);
    expect(v4Call).toContain('debtAsset=USDC');
  });

  /**
   * **V4 Readiness Audit §12 Stage 14 fix, regression coverage.** This
   * test originally caught a real production bug: `useAaveV4LiveSync`'s
   * write effect re-ran after the Apply below (since it depends on the
   * whole `portfolio` object), saw the store's still-stale `engineInputs`
   * (nothing re-fetched) no longer matched the freshly-repaid
   * `v4DebtState`, and silently overwrote the correct repay result back
   * to the pre-repay fixture. It never surfaced in Stage 13's own unit
   * tests because those stub the fetch with `engineInputs: null`, which
   * always short-circuited that code path — only a real landed fetch
   * followed by a later local edit (exactly this test) exercises it.
   * `hooks/useAaveV4LiveSync.ts` now tracks which specific `engineInputs`
   * object it has already applied and only acts on a genuinely new one,
   * so a later local edit is never clobbered by a re-run over stale data.
   */
  it('the synced v4DebtState feeds a real Stage-12 partial-repayment preview/apply (premium-first allocation)', async () => {
    const created = createAndSelect({ debt: { asset: 'USDC', balance: 20000 } });
    installFetchRouter({ v4: () => jsonResponse(v4SuccessBody()) });
    const user = userEvent.setup();
    render(<PortfolioPage />);

    await selectV4AndSaveAddress(user);
    const debtSection = within(screen.getByRole('group', { name: 'Debt' }).closest('form')!);
    await debtSection.findByText('Aave V4 · Live');
    expect(usePortfolioStore.getState().portfolios[created.id].portfolio.v4DebtState).toEqual(
      V4_FIXTURE_DEBT_STATE,
    );
    // Stage 23C: the calculation now also requires `v4CollateralRisk` to be
    // synced (mirroring the pre-existing `v4DebtState` guard). This flow has
    // no UI-driven collateral-risk fetch yet, so it's set directly here —
    // same fixture convention as this file's own `protocol.liquidationThreshold: 0.8`.
    usePortfolioStore
      .getState()
      .setAaveV4CollateralRisk(created.id, { collateralFactor: 0.8, dynamicConfigKey: 1 });

    // Repay $5,000 — exactly clears the fixture's $5,000 premiumDebt first (premium-first allocation, Stage 12).
    await user.clear(debtSection.getByLabelText('Debt amount', { exact: false }));
    await user.type(debtSection.getByLabelText('Debt amount', { exact: false }), '15000');
    await user.click(debtSection.getByRole('button', { name: 'Preview Changes' }));
    expect(
      screen.queryByText(/Borrowing preview and apply are not available yet/),
    ).not.toBeInTheDocument();
    await user.click(debtSection.getByRole('button', { name: 'Apply Changes' }));

    const after = usePortfolioStore.getState().portfolios[created.id].portfolio;
    expect(after.debt.balance).toBe(15000);
    expect(after.v4DebtState).toEqual({
      drawnDebt: 15000,
      premiumDebt: 0,
      baseDrawnApr: 0.05,
      riskPremium: 0.01,
    });
  });
});

describe('Aave V4 live flow — provider failure preserves last-known-good state', () => {
  it('a failed real fetch on a portfolio with previously-synced state shows Provider error and never blanks v4DebtState', async () => {
    const created = createAndSelect();
    usePortfolioStore.getState().setProtocolVersion(created.id, 'v4');
    usePortfolioStore.getState().setAaveV4Position(created.id, { userAddress: V4_ADDRESS });
    usePortfolioStore.getState().setAaveV4DebtState(created.id, V4_FIXTURE_DEBT_STATE);

    installFetchRouter({ v4: () => jsonResponse(v4ErrorBody()) });
    render(<PortfolioPage />);

    const debtSection = within(screen.getByRole('group', { name: 'Debt' }).closest('form')!);
    await debtSection.findByText('Aave V4 · Provider error (showing last known value)');

    expect(usePortfolioStore.getState().portfolios[created.id].portfolio.v4DebtState).toEqual(
      V4_FIXTURE_DEBT_STATE,
    );
  });

  it('a rejected fetch (network failure) behaves identically — last-known-good state is preserved', async () => {
    const created = createAndSelect();
    usePortfolioStore.getState().setProtocolVersion(created.id, 'v4');
    usePortfolioStore.getState().setAaveV4Position(created.id, { userAddress: V4_ADDRESS });
    usePortfolioStore.getState().setAaveV4DebtState(created.id, V4_FIXTURE_DEBT_STATE);

    const calls: string[] = [];
    global.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      calls.push(url);
      if (url.includes('/api/aave/v4-position')) return Promise.reject(new Error('network down'));
      if (url.includes('/api/aave/reserve')) return Promise.resolve(jsonResponse(v3SuccessBody()));
      return Promise.reject(new Error(`unexpected fetch call to ${url}`));
    }) as unknown as typeof fetch;

    render(<PortfolioPage />);

    const debtSection = within(screen.getByRole('group', { name: 'Debt' }).closest('form')!);
    await debtSection.findByText('Aave V4 · Provider error (showing last known value)');
    expect(usePortfolioStore.getState().portfolios[created.id].portfolio.v4DebtState).toEqual(
      V4_FIXTURE_DEBT_STATE,
    );
  });
});

describe('Aave V4 live flow — the production safeguard is not weakened by this test infrastructure', () => {
  it('makes zero V4 fetch calls for a V3 (protocolVersion unset) portfolio', async () => {
    createAndSelect();
    const { calls } = installFetchRouter({ v4: () => jsonResponse(v4SuccessBody()) });
    render(<PortfolioPage />);

    // Give the V3 effect (which does fire) a turn to resolve, proving the
    // absence of a V4 call isn't just "nothing has run yet."
    const debtSection = within(screen.getByRole('group', { name: 'Debt' }).closest('form')!);
    await debtSection.findByText('Aave V3 · Live');

    expect(calls.some((url) => url.includes('/api/aave/v4-position'))).toBe(false);
  });

  it('makes zero V4 fetch calls once V4 is selected but no address has been saved yet', async () => {
    createAndSelect();
    const { calls } = installFetchRouter({ v4: () => jsonResponse(v4SuccessBody()) });
    const user = userEvent.setup();
    render(<PortfolioPage />);

    const section = within(screen.getByRole('group', { name: 'Aave protocol version' }));
    await user.click(section.getByRole('radio', { name: 'Aave V4' }));

    const debtSection = within(screen.getByRole('group', { name: 'Debt' }).closest('form')!);
    await debtSection.findByText('Aave V4 · Waiting for address');
    expect(calls.some((url) => url.includes('/api/aave/v4-position'))).toBe(false);
  });
});

describe('Aave V4 live flow — V3 behavior is unaffected', () => {
  it('a V3 portfolio syncs real live market/protocol data through its own route only, never the V4 route', async () => {
    const created = createAndSelect({
      market: { btcPriceUsd: 1 },
      protocol: { maxLoanToValue: 0.1, liquidationThreshold: 0.2, borrowApr: 0.9, supplyApr: 0.9 },
    });
    const { calls } = installFetchRouter({ v4: () => jsonResponse(v4SuccessBody()) });
    render(<PortfolioPage />);

    const debtSection = within(screen.getByRole('group', { name: 'Debt' }).closest('form')!);
    await debtSection.findByText('Aave V3 · Live');

    const after = usePortfolioStore.getState().portfolios[created.id].portfolio;
    expect(after.market).toEqual({ btcPriceUsd: 50000 });
    expect(after.protocol).toEqual({
      maxLoanToValue: 0.75,
      liquidationThreshold: 0.8,
      borrowApr: 0.05,
      supplyApr: 0.02,
    });
    expect(calls.some((url) => url.includes('/api/aave/reserve'))).toBe(true);
    expect(calls.some((url) => url.includes('/api/aave/v4-position'))).toBe(false);
  });
});

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NewPortfolioPageClient } from '@/app/portfolios/new/NewPortfolioPageClient';
import { useAaveLiveDataStore } from '@/stores/aaveLiveDataStore';
import { useAaveV4CollateralRiskLiveDataStore } from '@/stores/aaveV4CollateralRiskLiveDataStore';
import { useAaveV4LiveDataStore } from '@/stores/aaveV4LiveDataStore';
import { useAaveV4ReservePriceStore } from '@/stores/aaveV4ReservePriceStore';
import { usePortfolioStore } from '@/stores/portfolioStore';

/**
 * Protocol Selection at Portfolio Creation — V4 half of the new-portfolio
 * form's test coverage (the V3 half stays in
 * `NewPortfolioPageClient.liveBootstrap.test.tsx`, unmodified in behavior).
 * Same `setState`-driven store technique as that file — no real `fetch`.
 */
const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

const VALID_ADDRESS = '0x1234567890123456789012345678901234567890';

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

function idleV4DebtState() {
  return {
    status: 'idle' as const,
    engineInputs: null,
    userAddress: null,
    debtAsset: null,
    errorMessage: null,
    errorCode: null,
    attemptedUserAddress: null,
    attemptedDebtAsset: null,
    lastFetchedAt: null,
    fetchAaveV4LiveData: vi.fn().mockResolvedValue(undefined),
  };
}

function idleV4CollateralRiskState() {
  return {
    status: 'idle' as const,
    canonical: null,
    userAddress: null,
    errorMessage: null,
    errorCode: null,
    attemptedUserAddress: null,
    lastFetchedAt: null,
    fetchAaveV4CollateralRiskLiveData: vi.fn().mockResolvedValue(undefined),
  };
}

function readyV4DebtState(overrides: { debtAsset?: string } = {}) {
  return {
    status: 'ready' as const,
    engineInputs: {
      drawnDebt: 12000,
      premiumDebt: 300,
      baseDrawnApr: 0.04,
      riskPremium: 0.01,
      debtAssetPriceUsd: 1,
    },
    userAddress: VALID_ADDRESS as `0x${string}`,
    debtAsset: overrides.debtAsset ?? 'USDC',
    errorMessage: null,
    errorCode: null,
    attemptedUserAddress: VALID_ADDRESS as `0x${string}`,
    attemptedDebtAsset: overrides.debtAsset ?? 'USDC',
    lastFetchedAt: new Date().toISOString(),
    fetchAaveV4LiveData: vi.fn().mockResolvedValue(undefined),
  };
}

function readyV4CollateralRiskState() {
  return {
    status: 'ready' as const,
    // `collateralPriceUsd` deliberately DIFFERS from
    // `readyV4ReservePriceState()`'s own price below — the two stores
    // are proven independent sources by the fact that the form must show
    // the RESERVE-price value, never this one, for `market.btcPriceUsd`
    // (V4 wallet-independent price fix).
    canonical: { collateralFactor: 0.78, dynamicConfigKey: 3, collateralPriceUsd: 99999 },
    userAddress: VALID_ADDRESS as `0x${string}`,
    errorMessage: null,
    errorCode: null,
    attemptedUserAddress: VALID_ADDRESS as `0x${string}`,
    lastFetchedAt: new Date().toISOString(),
    fetchAaveV4CollateralRiskLiveData: vi.fn().mockResolvedValue(undefined),
  };
}

function idleV4ReservePriceState() {
  return {
    status: 'idle' as const,
    canonical: null,
    errorMessage: null,
    errorCode: null,
    lastFetchedAt: null,
    fetchAaveV4ReservePrice: vi.fn().mockResolvedValue(undefined),
  };
}

function readyV4ReservePriceState() {
  return {
    status: 'ready' as const,
    canonical: { collateralPriceUsd: 64000 },
    errorMessage: null,
    errorCode: null,
    lastFetchedAt: new Date().toISOString(),
    fetchAaveV4ReservePrice: vi.fn().mockResolvedValue(undefined),
  };
}

beforeEach(() => {
  usePortfolioStore.setState(INITIAL_PORTFOLIO_STATE);
  useAaveLiveDataStore.setState(IDLE_AAVE_STATE);
  useAaveV4LiveDataStore.setState(idleV4DebtState());
  useAaveV4CollateralRiskLiveDataStore.setState(idleV4CollateralRiskState());
  useAaveV4ReservePriceStore.setState(idleV4ReservePriceState());
  push.mockClear();
});

async function selectV4(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('radio', { name: 'Aave V4' }));
}

async function fillSharedFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Portfolio name', { exact: false }), 'My V4 Portfolio');
  await user.clear(screen.getByLabelText('BTC quantity', { exact: false }));
  await user.type(screen.getByLabelText('BTC quantity', { exact: false }), '2');
  await user.clear(screen.getByLabelText('Debt balance', { exact: false }));
  await user.type(screen.getByLabelText('Debt balance', { exact: false }), '12300');
}

async function fillManualV4Fields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Current BTC price (USD)', { exact: false }), '64000');
  await user.type(screen.getByLabelText('Drawn debt', { exact: false }), '12000');
  await user.type(screen.getByLabelText('Premium debt', { exact: false }), '300');
  await user.type(screen.getByLabelText('Base drawn APR (%)', { exact: false }), '4');
  await user.type(screen.getByLabelText('Risk premium (%)', { exact: false }), '1');
  await user.type(screen.getByLabelText('Collateral factor (%)', { exact: false }), '78');
}

describe('NewPortfolioPageClient — V4 selector switching', () => {
  it('selecting V4 hides the V3 protocol-parameters fieldset and shows the V4 fieldset', async () => {
    const user = userEvent.setup();
    render(<NewPortfolioPageClient />);
    expect(screen.getByLabelText('Maximum LTV (%)', { exact: false })).toBeInTheDocument();

    await selectV4(user);

    expect(screen.queryByLabelText('Maximum LTV (%)', { exact: false })).not.toBeInTheDocument();
    expect(screen.getByLabelText('On-chain address (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Drawn debt', { exact: false })).toBeInTheDocument();
  });

  it('switching back to V3 re-shows the protocol-parameters fieldset', async () => {
    const user = userEvent.setup();
    render(<NewPortfolioPageClient />);
    await selectV4(user);
    await user.click(screen.getByRole('radio', { name: 'Aave V3' }));

    expect(screen.getByLabelText('Maximum LTV (%)', { exact: false })).toBeInTheDocument();
    expect(screen.queryByLabelText('On-chain address (optional)')).not.toBeInTheDocument();
  });
});

describe('NewPortfolioPageClient — V4 live bootstrap: fetch triggering', () => {
  it('does not fetch until a full-shaped address is typed', async () => {
    const user = userEvent.setup();
    render(<NewPortfolioPageClient />);
    await selectV4(user);
    await user.type(screen.getByLabelText('On-chain address (optional)'), '0x123');

    expect(
      useAaveV4CollateralRiskLiveDataStore.getState().fetchAaveV4CollateralRiskLiveData,
    ).not.toHaveBeenCalled();
    expect(useAaveV4LiveDataStore.getState().fetchAaveV4LiveData).not.toHaveBeenCalled();
  });

  it('fetches both collateral-risk and debt-state once a valid-shaped address is typed', async () => {
    const user = userEvent.setup();
    render(<NewPortfolioPageClient />);
    await selectV4(user);
    await user.type(screen.getByLabelText('On-chain address (optional)'), VALID_ADDRESS);

    await waitFor(() => {
      expect(
        useAaveV4CollateralRiskLiveDataStore.getState().fetchAaveV4CollateralRiskLiveData,
      ).toHaveBeenCalledWith(VALID_ADDRESS);
      expect(useAaveV4LiveDataStore.getState().fetchAaveV4LiveData).toHaveBeenCalledWith(
        VALID_ADDRESS,
        'USDC',
      );
    });
  });

  it('a debt-asset change re-fetches only the debt-state half, not collateral-risk', async () => {
    const user = userEvent.setup();
    render(<NewPortfolioPageClient />);
    await selectV4(user);
    await user.type(screen.getByLabelText('On-chain address (optional)'), VALID_ADDRESS);
    await waitFor(() => {
      expect(useAaveV4LiveDataStore.getState().fetchAaveV4LiveData).toHaveBeenCalledWith(
        VALID_ADDRESS,
        'USDC',
      );
    });
    const collateralRiskFetchCallCount = (
      useAaveV4CollateralRiskLiveDataStore.getState()
        .fetchAaveV4CollateralRiskLiveData as ReturnType<typeof vi.fn>
    ).mock.calls.length;

    await user.selectOptions(screen.getByLabelText('Debt asset', { exact: false }), 'USDT');

    await waitFor(() => {
      expect(useAaveV4LiveDataStore.getState().fetchAaveV4LiveData).toHaveBeenCalledWith(
        VALID_ADDRESS,
        'USDT',
      );
    });
    expect(
      (
        useAaveV4CollateralRiskLiveDataStore.getState()
          .fetchAaveV4CollateralRiskLiveData as ReturnType<typeof vi.fn>
      ).mock.calls.length,
    ).toBe(collateralRiskFetchCallCount);
  });
});

describe('NewPortfolioPageClient — V4 live bootstrap: prefill + provenance', () => {
  it('prefills BTC price, debt-state fields, and collateral factor from a matching live snapshot, labeled live', async () => {
    useAaveV4CollateralRiskLiveDataStore.setState(readyV4CollateralRiskState());
    useAaveV4ReservePriceStore.setState(readyV4ReservePriceState());
    useAaveV4LiveDataStore.setState(readyV4DebtState());
    const user = userEvent.setup();
    render(<NewPortfolioPageClient />);
    await selectV4(user);
    await user.type(screen.getByLabelText('On-chain address (optional)'), VALID_ADDRESS);

    await waitFor(() => {
      expect(screen.getByLabelText('Current BTC price (USD)', { exact: false })).toHaveValue(64000);
    });
    expect(screen.getByLabelText('Drawn debt', { exact: false })).toHaveValue(12000);
    expect(screen.getByLabelText('Premium debt', { exact: false })).toHaveValue(300);
    expect(screen.getByLabelText('Base drawn APR (%)', { exact: false })).toHaveValue(4);
    expect(screen.getByLabelText('Risk premium (%)', { exact: false })).toHaveValue(1);
    expect(screen.getByLabelText('Collateral factor (%)', { exact: false })).toHaveValue(78);
    expect(screen.getAllByText(/live/i).length).toBeGreaterThan(0);
  });

  it('persists live provenance for market, v4DebtState, and v4CollateralRisk independently when nothing is edited', async () => {
    useAaveV4CollateralRiskLiveDataStore.setState(readyV4CollateralRiskState());
    useAaveV4ReservePriceStore.setState(readyV4ReservePriceState());
    useAaveV4LiveDataStore.setState(readyV4DebtState());
    const user = userEvent.setup();
    render(<NewPortfolioPageClient />);
    await selectV4(user);
    await fillSharedFields(user);
    await user.type(screen.getByLabelText('On-chain address (optional)'), VALID_ADDRESS);
    await waitFor(() => {
      expect(screen.getByLabelText('Drawn debt', { exact: false })).toHaveValue(12000);
    });
    await user.click(screen.getByRole('button', { name: 'Create Portfolio' }));

    const portfolios = Object.values(usePortfolioStore.getState().portfolios);
    expect(portfolios).toHaveLength(1);
    const portfolio = portfolios[0].portfolio;
    expect(portfolio.protocolVersion).toBe('v4');
    expect(portfolio.marketSource).toBe('live');
    expect(portfolio.market.btcPriceUsd).toBe(64000);
    expect(portfolio.v4Position).toEqual({ userAddress: VALID_ADDRESS });
    expect(portfolio.v4DebtStateSource).toBe('live');
    expect(portfolio.v4DebtState).toMatchObject({
      drawnDebt: 12000,
      premiumDebt: 300,
      baseDrawnApr: 0.04,
      riskPremium: 0.01,
      debtAssetPriceUsd: 1,
    });
    expect(portfolio.v4CollateralRiskSource).toBe('live');
    expect(portfolio.v4CollateralRisk).toEqual({ collateralFactor: 0.78, dynamicConfigKey: 3 });
  });

  it('editing only a debt-state field flips v4DebtStateSource to manual while v4CollateralRiskSource stays live', async () => {
    useAaveV4CollateralRiskLiveDataStore.setState(readyV4CollateralRiskState());
    useAaveV4ReservePriceStore.setState(readyV4ReservePriceState());
    useAaveV4LiveDataStore.setState(readyV4DebtState());
    const user = userEvent.setup();
    render(<NewPortfolioPageClient />);
    await selectV4(user);
    await fillSharedFields(user);
    await user.type(screen.getByLabelText('On-chain address (optional)'), VALID_ADDRESS);
    await waitFor(() => {
      expect(screen.getByLabelText('Drawn debt', { exact: false })).toHaveValue(12000);
    });

    await user.clear(screen.getByLabelText('Drawn debt', { exact: false }));
    await user.type(screen.getByLabelText('Drawn debt', { exact: false }), '13000');
    await user.click(screen.getByRole('button', { name: 'Create Portfolio' }));

    const portfolios = Object.values(usePortfolioStore.getState().portfolios);
    const portfolio = portfolios[0].portfolio;
    expect(portfolio.v4DebtStateSource).toBe('manual');
    expect(portfolio.v4DebtState?.drawnDebt).toBe(13000);
    expect(portfolio.v4DebtState?.debtAssetPriceUsd).toBeUndefined();
    expect(portfolio.v4CollateralRiskSource).toBe('live');
  });

  it('editing only the collateral factor flips v4CollateralRiskSource to manual while v4DebtStateSource stays live', async () => {
    useAaveV4CollateralRiskLiveDataStore.setState(readyV4CollateralRiskState());
    useAaveV4ReservePriceStore.setState(readyV4ReservePriceState());
    useAaveV4LiveDataStore.setState(readyV4DebtState());
    const user = userEvent.setup();
    render(<NewPortfolioPageClient />);
    await selectV4(user);
    await fillSharedFields(user);
    await user.type(screen.getByLabelText('On-chain address (optional)'), VALID_ADDRESS);
    await waitFor(() => {
      expect(screen.getByLabelText('Collateral factor (%)', { exact: false })).toHaveValue(78);
    });

    await user.clear(screen.getByLabelText('Collateral factor (%)', { exact: false }));
    await user.type(screen.getByLabelText('Collateral factor (%)', { exact: false }), '70');
    await user.click(screen.getByRole('button', { name: 'Create Portfolio' }));

    const portfolios = Object.values(usePortfolioStore.getState().portfolios);
    const portfolio = portfolios[0].portfolio;
    expect(portfolio.v4CollateralRiskSource).toBe('manual');
    expect(portfolio.v4CollateralRisk).toEqual({ collateralFactor: 0.7, dynamicConfigKey: 0 });
    expect(portfolio.v4DebtStateSource).toBe('live');
  });
});

describe('NewPortfolioPageClient — V4 manual creation (no wallet/RPC required)', () => {
  it('succeeds fully manually with no address ever entered, all sources manual', async () => {
    const user = userEvent.setup();
    render(<NewPortfolioPageClient />);
    await selectV4(user);
    await fillSharedFields(user);
    await fillManualV4Fields(user);
    await user.click(screen.getByRole('button', { name: 'Create Portfolio' }));

    const portfolios = Object.values(usePortfolioStore.getState().portfolios);
    expect(portfolios).toHaveLength(1);
    const portfolio = portfolios[0].portfolio;
    expect(portfolio.protocolVersion).toBe('v4');
    expect(portfolio.v4Position).toBeUndefined();
    expect(portfolio.marketSource).toBe('manual');
    expect(portfolio.v4DebtStateSource).toBe('manual');
    expect(portfolio.v4DebtState).toEqual({
      drawnDebt: 12000,
      premiumDebt: 300,
      baseDrawnApr: 0.04,
      riskPremium: 0.01,
    });
    expect(portfolio.v4CollateralRiskSource).toBe('manual');
    expect(portfolio.v4CollateralRisk).toEqual({ collateralFactor: 0.78, dynamicConfigKey: 0 });
    expect(push).toHaveBeenCalledWith('/portfolio');
    expect(useAaveV4LiveDataStore.getState().fetchAaveV4LiveData).not.toHaveBeenCalled();
    expect(
      useAaveV4CollateralRiskLiveDataStore.getState().fetchAaveV4CollateralRiskLiveData,
    ).not.toHaveBeenCalled();
  });

  it('the V4-only protocol.* placeholder is never shown and never carries a manually-typed V3 value', async () => {
    const user = userEvent.setup();
    render(<NewPortfolioPageClient />);
    await selectV4(user);
    await fillSharedFields(user);
    await fillManualV4Fields(user);
    await user.click(screen.getByRole('button', { name: 'Create Portfolio' }));

    const portfolios = Object.values(usePortfolioStore.getState().portfolios);
    const portfolio = portfolios[0].portfolio;
    expect(portfolio.protocol).toEqual({
      maxLoanToValue: 0,
      liquidationThreshold: 0,
      borrowApr: 0,
      supplyApr: 0,
    });
    expect(portfolio.protocolSource).toBe('manual');
  });
});

describe('NewPortfolioPageClient — V4 fail-closed preservation for untouched sections', () => {
  it('creation succeeds with the V4 fieldset left entirely alone — v4DebtState and v4CollateralRisk stay undefined (existing fail-closed Dashboard state, reached earlier, not a new one)', async () => {
    const user = userEvent.setup();
    render(<NewPortfolioPageClient />);
    await selectV4(user);
    await fillSharedFields(user);
    await user.type(screen.getByLabelText('Current BTC price (USD)', { exact: false }), '64000');
    await user.click(screen.getByRole('button', { name: 'Create Portfolio' }));

    const portfolios = Object.values(usePortfolioStore.getState().portfolios);
    expect(portfolios).toHaveLength(1);
    const portfolio = portfolios[0].portfolio;
    expect(portfolio.protocolVersion).toBe('v4');
    expect(portfolio.v4DebtState).toBeUndefined();
    expect(portfolio.v4DebtStateSource).toBeUndefined();
    expect(portfolio.v4CollateralRisk).toBeUndefined();
    expect(portfolio.v4CollateralRiskSource).toBeUndefined();
    expect(push).toHaveBeenCalledWith('/portfolio');
  });

  it('only the debt-state section touched — v4DebtState is set, v4CollateralRisk stays undefined independently', async () => {
    const user = userEvent.setup();
    render(<NewPortfolioPageClient />);
    await selectV4(user);
    await fillSharedFields(user);
    await user.type(screen.getByLabelText('Current BTC price (USD)', { exact: false }), '64000');
    await user.type(screen.getByLabelText('Drawn debt', { exact: false }), '12000');
    await user.type(screen.getByLabelText('Premium debt', { exact: false }), '300');
    await user.type(screen.getByLabelText('Base drawn APR (%)', { exact: false }), '4');
    await user.type(screen.getByLabelText('Risk premium (%)', { exact: false }), '1');
    await user.click(screen.getByRole('button', { name: 'Create Portfolio' }));

    const portfolios = Object.values(usePortfolioStore.getState().portfolios);
    const portfolio = portfolios[0].portfolio;
    expect(portfolio.v4DebtState).toBeDefined();
    expect(portfolio.v4DebtStateSource).toBe('manual');
    expect(portfolio.v4CollateralRisk).toBeUndefined();
    expect(portfolio.v4CollateralRiskSource).toBeUndefined();
  });
});

describe('NewPortfolioPageClient — V4 partial live failure, independent fallback', () => {
  it('collateral-risk live, debt-state error — debt-state falls back to manual entry independently', async () => {
    useAaveV4CollateralRiskLiveDataStore.setState(readyV4CollateralRiskState());
    useAaveV4ReservePriceStore.setState(readyV4ReservePriceState());
    useAaveV4LiveDataStore.setState({
      ...idleV4DebtState(),
      status: 'error' as const,
      errorMessage: 'Live Aave V4 data is temporarily unavailable.',
    });
    const user = userEvent.setup();
    render(<NewPortfolioPageClient />);
    await selectV4(user);
    await fillSharedFields(user);
    await user.type(screen.getByLabelText('On-chain address (optional)'), VALID_ADDRESS);

    await waitFor(() => {
      expect(screen.getByLabelText('Collateral factor (%)', { exact: false })).toHaveValue(78);
    });
    expect(screen.getByLabelText('Drawn debt', { exact: false })).toHaveValue(0);
    expect(screen.getAllByText(/live aave v4 debt data is unavailable/i).length).toBeGreaterThan(0);

    await user.type(screen.getByLabelText('Drawn debt', { exact: false }), '9000');
    await user.type(screen.getByLabelText('Premium debt', { exact: false }), '200');
    await user.type(screen.getByLabelText('Base drawn APR (%)', { exact: false }), '3');
    await user.type(screen.getByLabelText('Risk premium (%)', { exact: false }), '1');
    await user.click(screen.getByRole('button', { name: 'Create Portfolio' }));

    const portfolios = Object.values(usePortfolioStore.getState().portfolios);
    const portfolio = portfolios[0].portfolio;
    expect(portfolio.v4DebtStateSource).toBe('manual');
    expect(portfolio.v4CollateralRiskSource).toBe('live');
  });
});

describe('NewPortfolioPageClient — V3<->V4 toggle does not leak stale values', () => {
  it('a V3-prefilled BTC price does not silently carry over as V4 "live" after switching', async () => {
    useAaveLiveDataStore.setState({
      status: 'ready' as const,
      marketQuote: {
        asset: 'BTC',
        currency: 'USD',
        freshness: 'fresh' as const,
        price: 50000,
        origin: 'provider' as const,
        timestamp: new Date().toISOString(),
      },
      protocolQuote: { available: false as const, collateralAsset: 'BTC', borrowAsset: 'USDC' },
      collateralSymbol: 'BTC',
      borrowSymbol: 'USDC',
      source: null,
      errorMessage: null,
      fetchLiveAaveData: vi.fn().mockResolvedValue(undefined),
    });
    const user = userEvent.setup();
    render(<NewPortfolioPageClient />);
    await waitFor(() => {
      expect(screen.getByLabelText('Current BTC price (USD)', { exact: false })).toHaveValue(50000);
    });

    await selectV4(user);

    // Switching to V4 resets the shared BTC-price field rather than
    // silently keeping the V3-sourced number under a new, unearned V4
    // "live" label.
    expect(screen.getByLabelText('Current BTC price (USD)', { exact: false })).toHaveValue(0);
    await fillSharedFields(user);
    await fillManualV4Fields(user);
    await user.click(screen.getByRole('button', { name: 'Create Portfolio' }));

    const portfolios = Object.values(usePortfolioStore.getState().portfolios);
    const portfolio = portfolios[0].portfolio;
    expect(portfolio.market.btcPriceUsd).toBe(64000);
    expect(portfolio.marketSource).toBe('manual');
  });

  it('an invalid pre-validated V4 entry blocks submission and never calls create()', async () => {
    const user = userEvent.setup();
    render(<NewPortfolioPageClient />);
    await selectV4(user);
    await fillSharedFields(user);
    // Deliberately malformed address shape passed straight through to
    // `aaveV4PositionIdentitySchema` — too short to have a valid EIP-55
    // shape, so `prepareSubmission()` must reject it before `create()`
    // is ever called.
    await user.type(screen.getByLabelText('On-chain address (optional)'), '0xnotanaddress');
    await user.click(screen.getByRole('button', { name: 'Create Portfolio' }));

    expect(Object.keys(usePortfolioStore.getState().portfolios)).toHaveLength(0);
    expect(push).not.toHaveBeenCalled();
  });
});

describe('NewPortfolioPageClient — V4 wallet-independent price fix', () => {
  it('1. V4 selected, no wallet address entered — a live BTC price still loads', async () => {
    useAaveV4ReservePriceStore.setState(readyV4ReservePriceState());
    const user = userEvent.setup();
    render(<NewPortfolioPageClient />);
    await selectV4(user);

    await waitFor(() => {
      expect(screen.getByLabelText('Current BTC price (USD)', { exact: false })).toHaveValue(64000);
    });
    expect(screen.getAllByText(/aave v4 · live collateral price/i).length).toBeGreaterThan(0);
    // The fetch fired unconditionally — never gated on an address.
    expect(useAaveV4ReservePriceStore.getState().fetchAaveV4ReservePrice).toHaveBeenCalled();
    // Wallet-dependent fetches were never triggered, since no address was entered.
    expect(useAaveV4LiveDataStore.getState().fetchAaveV4LiveData).not.toHaveBeenCalled();
    expect(
      useAaveV4CollateralRiskLiveDataStore.getState().fetchAaveV4CollateralRiskLiveData,
    ).not.toHaveBeenCalled();
  });

  it('2. V4 selected with a wallet address — the wallet-independent price and wallet-dependent debt/collateral-risk data all load together', async () => {
    useAaveV4ReservePriceStore.setState(readyV4ReservePriceState());
    useAaveV4CollateralRiskLiveDataStore.setState(readyV4CollateralRiskState());
    useAaveV4LiveDataStore.setState(readyV4DebtState());
    const user = userEvent.setup();
    render(<NewPortfolioPageClient />);
    await selectV4(user);
    await user.type(screen.getByLabelText('On-chain address (optional)'), VALID_ADDRESS);

    await waitFor(() => {
      expect(screen.getByLabelText('Current BTC price (USD)', { exact: false })).toHaveValue(64000);
    });
    expect(screen.getByLabelText('Drawn debt', { exact: false })).toHaveValue(12000);
    expect(screen.getByLabelText('Collateral factor (%)', { exact: false })).toHaveValue(78);
  });

  it('3. V4 price unavailable (error) — BTC price stays at the manual default, remains editable, and submission still succeeds', async () => {
    useAaveV4ReservePriceStore.setState({
      status: 'error' as const,
      canonical: null,
      errorMessage: 'Live Aave V4 price data is temporarily unavailable.',
      errorCode: 'AAVE_V4_RPC_TIMEOUT',
      lastFetchedAt: null,
      fetchAaveV4ReservePrice: vi.fn().mockResolvedValue(undefined),
    });
    const user = userEvent.setup();
    render(<NewPortfolioPageClient />);
    await selectV4(user);

    const priceField = screen.getByLabelText('Current BTC price (USD)', { exact: false });
    expect(priceField).toHaveValue(0);
    expect(screen.getAllByText(/live aave v4 price data is unavailable/i).length).toBeGreaterThan(
      0,
    );

    await fillSharedFields(user);
    await user.type(priceField, '61000');
    await user.type(screen.getByLabelText('Drawn debt', { exact: false }), '12000');
    await user.type(screen.getByLabelText('Premium debt', { exact: false }), '300');
    await user.type(screen.getByLabelText('Base drawn APR (%)', { exact: false }), '4');
    await user.type(screen.getByLabelText('Risk premium (%)', { exact: false }), '1');
    await user.type(screen.getByLabelText('Collateral factor (%)', { exact: false }), '78');
    await user.click(screen.getByRole('button', { name: 'Create Portfolio' }));

    const portfolios = Object.values(usePortfolioStore.getState().portfolios);
    expect(portfolios).toHaveLength(1);
    const portfolio = portfolios[0].portfolio;
    expect(portfolio.market.btcPriceUsd).toBe(61000);
    expect(portfolio.marketSource).toBe('manual');
    expect(push).toHaveBeenCalledWith('/portfolio');
  });

  it('4. switching V3 -> V4 shows V4’s OWN oracle price, never V3’s, and V4 -> V3 restores V3’s own price', async () => {
    useAaveLiveDataStore.setState({
      status: 'ready' as const,
      marketQuote: {
        asset: 'BTC',
        currency: 'USD',
        freshness: 'fresh' as const,
        price: 50000,
        origin: 'provider' as const,
        timestamp: new Date().toISOString(),
      },
      protocolQuote: { available: false as const, collateralAsset: 'BTC', borrowAsset: 'USDC' },
      collateralSymbol: 'BTC',
      borrowSymbol: 'USDC',
      source: null,
      errorMessage: null,
      fetchLiveAaveData: vi.fn().mockResolvedValue(undefined),
    });
    useAaveV4ReservePriceStore.setState(readyV4ReservePriceState());
    const user = userEvent.setup();
    render(<NewPortfolioPageClient />);
    await waitFor(() => {
      expect(screen.getByLabelText('Current BTC price (USD)', { exact: false })).toHaveValue(50000);
    });

    await selectV4(user);
    await waitFor(() => {
      expect(screen.getByLabelText('Current BTC price (USD)', { exact: false })).toHaveValue(64000);
    });

    await user.click(screen.getByRole('radio', { name: 'Aave V3' }));
    await waitFor(() => {
      expect(screen.getByLabelText('Current BTC price (USD)', { exact: false })).toHaveValue(50000);
    });
  });
});

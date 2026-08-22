import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import PortfolioPage from '@/app/portfolio/page';
import { useAaveLiveDataStore } from '@/stores/aaveLiveDataStore';
import { useAaveV4CollateralRiskLiveDataStore } from '@/stores/aaveV4CollateralRiskLiveDataStore';
import { useAaveV4LiveDataStore } from '@/stores/aaveV4LiveDataStore';
import { usePortfolioStore } from '@/stores/portfolioStore';

/**
 * V4 live-fetch error notice — Integration Test (V4 Readiness Audit §12
 * P0-4). Mirrors `tests/integration/portfolio/aaveV4LiveFlow.test.tsx`'s
 * own technique (mock only `global.fetch` with representative EXISTING
 * adapter error classifications — never a fake UI-only code — and let
 * every real layer above it run): proves the real
 * `fetchAaveV4LiveData`/`fetchAaveV4CollateralRiskLiveData` → the two
 * live-sync hooks → `usePortfolioStore`'s error maps →
 * `AaveV4LiveErrorNotice` chain works end-to-end through the real
 * Portfolio page, not just via direct `setState` driving as the unit
 * hook/component suites already do.
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

const IDLE_AAVE_V4_COLLATERAL_RISK_STATE = {
  status: 'idle' as const,
  canonical: null,
  userAddress: null,
  errorMessage: null,
  lastFetchedAt: null,
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

const V4_ADDRESS = '0x1234567890123456789012345678901234567890';
const V4_FIXTURE_DEBT_STATE = {
  drawnDebt: 15000,
  premiumDebt: 5000,
  baseDrawnApr: 0.05,
  riskPremium: 0.01,
};
const V4_COLLATERAL_RISK_FIXTURE = { collateralFactor: 0.8, dynamicConfigKey: 1 };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function v4SuccessBody() {
  return { ok: true, data: { raw: {}, engineInputs: V4_FIXTURE_DEBT_STATE, display: {} } };
}

function v4CollateralRiskSuccessBody() {
  return { ok: true, data: { raw: {}, canonical: V4_COLLATERAL_RISK_FIXTURE, display: {} } };
}

/** A representative EXISTING adapter classification — `infrastructure/protocols/aave/v4/client.ts`'s own `classifyError` for a timeout. */
function v4TimeoutErrorBody() {
  return {
    ok: false,
    errors: [
      {
        category: 'provider',
        code: 'AAVE_V4_RPC_TIMEOUT',
        message: 'The Aave V4 data request timed out. Please try again.',
      },
    ],
  };
}

/** A representative EXISTING adapter classification for a network error. */
function v4NetworkErrorBody() {
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

interface FetchRouterOptions {
  v4: () => Response;
  v4CollateralRisk?: () => Response;
}

function installFetchRouter(options: FetchRouterOptions) {
  const v4CollateralRisk =
    options.v4CollateralRisk ?? (() => jsonResponse(v4CollateralRiskSuccessBody()));
  global.fetch = vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes('/api/aave/v4-collateral-risk')) return Promise.resolve(v4CollateralRisk());
    if (url.includes('/api/aave/v4-position')) return Promise.resolve(options.v4());
    if (url.includes('/api/aave/reserve')) return Promise.resolve(jsonResponse(v3SuccessBody()));
    return Promise.reject(new Error(`aaveV4LiveErrorNotice.test.tsx: unexpected fetch to ${url}`));
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  usePortfolioStore.setState(INITIAL_PORTFOLIO_STATE);
  useAaveLiveDataStore.setState(IDLE_AAVE_V3_STATE);
  useAaveV4LiveDataStore.setState(IDLE_AAVE_V4_STATE);
  useAaveV4CollateralRiskLiveDataStore.setState(IDLE_AAVE_V4_COLLATERAL_RISK_STATE);
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

async function selectV4AndSaveAddress(
  user: ReturnType<typeof userEvent.setup>,
  address: string = V4_ADDRESS,
): Promise<void> {
  const section = within(screen.getByRole('group', { name: 'Aave protocol version' }));
  await user.click(section.getByRole('radio', { name: 'Aave V4' }));
  await user.type(section.getByLabelText('On-chain address', { exact: false }), address);
  await user.click(section.getByRole('button', { name: 'Save address' }));
}

describe('P0-4 — classified live-fetch error, through the real fetch/hook/component chain', () => {
  it('a real debt-position timeout renders the exact classified message and code', async () => {
    createAndSelect();
    installFetchRouter({ v4: () => jsonResponse(v4TimeoutErrorBody(), 503) });
    const user = userEvent.setup();
    render(<PortfolioPage />);

    await selectV4AndSaveAddress(user);

    await screen.findByText('Debt State: live sync failed');
    expect(
      screen.getByText('The Aave V4 data request timed out. Please try again.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Error code: AAVE_V4_RPC_TIMEOUT')).toBeInTheDocument();
    expect(screen.queryByText('Collateral Risk: live sync failed')).not.toBeInTheDocument();
  });

  it('debt succeeds but collateral-risk fails — only the Collateral Risk notice renders', async () => {
    const created = createAndSelect();
    installFetchRouter({
      v4: () => jsonResponse(v4SuccessBody()),
      v4CollateralRisk: () => jsonResponse(v4NetworkErrorBody(), 503),
    });
    const user = userEvent.setup();
    render(<PortfolioPage />);

    await selectV4AndSaveAddress(user);

    await screen.findByText('Collateral Risk: live sync failed');
    expect(
      screen.getByText('Could not reach the Ethereum RPC endpoint. Please try again.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Debt State: live sync failed')).not.toBeInTheDocument();
    // The debt side genuinely succeeded — real proof, not an inference.
    expect(usePortfolioStore.getState().portfolios[created.id].portfolio.v4DebtState).toEqual(
      V4_FIXTURE_DEBT_STATE,
    );
  });

  it('collateral-risk succeeds but debt fails — only the Debt State notice renders', async () => {
    createAndSelect();
    installFetchRouter({
      v4: () => jsonResponse(v4TimeoutErrorBody(), 503),
      v4CollateralRisk: () => jsonResponse(v4CollateralRiskSuccessBody()),
    });
    const user = userEvent.setup();
    render(<PortfolioPage />);

    await selectV4AndSaveAddress(user);

    await screen.findByText('Debt State: live sync failed');
    expect(screen.queryByText('Collateral Risk: live sync failed')).not.toBeInTheDocument();
  });

  it('both dimensions failing simultaneously renders both notices, neither hidden', async () => {
    createAndSelect();
    installFetchRouter({
      v4: () => jsonResponse(v4TimeoutErrorBody(), 503),
      v4CollateralRisk: () => jsonResponse(v4NetworkErrorBody(), 503),
    });
    const user = userEvent.setup();
    render(<PortfolioPage />);

    await selectV4AndSaveAddress(user);

    await screen.findByText('Debt State: live sync failed');
    await screen.findByText('Collateral Risk: live sync failed');
  });

  it('a V3 portfolio never renders any V4 error notice, even if the V4 stores happen to hold error data', async () => {
    createAndSelect();
    useAaveV4LiveDataStore.setState({
      status: 'error',
      errorMessage: 'The Aave V4 data request timed out. Please try again.',
      errorCode: 'AAVE_V4_RPC_TIMEOUT',
      attemptedUserAddress: V4_ADDRESS as `0x${string}`,
      attemptedDebtAsset: 'USDC',
    });
    installFetchRouter({ v4: () => jsonResponse(v4SuccessBody()) });
    render(<PortfolioPage />);

    const debtSection = within(screen.getByRole('group', { name: 'Debt' }).closest('form')!);
    await debtSection.findByText('Aave V3 · Live');

    expect(screen.queryByText('Debt State: live sync failed')).not.toBeInTheDocument();
  });
});

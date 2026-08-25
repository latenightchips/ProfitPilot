import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import PortfolioPage from '@/app/portfolio/page';
import { useAaveLiveDataStore } from '@/stores/aaveLiveDataStore';
import { useAaveV4CollateralRiskLiveDataStore } from '@/stores/aaveV4CollateralRiskLiveDataStore';
import { useAaveV4LiveDataStore } from '@/stores/aaveV4LiveDataStore';
import { usePortfolioStore } from '@/stores/portfolioStore';

/**
 * Manual/live conflict confirmation — Integration Test (V4 Readiness
 * Audit §12 P0-1). Mirrors `tests/integration/portfolio/aaveV4LiveFlow.test.tsx`'s
 * own technique (mock only `global.fetch`, let every real layer above it
 * — `useAaveV4LiveSync`/`useAaveV4CollateralRiskLiveSync`,
 * `PortfolioPageClient`, `AaveProtocolVersionForm`,
 * `AaveV4ConflictConfirmation`, `ManualAaveV4StateForm` — run for real)
 * for the three scenarios that specifically require the full component
 * tree, not just the hook in isolation: independent debt/collateral-risk
 * conflicts through the real UI, the mid-edit race against a dirty
 * `ManualAaveV4StateForm`, and the remount/manual-override regression
 * (`hooks/useAaveV4LiveSync.ts`'s own P0-1 header comment covers the
 * store-level mechanics; this file proves they compose correctly with
 * real React effects/mounts).
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

/** Same synthetic placeholder address the rest of this project's V4 test suites use — never a real wallet. */
const V4_ADDRESS = '0x1234567890123456789012345678901234567890';

const MANUAL_DEBT_STATE = {
  drawnDebt: 40000,
  premiumDebt: 1200,
  baseDrawnApr: 0.09,
  riskPremium: 0.04,
};
const DIFFERING_LIVE_DEBT_STATE = {
  drawnDebt: 22222,
  premiumDebt: 777,
  baseDrawnApr: 0.061,
  riskPremium: 0.017,
  debtAssetPriceUsd: 1.0,
};
const MANUAL_COLLATERAL_RISK = { collateralFactor: 0.55, dynamicConfigKey: 9 };
const DIFFERING_LIVE_COLLATERAL_RISK = { collateralFactor: 0.71, dynamicConfigKey: 3 };

function v4PositionBody(debtState: typeof DIFFERING_LIVE_DEBT_STATE) {
  return {
    ok: true,
    data: { raw: {}, engineInputs: debtState, display: {}, debtAssetPriceUsd: 1.0 },
  };
}

function v4CollateralRiskBody(canonical: typeof DIFFERING_LIVE_COLLATERAL_RISK) {
  return { ok: true, data: { raw: {}, canonical, display: {} } };
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

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

/**
 * Reads its debt/collateral-risk fixtures from mutable holders (not
 * fixed at install time) so a single test can change what the NEXT
 * fetch returns — e.g. the remount/manual-override regression below,
 * which needs a second, differing fetch after the first has already
 * landed.
 */
function installFetchRouter(
  getDebtState: () => typeof DIFFERING_LIVE_DEBT_STATE,
  getCollateralRisk: () => typeof DIFFERING_LIVE_COLLATERAL_RISK,
) {
  global.fetch = vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes('/api/aave/v4-collateral-risk')) {
      return Promise.resolve(jsonResponse(v4CollateralRiskBody(getCollateralRisk())));
    }
    if (url.includes('/api/aave/v4-position')) {
      return Promise.resolve(jsonResponse(v4PositionBody(getDebtState())));
    }
    if (url.includes('/api/aave/reserve')) return Promise.resolve(jsonResponse(v3SuccessBody()));
    return Promise.reject(
      new Error(`aaveV4ManualLiveConflict.test.tsx: unexpected fetch call to ${url}`),
    );
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

describe('P0-1 — manual/live conflict, through the real component tree', () => {
  it('a differing live debt fetch shows the conflict panel; "Use Live Data" commits it as canonical live', async () => {
    const created = createAndSelect();
    usePortfolioStore.getState().setProtocolVersion(created.id, 'v4');
    usePortfolioStore.getState().setAaveV4DebtState(created.id, MANUAL_DEBT_STATE, 'manual');
    installFetchRouter(
      () => DIFFERING_LIVE_DEBT_STATE,
      () => DIFFERING_LIVE_COLLATERAL_RISK,
    );
    const user = userEvent.setup();
    render(<PortfolioPage />);

    await selectV4AndSaveAddress(user);

    await screen.findByText(/Debt State: live Aave data differs from your manual assumption/);
    // Canonical stays manual while the panel is pending.
    expect(usePortfolioStore.getState().portfolios[created.id].portfolio.v4DebtState).toEqual(
      MANUAL_DEBT_STATE,
    );

    const panel = screen.getByText(/Debt State: live Aave data differs/).closest('div')!;
    await user.click(within(panel).getByRole('button', { name: 'Use Live Data' }));

    const after = usePortfolioStore.getState().portfolios[created.id].portfolio;
    expect(after.v4DebtState).toEqual(DIFFERING_LIVE_DEBT_STATE);
    expect(after.v4DebtStateSource).toBe('live');
    expect(
      screen.queryByText(/Debt State: live Aave data differs from your manual assumption/),
    ).not.toBeInTheDocument();
  });

  it('"Keep Manual" dismisses the panel and leaves the canonical manual value untouched', async () => {
    const created = createAndSelect();
    usePortfolioStore.getState().setProtocolVersion(created.id, 'v4');
    usePortfolioStore
      .getState()
      .setAaveV4CollateralRisk(created.id, MANUAL_COLLATERAL_RISK, 'manual');
    installFetchRouter(
      () => DIFFERING_LIVE_DEBT_STATE,
      () => DIFFERING_LIVE_COLLATERAL_RISK,
    );
    const user = userEvent.setup();
    render(<PortfolioPage />);

    await selectV4AndSaveAddress(user);
    await screen.findByText(/Collateral Risk: live Aave data differs/);

    const panel = screen.getByText(/Collateral Risk: live Aave data differs/).closest('div')!;
    await user.click(within(panel).getByRole('button', { name: 'Keep Manual' }));

    expect(screen.queryByText(/Collateral Risk: live Aave data differs/)).not.toBeInTheDocument();
    const after = usePortfolioStore.getState().portfolios[created.id].portfolio;
    expect(after.v4CollateralRisk).toEqual(MANUAL_COLLATERAL_RISK);
    expect(after.v4CollateralRiskSource).toBe('manual');
  });

  it('debt and collateral-risk conflicts are independently actionable — accepting one leaves the other pending', async () => {
    const created = createAndSelect();
    usePortfolioStore.getState().setProtocolVersion(created.id, 'v4');
    usePortfolioStore.getState().setAaveV4DebtState(created.id, MANUAL_DEBT_STATE, 'manual');
    usePortfolioStore
      .getState()
      .setAaveV4CollateralRisk(created.id, MANUAL_COLLATERAL_RISK, 'manual');
    installFetchRouter(
      () => DIFFERING_LIVE_DEBT_STATE,
      () => DIFFERING_LIVE_COLLATERAL_RISK,
    );
    const user = userEvent.setup();
    render(<PortfolioPage />);

    await selectV4AndSaveAddress(user);
    await screen.findByText(/Debt State: live Aave data differs/);
    await screen.findByText(/Collateral Risk: live Aave data differs/);

    const debtPanel = screen.getByText(/Debt State: live Aave data differs/).closest('div')!;
    await user.click(within(debtPanel).getByRole('button', { name: 'Use Live Data' }));

    // Debt is now resolved; collateral-risk conflict remains fully intact.
    expect(screen.queryByText(/Debt State: live Aave data differs/)).not.toBeInTheDocument();
    await screen.findByText(/Collateral Risk: live Aave data differs/);
    const after = usePortfolioStore.getState().portfolios[created.id].portfolio;
    expect(after.v4DebtState).toEqual(DIFFERING_LIVE_DEBT_STATE);
    expect(after.v4DebtStateSource).toBe('live');
    expect(after.v4CollateralRisk).toEqual(MANUAL_COLLATERAL_RISK);
    expect(after.v4CollateralRiskSource).toBe('manual');
  });
});

describe('P0-1 — mid-edit race: a dirty ManualAaveV4StateForm is not clobbered by a conflicting live fetch', () => {
  it('typing (not yet submitted) survives a differing live fetch; canonical stays manual; the conflict panel appears; submitting afterward saves cleanly', async () => {
    const created = createAndSelect();
    usePortfolioStore.getState().setProtocolVersion(created.id, 'v4');
    usePortfolioStore.getState().setAaveV4DebtState(created.id, MANUAL_DEBT_STATE, 'manual');
    installFetchRouter(
      () => DIFFERING_LIVE_DEBT_STATE,
      () => DIFFERING_LIVE_COLLATERAL_RISK,
    );
    const user = userEvent.setup();
    render(<PortfolioPage />);

    // Selecting V4 (no address yet) mounts the manual form pre-filled
    // from the existing manual value, with no fetch yet (no address).
    const section = within(screen.getByRole('group', { name: 'Aave protocol version' }));
    await user.click(section.getByRole('radio', { name: 'Aave V4' }));
    const drawnDebtInput = screen.getByLabelText('Drawn debt', { exact: false });
    expect(drawnDebtInput).toHaveValue(MANUAL_DEBT_STATE.drawnDebt);

    // The user starts editing — dirty, NOT yet submitted.
    await user.clear(drawnDebtInput);
    await user.type(drawnDebtInput, '77777');
    expect(drawnDebtInput).toHaveValue(77777);

    // NOW the address is entered and saved, triggering the real fetch,
    // which resolves with a DIFFERENT value than either the dirty typed
    // value or the prior canonical manual value.
    await user.type(section.getByLabelText('On-chain address', { exact: false }), V4_ADDRESS);
    await user.click(section.getByRole('button', { name: 'Save address' }));

    await screen.findByText(/Debt State: live Aave data differs/);
    // The user's in-progress typing must survive — never silently
    // overwritten by the fetch landing.
    expect(screen.getByLabelText('Drawn debt', { exact: false })).toHaveValue(77777);
    // Canonical portfolio state must remain the ORIGINAL manual value —
    // the dirty, unsubmitted edit never reached the Store, and the
    // conflicting fetch never overwrote it either.
    expect(usePortfolioStore.getState().portfolios[created.id].portfolio.v4DebtState).toEqual(
      MANUAL_DEBT_STATE,
    );
    expect(usePortfolioStore.getState().portfolios[created.id].portfolio.v4DebtStateSource).toBe(
      'manual',
    );

    // Submitting the user's own dirty edit now must not cause hidden
    // source/state corruption — it saves cleanly as the new manual value.
    await user.click(screen.getByRole('button', { name: 'Save debt assumptions' }));
    const after = usePortfolioStore.getState().portfolios[created.id].portfolio;
    expect(after.v4DebtState?.drawnDebt).toBe(77777);
    expect(after.v4DebtStateSource).toBe('manual');
  });
});

describe('P0-1 — remount/manual-override regression: an intentional manual override survives a page remount + refetch', () => {
  it('live → user edits back to manual → remount triggers a new differing fetch → becomes a candidate, never a silent overwrite', async () => {
    const created = createAndSelect();
    usePortfolioStore.getState().setProtocolVersion(created.id, 'v4');
    usePortfolioStore.getState().setAaveV4Position(created.id, { userAddress: V4_ADDRESS });
    const initialLiveDebtState = {
      drawnDebt: 10000,
      premiumDebt: 100,
      baseDrawnApr: 0.03,
      riskPremium: 0.005,
      debtAssetPriceUsd: 1.0,
    };
    usePortfolioStore.getState().setAaveV4DebtState(created.id, initialLiveDebtState, 'live');
    usePortfolioStore
      .getState()
      .setAaveV4CollateralRisk(created.id, { collateralFactor: 0.8, dynamicConfigKey: 1 }, 'live');

    let nextDebtFetch = initialLiveDebtState;
    installFetchRouter(
      () => nextDebtFetch,
      () => ({ collateralFactor: 0.8, dynamicConfigKey: 1 }),
    );

    const { unmount } = render(<PortfolioPage />);
    const debtSection = within(screen.getByRole('group', { name: 'Debt' }).closest('form')!);
    await debtSection.findByText('Aave V4 · Live');

    // The user intentionally edits the live value back to a manual
    // assumption — a legitimate "what if" override.
    const user = userEvent.setup();
    const manualOverride = {
      drawnDebt: 33333,
      premiumDebt: 999,
      baseDrawnApr: 0.08,
      riskPremium: 0.03,
    };
    const drawnDebtInput = screen.getByLabelText('Drawn debt', { exact: false });
    await user.clear(drawnDebtInput);
    await user.type(drawnDebtInput, String(manualOverride.drawnDebt));
    const premiumDebtInput = screen.getByLabelText('Premium debt', { exact: false });
    await user.clear(premiumDebtInput);
    await user.type(premiumDebtInput, String(manualOverride.premiumDebt));
    const baseAprInput = screen.getByLabelText('Base drawn APR (%)', { exact: false });
    await user.clear(baseAprInput);
    await user.type(baseAprInput, '8');
    const riskPremiumInput = screen.getByLabelText('Risk premium (%)', { exact: false });
    await user.clear(riskPremiumInput);
    await user.type(riskPremiumInput, '3');
    await user.click(screen.getByRole('button', { name: 'Save debt assumptions' }));

    let after = usePortfolioStore.getState().portfolios[created.id].portfolio;
    expect(after.v4DebtStateSource).toBe('manual');
    expect(after.v4DebtState?.drawnDebt).toBe(33333);

    // Simulate a page remount (e.g. navigating away and back) — the next
    // fetch resolves with something DIFFERENT from the user's manual
    // override.
    unmount();
    nextDebtFetch = DIFFERING_LIVE_DEBT_STATE;
    render(<PortfolioPage />);

    await screen.findByText(/Debt State: live Aave data differs/);

    // The manual override must survive completely intact — never
    // silently restored to live.
    after = usePortfolioStore.getState().portfolios[created.id].portfolio;
    expect(after.v4DebtStateSource).toBe('manual');
    expect(after.v4DebtState?.drawnDebt).toBe(33333);
    expect(after.v4DebtState?.premiumDebt).toBe(999);
  });
});

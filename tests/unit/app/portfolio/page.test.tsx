import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import PortfolioPage from '@/app/portfolio/page';
import { autoSaveCoordinator, resolveCanonicalDebtBalance } from '@/services';
import { useAaveLiveDataStore } from '@/stores/aaveLiveDataStore';
import { useAaveV4CollateralRiskLiveDataStore } from '@/stores/aaveV4CollateralRiskLiveDataStore';
import { useAaveV4LiveDataStore } from '@/stores/aaveV4LiveDataStore';
import { usePortfolioStore } from '@/stores/portfolioStore';

/**
 * Portfolio Details Form — 06_TASKS.md M4-006. DoD: "Changes persist and
 * do not alter position balances unexpectedly."
 *
 * **Every `getByLabelText` call below passes `{ exact: false }` (M9-026
 * "Audit Form Accessibility")** — see
 * `tests/unit/app/portfolios/new/page.test.tsx`'s identical header note
 * for why: required fields now render a trailing `<RequiredMark />`
 * inside their `<label>`, which becomes part of the label's computed
 * text content.
 *
 * **Portfolio Live-State Cleanup batch**: rendering `<PortfolioPage />`
 * now also mounts `hooks/useAaveLiveSync.ts`, which calls
 * `useAaveLiveDataStore`'s `fetchLiveAaveData` on mount. The default
 * `beforeEach` below stubs that store into a `'ready'` state whose
 * fetched values exactly match `validInput()`'s own `market`/`protocol`
 * defaults — the live-sync equality gate then sees no difference and
 * never calls `update()`, so every existing test below (written before
 * live sync existed) keeps behaving exactly as it did — this is itself
 * a standing regression test for "identical data causes no portfolio
 * update," exercised on every single test in this file, not just the
 * ones that name it explicitly.
 */
const INITIAL_STATE = {
  portfolios: {},
  activePortfolioId: null,
  loadStatus: 'idle' as const,
  saveStatus: 'idle' as const,
  errors: [],
  lastSynchronizedAt: null,
};

function matchingAaveLiveState(
  overrides: Partial<ReturnType<typeof useAaveLiveDataStore.getState>> = {},
) {
  return {
    status: 'ready' as const,
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

/**
 * V4 Readiness Audit §12 Stage 13 — mirrors `matchingAaveLiveState`'s own
 * "stub the fetch function so mounting `useAaveV4LiveSync` never makes a
 * real, unmocked network call" role, for the V4 live-data store. Defaults
 * to `'idle'`/no address — a strict no-op for every test that never
 * opts a portfolio into V4, exactly like Stage 7 intended.
 */
function matchingAaveV4LiveState(
  overrides: Partial<ReturnType<typeof useAaveV4LiveDataStore.getState>> = {},
) {
  return {
    status: 'idle' as const,
    engineInputs: null,
    userAddress: null,
    debtAsset: null,
    errorMessage: null,
    // V4 Readiness Audit §12 Stage 17 — defaults to "just fetched" so
    // every pre-existing `{ status: 'ready' }` override here still reads
    // as fresh/live, not stale, without needing to touch every call
    // site. Staleness tests below override this explicitly.
    lastFetchedAt: new Date().toISOString(),
    fetchAaveV4LiveData: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

/**
 * V4 Readiness Audit §12 Stage 23F — same role as `matchingAaveV4LiveState`
 * above, one store over: stubs `fetchAaveV4CollateralRiskLiveData` so
 * mounting `useAaveV4CollateralRiskLiveSync` (via `useAaveV4Sync`) never
 * makes a real, unmocked network call. Defaults to `'idle'`/no address —
 * a strict no-op for every test that never opts a portfolio into V4.
 */
function matchingAaveV4CollateralRiskLiveState(
  overrides: Partial<ReturnType<typeof useAaveV4CollateralRiskLiveDataStore.getState>> = {},
) {
  return {
    status: 'idle' as const,
    canonical: null,
    userAddress: null,
    errorMessage: null,
    lastFetchedAt: new Date().toISOString(),
    fetchAaveV4CollateralRiskLiveData: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

beforeEach(() => {
  usePortfolioStore.setState(INITIAL_STATE);
  useAaveLiveDataStore.setState(matchingAaveLiveState());
  useAaveV4LiveDataStore.setState(matchingAaveV4LiveState());
  useAaveV4CollateralRiskLiveDataStore.setState(matchingAaveV4CollateralRiskLiveState());
  window.localStorage.clear();
});

function validInput(overrides: Record<string, unknown> = {}) {
  return {
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
  };
}

function createAndSelect(overrides: Record<string, unknown> = {}) {
  const result = usePortfolioStore.getState().create(validInput(overrides));
  if (!result.ok) throw new Error('setup failed');
  usePortfolioStore.getState().select(result.data.id);
  return result.data;
}

const V4_ADDRESS = '0x1234567890123456789012345678901234567890';

/**
 * V4 Readiness Audit §12 Stage 13 — mirrors how a real user opts a
 * portfolio into V4: create it exactly like every other portfolio (still
 * V3-shaped, `protocolVersion` unset), then use the same two Store
 * actions `AaveProtocolVersionForm` itself calls
 * (`setProtocolVersion`/`setAaveV4Position`). `v4DebtState` is set via
 * the third existing action, `setAaveV4DebtState`, only when a test
 * explicitly needs one (mirroring a live sync having already landed).
 */
function createAndSelectV4(
  overrides: Record<string, unknown> = {},
  v4DebtState?: {
    drawnDebt: number;
    premiumDebt: number;
    baseDrawnApr: number;
    riskPremium: number;
  },
) {
  const created = createAndSelect(overrides);
  usePortfolioStore.getState().setProtocolVersion(created.id, 'v4');
  usePortfolioStore.getState().setAaveV4Position(created.id, { userAddress: V4_ADDRESS });
  if (v4DebtState !== undefined) {
    usePortfolioStore
      .getState()
      .setAaveV4DebtState(created.id, { ...v4DebtState, debtAssetPriceUsd: 1.0 });
    // Stage 23C: the calculation now also requires `v4CollateralRisk` to be
    // synced (mirroring this same `v4DebtState` guard). Set alongside it
    // whenever a test needs the calculation to actually succeed — same
    // 0.8 fixture convention as this file's `protocol.liquidationThreshold`.
    usePortfolioStore
      .getState()
      .setAaveV4CollateralRisk(created.id, { collateralFactor: 0.8, dynamicConfigKey: 1 });
  }
  return usePortfolioStore.getState().portfolios[created.id].portfolio;
}

describe('PortfolioPage — no active portfolio (M4-006)', () => {
  it('shows a message and a link to select or create one', () => {
    render(<PortfolioPage />);
    expect(screen.getByText(/no portfolio is currently selected/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /select or create one/i })).toHaveAttribute(
      'href',
      '/portfolios',
    );
  });
});

describe('PortfolioPage — Details Form fields (M4-006)', () => {
  it('renders exactly this task\'s own editable "Fields" list', () => {
    createAndSelect();
    render(<PortfolioPage />);
    expect(screen.getByLabelText('Portfolio name', { exact: false })).toBeInTheDocument();
    expect(screen.getByLabelText('Description', { exact: false })).toBeInTheDocument();
    expect(screen.getByLabelText('Base currency', { exact: false })).toBeInTheDocument();
    expect(screen.getByLabelText('Target Health Factor', { exact: false })).toBeInTheDocument();
    expect(screen.getByLabelText('Holding period (days)', { exact: false })).toBeInTheDocument();
    expect(screen.getByLabelText('Target BTC price (USD)', { exact: false })).toBeInTheDocument();
    expect(screen.getByLabelText('Safety buffer (%)', { exact: false })).toBeInTheDocument();
  });

  it("prefills fields with the active portfolio's current values", () => {
    createAndSelect();
    render(<PortfolioPage />);
    expect(screen.getByLabelText('Portfolio name', { exact: false })).toHaveValue('My Portfolio');
    expect(screen.getByLabelText('Base currency', { exact: false })).toHaveValue('USD');
  });

  it('does not render "Default display settings" fields (conflict #22 — no shape defined anywhere)', () => {
    createAndSelect();
    render(<PortfolioPage />);
    expect(screen.queryByText(/display setting/i)).not.toBeInTheDocument();
  });

  it('states that changes save automatically (no manual save button)', () => {
    createAndSelect();
    render(<PortfolioPage />);
    expect(screen.getByText(/save automatically/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
  });
});

describe('PortfolioPage — auto-save (M4-006 Requirement)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces edits and commits them to the store without a submit action', async () => {
    const created = createAndSelect();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<PortfolioPage />);

    const nameInput = screen.getByLabelText('Portfolio name', { exact: false });
    await user.clear(nameInput);
    await user.type(nameInput, 'Renamed Portfolio');

    // Not yet committed before the debounce window elapses.
    expect(usePortfolioStore.getState().portfolios[created.id].portfolio.name).toBe('My Portfolio');

    await vi.advanceTimersByTimeAsync(700);

    expect(usePortfolioStore.getState().portfolios[created.id].portfolio.name).toBe(
      'Renamed Portfolio',
    );
  });

  it('does not alter collateral/debt/market/protocol when general info is edited (DoD)', async () => {
    const created = createAndSelect();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<PortfolioPage />);

    const nameInput = screen.getByLabelText('Portfolio name', { exact: false });
    await user.clear(nameInput);
    await user.type(nameInput, 'Renamed Portfolio');
    await vi.advanceTimersByTimeAsync(700);

    const updated = usePortfolioStore.getState().portfolios[created.id].portfolio;
    expect(updated.collateral).toEqual(created.collateral);
    expect(updated.debt).toEqual(created.debt);
    expect(updated.market).toEqual(created.market);
    expect(updated.protocol).toEqual(created.protocol);
  });

  it('does not auto-save an invalid edit (empty base currency) and shows an inline error', async () => {
    const created = createAndSelect();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<PortfolioPage />);

    const currencyInput = screen.getByLabelText('Base currency', { exact: false });
    await user.clear(currencyInput);
    await vi.advanceTimersByTimeAsync(700);

    expect(usePortfolioStore.getState().portfolios[created.id].portfolio.baseCurrency).toBe('USD');
    const label = currencyInput.closest('label');
    expect(label?.nextElementSibling?.classList.contains('text-destructive')).toBe(true);
  });

  it('leaves an empty optional safety-target field as absent rather than blocking the save with NaN', async () => {
    const created = createAndSelect();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<PortfolioPage />);

    const nameInput = screen.getByLabelText('Portfolio name', { exact: false });
    await user.clear(nameInput);
    await user.type(nameInput, 'Renamed Portfolio');
    await vi.advanceTimersByTimeAsync(700);

    // The untouched, empty "Target Health Factor" field must not have
    // silently blocked this save (the exact bug found and fixed while
    // implementing this batch — an empty optional numeric field coerced
    // to NaN via `valueAsNumber`, which fails Zod's `.finite()` check).
    expect(usePortfolioStore.getState().portfolios[created.id].portfolio.name).toBe(
      'Renamed Portfolio',
    );
  });
});

describe('PortfolioPage — remounts on portfolio switch (M4-010 state-isolation DoD)', () => {
  it("shows the newly active portfolio's own values, not stale field state from the previous one", () => {
    const first = usePortfolioStore.getState().create(validInput({ name: 'Alpha' }));
    const second = usePortfolioStore.getState().create(validInput({ name: 'Beta' }));
    if (!first.ok || !second.ok) throw new Error('setup failed');

    usePortfolioStore.getState().select(first.data.id);
    const { rerender } = render(<PortfolioPage />);
    expect(screen.getByLabelText('Portfolio name', { exact: false })).toHaveValue('Alpha');

    usePortfolioStore.getState().select(second.data.id);
    rerender(<PortfolioPage />);
    expect(screen.getByLabelText('Portfolio name', { exact: false })).toHaveValue('Beta');
  });
});

describe('PortfolioPage — Collateral Position Management (Portfolio Live-State Cleanup batch)', () => {
  it('renders Quantity as editable and BTC price/Maximum LTV/Liquidation threshold as live, read-only values', () => {
    createAndSelect();
    render(<PortfolioPage />);
    const section = within(screen.getByRole('group', { name: 'Collateral' }));
    expect(section.getByText('Asset: BTC')).toBeInTheDocument();
    expect(section.getByLabelText('Quantity', { exact: false })).toHaveValue(2);
    // No longer editable inputs — read-only value + status.
    expect(
      section.queryByLabelText('Manual price (USD)', { exact: false }),
    ).not.toBeInTheDocument();
    expect(section.queryByLabelText('Maximum LTV (%)', { exact: false })).not.toBeInTheDocument();
    expect(
      section.queryByLabelText('Liquidation threshold (%)', { exact: false }),
    ).not.toBeInTheDocument();
    expect(section.getByText('BTC price')).toBeInTheDocument();
    expect(section.getByText('$50,000.00')).toBeInTheDocument();
    expect(section.getByText('Maximum LTV')).toBeInTheDocument();
    expect(section.getByText('75%')).toBeInTheDocument();
    expect(section.getByText('Liquidation threshold')).toBeInTheDocument();
    expect(section.getByText('80%')).toBeInTheDocument();
    expect(section.getByText('Aave V3 · Live')).toBeInTheDocument();
  });

  /**
   * "Maximum LTV"/"Liquidation threshold" vs. "Collateral Factor" — V4
   * Readiness Audit §12 Stage 23E. V4 has no separate max-LTV/liquidation-
   * threshold pair (Stage 23B); showing the V3-shaped pair under a V4
   * portfolio would render `portfolio.protocol.maxLoanToValue`/
   * `.liquidationThreshold` — legacy fields with no defined relationship
   * to V4's real `collateralFactor`.
   */
  it('shows Collateral Factor (never Maximum LTV/Liquidation threshold) for a V4 portfolio with synced v4CollateralRisk', () => {
    createAndSelectV4({}, { drawnDebt: 20000, premiumDebt: 0, baseDrawnApr: 0.05, riskPremium: 0 });
    render(<PortfolioPage />);
    const section = within(screen.getByRole('group', { name: 'Collateral' }));
    expect(section.getByText('Collateral Factor')).toBeInTheDocument();
    expect(section.getByText('80%')).toBeInTheDocument();
    expect(section.queryByText('Maximum LTV')).not.toBeInTheDocument();
    expect(section.queryByText('Liquidation threshold')).not.toBeInTheDocument();
  });

  it('shows "—" for Collateral Factor when v4CollateralRisk has not synced yet, never falling back to a V3 number', () => {
    const created = createAndSelect();
    usePortfolioStore.getState().setProtocolVersion(created.id, 'v4');
    usePortfolioStore.getState().setAaveV4Position(created.id, { userAddress: V4_ADDRESS });
    render(<PortfolioPage />);
    const section = within(screen.getByRole('group', { name: 'Collateral' }));
    expect(section.getByText('Collateral Factor')).toBeInTheDocument();
    expect(section.queryByText('Maximum LTV')).not.toBeInTheDocument();
    expect(section.queryByText('Liquidation threshold')).not.toBeInTheDocument();
  });

  it('does not apply a change without first previewing it (hard gate)', () => {
    createAndSelect();
    render(<PortfolioPage />);
    const section = within(screen.getByRole('group', { name: 'Collateral' }).closest('form')!);
    expect(section.getByRole('button', { name: 'Apply Changes' })).toBeDisabled();
  });

  it('previews before/after Net Equity and Health Factor, then applies on confirmation', async () => {
    const created = createAndSelect();
    const user = userEvent.setup();
    render(<PortfolioPage />);
    const form = screen.getByRole('group', { name: 'Collateral' }).closest('form')!;
    const section = within(form);

    await user.clear(section.getByLabelText('Quantity', { exact: false }));
    await user.type(section.getByLabelText('Quantity', { exact: false }), '3');
    await user.click(section.getByRole('button', { name: 'Preview Changes' }));

    // Before: 2 BTC @ $50,000 = $100,000 collateral, $20,000 debt -> $80,000 equity.
    // After: 3 BTC @ $50,000 = $150,000 collateral, same debt -> $130,000 equity.
    expect(section.getByText(/\$80,000\.00 → \$130,000\.00/)).toBeInTheDocument();

    const applyButton = section.getByRole('button', { name: 'Apply Changes' });
    expect(applyButton).not.toBeDisabled();
    await user.click(applyButton);

    expect(usePortfolioStore.getState().portfolios[created.id].portfolio.collateral.quantity).toBe(
      3,
    );
  });

  it('clears a stale preview when a field changes again after previewing', async () => {
    createAndSelect();
    const user = userEvent.setup();
    render(<PortfolioPage />);
    const form = screen.getByRole('group', { name: 'Collateral' }).closest('form')!;
    const section = within(form);

    await user.clear(section.getByLabelText('Quantity', { exact: false }));
    await user.type(section.getByLabelText('Quantity', { exact: false }), '3');
    await user.click(section.getByRole('button', { name: 'Preview Changes' }));
    expect(section.getByRole('button', { name: 'Apply Changes' })).not.toBeDisabled();

    await user.type(section.getByLabelText('Quantity', { exact: false }), '5');
    expect(section.getByRole('button', { name: 'Apply Changes' })).toBeDisabled();
  });
});

describe('PortfolioPage — Debt Position Management (M4-008)', () => {
  it('renders Asset/Debt amount as editable and Borrow rate as a live, read-only value, except the undefined "Rate type" (conflict #25)', () => {
    createAndSelect();
    render(<PortfolioPage />);
    const section = within(screen.getByRole('group', { name: 'Debt' }));
    expect(section.getByLabelText('Asset', { exact: false })).toHaveValue('USDC');
    expect(section.getByLabelText('Debt amount', { exact: false })).toHaveValue(20000);
    expect(section.getByText(/Price: \$1\.00/)).toBeInTheDocument();
    expect(section.queryByLabelText('Borrow rate (%)', { exact: false })).not.toBeInTheDocument();
    expect(section.getByText('Borrow rate')).toBeInTheDocument();
    expect(section.getByText('5%')).toBeInTheDocument();
    expect(section.getByText('Aave V3 · Live')).toBeInTheDocument();
    expect(section.queryByText(/rate type/i)).not.toBeInTheDocument();
  });

  it('supports repaying debt down to exactly zero and previews the resulting Health Factor as a finite number (conflict #20 stays reachable through this UI)', async () => {
    const created = createAndSelect();
    const user = userEvent.setup();
    render(<PortfolioPage />);
    const form = screen.getByRole('group', { name: 'Debt' }).closest('form')!;
    const section = within(form);

    await user.clear(section.getByLabelText('Debt amount', { exact: false }));
    await user.type(section.getByLabelText('Debt amount', { exact: false }), '0');
    await user.click(section.getByRole('button', { name: 'Preview Changes' }));

    // Zero debt -> Health Factor Infinity, formatted by Intl.NumberFormat as "∞".
    expect(section.getByText('Health Factor', { selector: 'dt' })).toBeInTheDocument();
    expect(section.getByText(/∞/)).toBeInTheDocument();

    await user.click(section.getByRole('button', { name: 'Apply Changes' }));
    expect(usePortfolioStore.getState().portfolios[created.id].portfolio.debt.balance).toBe(0);
    expect(usePortfolioStore.getState().portfolios[created.id].summary.ok).toBe(true);
  });

  it('rejects a negative debt amount preview (validate non-negative debt)', async () => {
    createAndSelect();
    const user = userEvent.setup();
    render(<PortfolioPage />);
    const form = screen.getByRole('group', { name: 'Debt' }).closest('form')!;
    const section = within(form);

    await user.clear(section.getByLabelText('Debt amount', { exact: false }));
    await user.type(section.getByLabelText('Debt amount', { exact: false }), '-500');
    await user.click(section.getByRole('button', { name: 'Preview Changes' }));

    expect(section.getByRole('button', { name: 'Apply Changes' })).toBeDisabled();
  });

  it('does not apply a change without first previewing it (hard gate)', () => {
    createAndSelect();
    render(<PortfolioPage />);
    const section = within(screen.getByRole('group', { name: 'Debt' }).closest('form')!);
    expect(section.getByRole('button', { name: 'Apply Changes' })).toBeDisabled();
  });

  it("explains why Apply Changes is disabled when a debt increase requires risk acknowledgment (PT-10 — the punch-list's own repro: increasing debt from $0)", async () => {
    const created = createAndSelect({ debt: { asset: 'USDC', balance: 0 } });
    const user = userEvent.setup();
    render(<PortfolioPage />);
    const form = screen.getByRole('group', { name: 'Debt' }).closest('form')!;
    const section = within(form);

    await user.clear(section.getByLabelText('Debt amount', { exact: false }));
    await user.type(section.getByLabelText('Debt amount', { exact: false }), '20000');
    await user.click(section.getByRole('button', { name: 'Preview Changes' }));

    const applyButton = section.getByRole('button', { name: 'Apply Changes' });
    expect(applyButton).toBeDisabled();
    expect(applyButton).toHaveAttribute('aria-describedby', 'debt-apply-blocked-hint');
    expect(
      section.getByText(
        'Apply Changes is disabled until you check the risk acknowledgment box below.',
      ),
    ).toBeInTheDocument();

    await user.click(section.getByRole('checkbox'));
    expect(applyButton).not.toBeDisabled();
    expect(applyButton).not.toHaveAttribute('aria-describedby');

    await user.click(applyButton);
    expect(usePortfolioStore.getState().portfolios[created.id].portfolio.debt.balance).toBe(20000);
  });
});

describe('PortfolioPage — Portfolio Action Preview (M4-009)', () => {
  it('displays the Liquidation Price change alongside Net Equity/Health Factor/LTV', async () => {
    createAndSelect();
    const user = userEvent.setup();
    render(<PortfolioPage />);
    const form = screen.getByRole('group', { name: 'Collateral' }).closest('form')!;
    const section = within(form);

    await user.clear(section.getByLabelText('Quantity', { exact: false }));
    await user.type(section.getByLabelText('Quantity', { exact: false }), '3');
    await user.click(section.getByRole('button', { name: 'Preview Changes' }));

    expect(section.getByText('Liquidation Price', { selector: 'dt' })).toBeInTheDocument();
    // Base: 2 BTC/$20,000 debt/80% threshold -> $12,500. After: 3 BTC -> $8,333.33.
    expect(section.getByText(/\$12,500\.00 → \$8,333\.33/)).toBeInTheDocument();
  });

  it('shows "N/A (no debt)" for the Liquidation Price side that has no debt (conflict #20)', async () => {
    createAndSelect();
    const user = userEvent.setup();
    render(<PortfolioPage />);
    const form = screen.getByRole('group', { name: 'Debt' }).closest('form')!;
    const section = within(form);

    await user.clear(section.getByLabelText('Debt amount', { exact: false }));
    await user.type(section.getByLabelText('Debt amount', { exact: false }), '0');
    await user.click(section.getByRole('button', { name: 'Preview Changes' }));

    expect(section.getByText(/\$12,500\.00 → N\/A \(no debt\)/)).toBeInTheDocument();
  });

  it('surfaces the "after" summary\'s Warnings directly from the Service, not a UI-invented list', async () => {
    createAndSelect();
    const user = userEvent.setup();
    render(<PortfolioPage />);
    const form = screen.getByRole('group', { name: 'Debt' }).closest('form')!;
    const section = within(form);

    await user.clear(section.getByLabelText('Debt amount', { exact: false }));
    await user.type(section.getByLabelText('Debt amount', { exact: false }), '0');
    await user.click(section.getByRole('button', { name: 'Preview Changes' }));

    // The real NO_DEBT warning calculateHealthFactor (F-022) already
    // produces — not text invented in this component.
    expect(
      section.getByText(/No debt exists; Health Factor is infinite \(no liquidation risk\)/),
    ).toBeInTheDocument();
  });

  it('requires explicit confirmation before applying a risk-increasing change (DoD)', async () => {
    const created = createAndSelect();
    const user = userEvent.setup();
    render(<PortfolioPage />);
    const form = screen.getByRole('group', { name: 'Collateral' }).closest('form')!;
    const section = within(form);

    // Withdrawing collateral lowers Health Factor: 4 -> 2.
    await user.clear(section.getByLabelText('Quantity', { exact: false }));
    await user.type(section.getByLabelText('Quantity', { exact: false }), '1');
    await user.click(section.getByRole('button', { name: 'Preview Changes' }));

    const checkbox = section.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();
    expect(section.getByRole('button', { name: 'Apply Changes' })).toBeDisabled();

    await user.click(checkbox);
    expect(section.getByRole('button', { name: 'Apply Changes' })).not.toBeDisabled();

    await user.click(section.getByRole('button', { name: 'Apply Changes' }));
    expect(usePortfolioStore.getState().portfolios[created.id].portfolio.collateral.quantity).toBe(
      1,
    );
  });

  it('does not show a risk-acknowledgment checkbox for a non-risk-increasing change', async () => {
    createAndSelect();
    const user = userEvent.setup();
    render(<PortfolioPage />);
    const form = screen.getByRole('group', { name: 'Collateral' }).closest('form')!;
    const section = within(form);

    // Adding collateral raises Health Factor: 4 -> 6.
    await user.clear(section.getByLabelText('Quantity', { exact: false }));
    await user.type(section.getByLabelText('Quantity', { exact: false }), '3');
    await user.click(section.getByRole('button', { name: 'Preview Changes' }));

    expect(section.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(section.getByRole('button', { name: 'Apply Changes' })).not.toBeDisabled();
  });

  it('resets the risk acknowledgment when the field changes again after checking it', async () => {
    createAndSelect();
    const user = userEvent.setup();
    render(<PortfolioPage />);
    const form = screen.getByRole('group', { name: 'Collateral' }).closest('form')!;
    const section = within(form);

    await user.clear(section.getByLabelText('Quantity', { exact: false }));
    await user.type(section.getByLabelText('Quantity', { exact: false }), '1');
    await user.click(section.getByRole('button', { name: 'Preview Changes' }));
    await user.click(section.getByRole('checkbox'));
    expect(section.getByRole('button', { name: 'Apply Changes' })).not.toBeDisabled();

    // Editing again clears both the preview and the acknowledgment.
    await user.type(section.getByLabelText('Quantity', { exact: false }), '5');
    expect(section.getByRole('button', { name: 'Apply Changes' })).toBeDisabled();
  });

  it('explains why Apply Changes is disabled when only the risk acknowledgment is missing (PT-10)', async () => {
    createAndSelect();
    const user = userEvent.setup();
    render(<PortfolioPage />);
    const form = screen.getByRole('group', { name: 'Collateral' }).closest('form')!;
    const section = within(form);

    // Withdrawing collateral lowers Health Factor: 4 -> 2.
    await user.clear(section.getByLabelText('Quantity', { exact: false }));
    await user.type(section.getByLabelText('Quantity', { exact: false }), '1');
    await user.click(section.getByRole('button', { name: 'Preview Changes' }));

    const applyButton = section.getByRole('button', { name: 'Apply Changes' });
    expect(applyButton).toBeDisabled();
    expect(applyButton).toHaveAttribute('aria-describedby', 'collateral-apply-blocked-hint');
    expect(
      section.getByText(
        'Apply Changes is disabled until you check the risk acknowledgment box below.',
      ),
    ).toBeInTheDocument();

    await user.click(section.getByRole('checkbox'));
    expect(applyButton).not.toBeDisabled();
    expect(
      section.queryByText(
        'Apply Changes is disabled until you check the risk acknowledgment box below.',
      ),
    ).not.toBeInTheDocument();
  });

  it('does not show the risk-acknowledgment hint when Apply is disabled for an unrelated reason (no preview yet)', () => {
    createAndSelect();
    render(<PortfolioPage />);
    const form = screen.getByRole('group', { name: 'Collateral' }).closest('form')!;
    const section = within(form);

    const applyButton = section.getByRole('button', { name: 'Apply Changes' });
    expect(applyButton).toBeDisabled();
    expect(applyButton).not.toHaveAttribute('aria-describedby');
    expect(
      section.queryByText(
        'Apply Changes is disabled until you check the risk acknowledgment box below.',
      ),
    ).not.toBeInTheDocument();
  });
});

describe('PortfolioPage — Live/Stale/Unavailable presentation (Portfolio Live-State Cleanup batch)', () => {
  it('shows "Aave V3 · Live" on both forms when the live fetch is fresh', () => {
    createAndSelect();
    render(<PortfolioPage />);
    const collateralSection = within(screen.getByRole('group', { name: 'Collateral' }));
    const debtSection = within(screen.getByRole('group', { name: 'Debt' }));
    expect(collateralSection.getByText('Aave V3 · Live')).toBeInTheDocument();
    expect(debtSection.getByText('Aave V3 · Live')).toBeInTheDocument();
  });

  it('shows "Aave V3 · Stale" when the last successful fetch is older than 5 minutes', () => {
    createAndSelect();
    useAaveLiveDataStore.setState(
      matchingAaveLiveState({
        marketQuote: {
          asset: 'BTC',
          currency: 'USD',
          freshness: 'stale',
          price: 50000,
          origin: 'provider',
          timestamp: new Date(Date.now() - 10 * 60_000).toISOString(),
        },
      }),
    );
    render(<PortfolioPage />);
    const section = within(screen.getByRole('group', { name: 'Collateral' }));
    expect(section.getByText('Aave V3 · Stale')).toBeInTheDocument();
    expect(section.queryByText('Aave V3 · Live')).not.toBeInTheDocument();
  });

  it('shows "Aave V3 · Unavailable" and the portfolio\'s last-known stored value when no live fetch has ever succeeded', () => {
    createAndSelect();
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
    render(<PortfolioPage />);
    const section = within(screen.getByRole('group', { name: 'Collateral' }));
    expect(section.getByText(/Aave V3 · Unavailable/)).toBeInTheDocument();
    // The value is not blanked/zeroed — the portfolio's own stored (last-known) price still renders.
    expect(section.getByText('$50,000.00')).toBeInTheDocument();
  });

  it('does not offer a protocol preset selector (conflict #24 recurrence)', () => {
    createAndSelect();
    render(<PortfolioPage />);
    expect(screen.queryByText(/preset/i)).not.toBeInTheDocument();
  });
});

describe('PortfolioPage — an open Preview survives a no-op live refresh (Portfolio Live-State Cleanup batch)', () => {
  it('keeps an open Collateral Preview visible when the live store re-renders with identical values', async () => {
    createAndSelect();
    const user = userEvent.setup();
    render(<PortfolioPage />);
    const form = screen.getByRole('group', { name: 'Collateral' }).closest('form')!;
    const section = within(form);

    await user.clear(section.getByLabelText('Quantity', { exact: false }));
    await user.type(section.getByLabelText('Quantity', { exact: false }), '3');
    await user.click(section.getByRole('button', { name: 'Preview Changes' }));
    expect(section.getByRole('button', { name: 'Apply Changes' })).not.toBeDisabled();

    // Simulate a background refresh landing with the exact same values —
    // this must not touch the portfolio (equality-gated in
    // `useAaveLiveSync`) and therefore must not clear the open Preview.
    act(() => {
      useAaveLiveDataStore.setState(matchingAaveLiveState());
    });

    expect(section.getByRole('button', { name: 'Apply Changes' })).not.toBeDisabled();
    expect(section.getByText(/\$80,000\.00 → \$130,000\.00/)).toBeInTheDocument();
  });
});

describe('PortfolioPage — Auto-Save (M4-013)', () => {
  it('displays "Saved" once a portfolio is created and selected', async () => {
    createAndSelect();
    await autoSaveCoordinator.flushAll();
    render(<PortfolioPage />);
    expect(screen.getByRole('status')).toHaveTextContent('Saved');
  });

  it('reactively displays an error state when the Store reports one', () => {
    createAndSelect();
    render(<PortfolioPage />);

    // `saveStatus` is one global Store field (Batch 1) — updating it via
    // any Store action, even targeting an unrelated id, must be reflected
    // here immediately, since this page reads it live via `usePortfolioStore`.
    act(() => {
      usePortfolioStore.getState().update('missing-id', { name: 'X' });
    });

    expect(screen.getByRole('status')).toHaveTextContent(/Error saving/);
  });

  it('clears a stale preview on the Collateral form when the Debt form applies a change to the same portfolio', async () => {
    createAndSelect();
    const user = userEvent.setup();
    render(<PortfolioPage />);

    const collateralForm = screen.getByRole('group', { name: 'Collateral' }).closest('form')!;
    const collateralSection = within(collateralForm);
    await user.clear(collateralSection.getByLabelText('Quantity', { exact: false }));
    await user.type(collateralSection.getByLabelText('Quantity', { exact: false }), '3');
    await user.click(collateralSection.getByRole('button', { name: 'Preview Changes' }));
    expect(collateralSection.getByRole('button', { name: 'Apply Changes' })).not.toBeDisabled();

    const debtForm = screen.getByRole('group', { name: 'Debt' }).closest('form')!;
    const debtSection = within(debtForm);
    await user.clear(debtSection.getByLabelText('Debt amount', { exact: false }));
    await user.type(debtSection.getByLabelText('Debt amount', { exact: false }), '15000');
    await user.click(debtSection.getByRole('button', { name: 'Preview Changes' }));
    await user.click(debtSection.getByRole('button', { name: 'Apply Changes' }));

    // The Collateral form's own preview, computed before the Debt edit
    // landed, is now stale — confirm it was cleared, not left applyable.
    expect(collateralSection.getByRole('button', { name: 'Apply Changes' })).toBeDisabled();
  });

  it('does not clear a stale preview across unrelated portfolios (each form only reacts to its own portfolio prop)', async () => {
    const first = usePortfolioStore.getState().create(validInput({ name: 'First' }));
    const second = usePortfolioStore.getState().create(validInput({ name: 'Second' }));
    if (!first.ok || !second.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(first.data.id);
    const user = userEvent.setup();
    render(<PortfolioPage />);

    const collateralForm = screen.getByRole('group', { name: 'Collateral' }).closest('form')!;
    const collateralSection = within(collateralForm);
    await user.clear(collateralSection.getByLabelText('Quantity', { exact: false }));
    await user.type(collateralSection.getByLabelText('Quantity', { exact: false }), '3');
    await user.click(collateralSection.getByRole('button', { name: 'Preview Changes' }));
    expect(collateralSection.getByRole('button', { name: 'Apply Changes' })).not.toBeDisabled();

    // Editing a completely different portfolio must not touch this page
    // at all — it isn't rendered here — so the open preview survives.
    usePortfolioStore.getState().update(second.data.id, { name: 'Second Renamed' });
    expect(collateralSection.getByRole('button', { name: 'Apply Changes' })).not.toBeDisabled();
  });
});

describe('PortfolioPage — Calculation Error Recovery (M4-017)', () => {
  it('shows the real error message when the active portfolio’s summary fails to calculate', () => {
    // Zero collateral with nonzero debt — a real, Zod-valid input that
    // fails at calculateLoanToValue (divide by zero), not a fabricated
    // test-only state.
    createAndSelect({ collateral: { asset: 'BTC', quantity: 0 } });
    render(<PortfolioPage />);

    expect(screen.getByText(/cannot compute/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Return to portfolio list' })).toHaveAttribute(
      'href',
      '/portfolios',
    );
    expect(screen.getByRole('button', { name: 'Download recovery copy' })).toBeInTheDocument();
  });

  it('does not show the error banner for a portfolio whose summary calculates successfully', () => {
    createAndSelect();
    render(<PortfolioPage />);
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  it('keeps the Details/Collateral/Debt forms rendered and usable alongside the error banner', () => {
    createAndSelect({ collateral: { asset: 'BTC', quantity: 0 } });
    render(<PortfolioPage />);

    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.getByLabelText('Portfolio name', { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Collateral' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Debt' })).toBeInTheDocument();
  });

  it('Retry recomputes without crashing — same still-failing data in, same failure out', async () => {
    createAndSelect({ collateral: { asset: 'BTC', quantity: 0 } });
    const user = userEvent.setup();
    render(<PortfolioPage />);
    expect(screen.getByText(/cannot compute/i)).toBeInTheDocument();

    // Nothing about the underlying data changed, so the same
    // deterministic failure recurs — Retry recomputing is not a no-op
    // internally (it re-runs `buildSummary`), but with unchanged input
    // it cannot produce a different result. This test proves clicking
    // it does not crash or clear the banner incorrectly.
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(screen.getByText(/cannot compute/i)).toBeInTheDocument();
  });

  it('a fix applied through the Store already clears the error before Retry is ever needed (summaries are never stale relative to committed data)', () => {
    const created = createAndSelect({ collateral: { asset: 'BTC', quantity: 0 } });
    render(<PortfolioPage />);
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();

    act(() => {
      usePortfolioStore
        .getState()
        .update(created.id, { collateral: { asset: 'BTC', quantity: 2 } });
    });

    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  it('Download recovery copy triggers a download for the failing portfolio', async () => {
    createAndSelect({ collateral: { asset: 'BTC', quantity: 0 } });
    const user = userEvent.setup();
    render(<PortfolioPage />);

    const click = vi.fn();
    const realCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = realCreateElement(tagName);
      if (tagName === 'a') element.click = click;
      return element;
    });
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:mock-url'),
      revokeObjectURL: vi.fn(),
    });

    await user.click(screen.getByRole('button', { name: 'Download recovery copy' }));
    expect(click).toHaveBeenCalledTimes(1);

    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
});

/**
 * UX punch-list UX-01/UX-02/UX-03 regression tests — added while fixing
 * these three reproduced defects (see `PROJECT_STATUS.md`'s UX
 * remediation batch write-up). The percentage-scale round-trip tests for
 * `protocol.maxLoanToValue`/`liquidationThreshold`/`borrowApr` (UX-01) and
 * the invalid-input field-level-error tests for those same fields
 * (UX-02/UX-03) are removed here, not merely edited — the Portfolio
 * Live-State Cleanup batch removed the editable inputs those tests
 * exercised entirely (BTC price/Maximum LTV/Liquidation threshold/Borrow
 * rate are now live/read-only), so there is no longer a UI path for a
 * user to type an invalid percentage into any of them. Debt amount
 * remains editable and keeps its own UX-02/UX-03 coverage below.
 */
describe('PortfolioPage — UX-01 (Debt price note, still applicable)', () => {
  it('no longer exposes the internal Formula ID / conflict reference in the Debt price note (F-003 same-class fix)', () => {
    createAndSelect();
    render(<PortfolioPage />);
    const section = within(screen.getByRole('group', { name: 'Debt' }));
    expect(section.getByText(/Price: \$1\.00/)).toBeInTheDocument();
    expect(screen.queryByText(/F-003/)).not.toBeInTheDocument();
    expect(screen.queryByText(/conflict #25/)).not.toBeInTheDocument();
  });
});

describe('PortfolioPage — UX-02/UX-03 validation feedback (functional, not cosmetic)', () => {
  it('shows a friendly message, never the raw Zod NaN message, when Debt amount is cleared', async () => {
    createAndSelect();
    const user = userEvent.setup();
    render(<PortfolioPage />);
    const form = screen.getByRole('group', { name: 'Debt' }).closest('form')!;
    const section = within(form);

    await user.clear(section.getByLabelText('Debt amount', { exact: false }));

    expect(section.getByText('Enter a valid debt amount.')).toBeInTheDocument();
    expect(screen.queryByText(/received NaN/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Invalid input: expected number/)).not.toBeInTheDocument();
  });

  it('a valid edit survives input, preview, apply, and a full page remount (persistence across refresh)', async () => {
    const created = createAndSelect();
    const user = userEvent.setup();
    const { unmount } = render(<PortfolioPage />);
    const form = screen.getByRole('group', { name: 'Debt' }).closest('form')!;
    const section = within(form);

    await user.clear(section.getByLabelText('Debt amount', { exact: false }));
    await user.type(section.getByLabelText('Debt amount', { exact: false }), '15000');
    await user.click(section.getByRole('button', { name: 'Preview Changes' }));
    await user.click(section.getByRole('button', { name: 'Apply Changes' }));

    expect(usePortfolioStore.getState().portfolios[created.id].portfolio.debt.balance).toBe(15000);

    // Simulate "survive refresh" — remount the page against the same,
    // already-updated Store state (a real refresh re-hydrates from
    // persistence into the same shape this Store already holds).
    unmount();
    render(<PortfolioPage />);
    const remountedSection = within(screen.getByRole('group', { name: 'Debt' }));
    expect(remountedSection.getByLabelText('Debt amount', { exact: false })).toHaveValue(15000);
  });
});

/**
 * Aave Protocol Version selector — V4 Readiness Audit §12 Stage 13.
 */
describe('PortfolioPage — Aave protocol version selector (Stage 13)', () => {
  it('defaults to Aave V3 selected for a portfolio with protocolVersion unset', () => {
    createAndSelect();
    render(<PortfolioPage />);
    const section = within(screen.getByRole('group', { name: 'Aave protocol version' }));
    expect(section.getByRole('radio', { name: 'Aave V3' })).toBeChecked();
    expect(section.getByRole('radio', { name: 'Aave V4' })).not.toBeChecked();
    expect(section.queryByLabelText('On-chain address', { exact: false })).not.toBeInTheDocument();
  });

  it('selecting Aave V4 reveals the on-chain address field, labeled clearly as position identity, not sign-in identity', async () => {
    const created = createAndSelect();
    const user = userEvent.setup();
    render(<PortfolioPage />);
    const section = within(screen.getByRole('group', { name: 'Aave protocol version' }));

    await user.click(section.getByRole('radio', { name: 'Aave V4' }));

    expect(usePortfolioStore.getState().portfolios[created.id].portfolio.protocolVersion).toBe(
      'v4',
    );
    expect(section.getByLabelText('On-chain address', { exact: false })).toBeInTheDocument();
    expect(screen.getByText(/not your sign-in identity/)).toBeInTheDocument();
  });

  it('rejects an invalid address and does not persist it', async () => {
    createAndSelect();
    const user = userEvent.setup();
    render(<PortfolioPage />);
    const section = within(screen.getByRole('group', { name: 'Aave protocol version' }));

    await user.click(section.getByRole('radio', { name: 'Aave V4' }));
    await user.type(section.getByLabelText('On-chain address', { exact: false }), 'not-an-address');
    await user.click(section.getByRole('button', { name: 'Save address' }));

    expect(screen.getByText('Enter a valid wallet address.')).toBeInTheDocument();
    const activeId = usePortfolioStore.getState().activePortfolioId!;
    expect(usePortfolioStore.getState().portfolios[activeId].portfolio.v4Position).toBeUndefined();
  });

  /**
   * V4 Readiness Audit §12 P3-2 — a well-shaped mixed-case address with
   * the wrong checksum previously showed the same generic "Enter a valid
   * wallet address." message as genuinely malformed input, even though a
   * user staring at an address that visibly looks right has no way to
   * tell what's wrong with it. Confirms the more specific message reaches
   * the real form (not just the schema in isolation), and that rejection
   * itself is unchanged (still not persisted).
   */
  it('shows a checksum-specific message for a well-shaped address with the wrong checksum, and does not persist it', async () => {
    createAndSelect();
    const user = userEvent.setup();
    render(<PortfolioPage />);
    const section = within(screen.getByRole('group', { name: 'Aave protocol version' }));

    await user.click(section.getByRole('radio', { name: 'Aave V4' }));
    await user.type(
      section.getByLabelText('On-chain address', { exact: false }),
      '0xD8DA6BF26964aF9D7eEd9e03E53415D37aA96045',
    );
    await user.click(section.getByRole('button', { name: 'Save address' }));

    expect(
      screen.getByText(
        'This address does not match its checksum. Double-check for a mistyped or wrong-case character.',
      ),
    ).toBeInTheDocument();
    const activeId = usePortfolioStore.getState().activePortfolioId!;
    expect(usePortfolioStore.getState().portfolios[activeId].portfolio.v4Position).toBeUndefined();
  });

  it('accepts a valid address, persists it via setAaveV4Position, and survives a remount (Stage 4A schema reused)', async () => {
    const created = createAndSelect();
    const user = userEvent.setup();
    const { unmount } = render(<PortfolioPage />);
    const section = within(screen.getByRole('group', { name: 'Aave protocol version' }));

    await user.click(section.getByRole('radio', { name: 'Aave V4' }));
    await user.type(section.getByLabelText('On-chain address', { exact: false }), V4_ADDRESS);
    await user.click(section.getByRole('button', { name: 'Save address' }));

    expect(usePortfolioStore.getState().portfolios[created.id].portfolio.v4Position).toEqual({
      userAddress: V4_ADDRESS,
    });

    unmount();
    render(<PortfolioPage />);
    const remountedSection = within(screen.getByRole('group', { name: 'Aave protocol version' }));
    expect(remountedSection.getByRole('radio', { name: 'Aave V4' })).toBeChecked();
    expect(remountedSection.getByLabelText('On-chain address', { exact: false })).toHaveValue(
      V4_ADDRESS,
    );
  });

  it('switching V3 -> V4 -> V3 preserves the already-saved v4Position rather than deleting it (hide, not destroy)', async () => {
    const created = createAndSelectV4();
    const user = userEvent.setup();
    render(<PortfolioPage />);
    const section = within(screen.getByRole('group', { name: 'Aave protocol version' }));

    await user.click(section.getByRole('radio', { name: 'Aave V3' }));
    expect(usePortfolioStore.getState().portfolios[created.id].portfolio.protocolVersion).toBe(
      'v3',
    );
    expect(usePortfolioStore.getState().portfolios[created.id].portfolio.v4Position).toEqual({
      userAddress: V4_ADDRESS,
    });
    expect(section.queryByLabelText('On-chain address', { exact: false })).not.toBeInTheDocument();

    await user.click(section.getByRole('radio', { name: 'Aave V4' }));
    expect(section.getByLabelText('On-chain address', { exact: false })).toHaveValue(V4_ADDRESS);
  });

  it('switching V3 -> V4 -> V3 does not alter collateral/debt/market/protocol values', async () => {
    const created = createAndSelect();
    const user = userEvent.setup();
    render(<PortfolioPage />);
    const section = within(screen.getByRole('group', { name: 'Aave protocol version' }));
    const before = usePortfolioStore.getState().portfolios[created.id].portfolio;

    await user.click(section.getByRole('radio', { name: 'Aave V4' }));
    await user.click(section.getByRole('radio', { name: 'Aave V3' }));

    const after = usePortfolioStore.getState().portfolios[created.id].portfolio;
    expect(after.collateral).toEqual(before.collateral);
    expect(after.debt).toEqual(before.debt);
    expect(after.market).toEqual(before.market);
    expect(after.protocol).toEqual(before.protocol);
  });

  it('one portfolio can be V4 while another stays V3, with no cross-contamination', () => {
    const v4Portfolio = createAndSelectV4();
    const v3Portfolio = createAndSelect({ name: 'Second Portfolio' });
    expect(usePortfolioStore.getState().portfolios[v4Portfolio.id].portfolio.protocolVersion).toBe(
      'v4',
    );
    expect(
      usePortfolioStore.getState().portfolios[v3Portfolio.id].portfolio.protocolVersion,
    ).toBeUndefined();
  });
});

/**
 * V4 status badges — V4 Readiness Audit §12 Stage 13. Rendered inside
 * the Debt section (mirrors the pre-existing V3 "Aave V3 · Live" badge
 * location and wording convention).
 */
describe('PortfolioPage — V4 status badges (Stage 13)', () => {
  it('shows "Waiting for address" for a V4 portfolio with no address set yet', () => {
    const created = createAndSelect();
    usePortfolioStore.getState().setProtocolVersion(created.id, 'v4');
    render(<PortfolioPage />);
    const section = within(screen.getByRole('group', { name: 'Debt' }));
    expect(section.getByText('Aave V4 · Waiting for address')).toBeInTheDocument();
  });

  /**
   * V4 Readiness Audit §12 Stage 23F — direct navigation to /portfolio
   * (never having visited another V4-wired page first) still populates
   * `v4CollateralRisk`, closing the Stage 23E blocker for Portfolio
   * specifically. Mirrors `tests/unit/app/page.test.tsx`'s own Dashboard
   * "direct navigation" assertion for the same hook pairing.
   */
  it('fetches live V4 collateral-risk data on mount once a V4 address is set — status does not stay stuck at idle/loading on direct navigation', () => {
    createAndSelectV4();
    render(<PortfolioPage />);
    expect(
      useAaveV4CollateralRiskLiveDataStore.getState().fetchAaveV4CollateralRiskLiveData,
    ).toHaveBeenCalledWith(V4_ADDRESS);
  });

  it('shows "Loading" while a fetch for a known address is in flight', () => {
    createAndSelectV4();
    useAaveV4LiveDataStore.setState(matchingAaveV4LiveState({ status: 'loading' }));
    render(<PortfolioPage />);
    const section = within(screen.getByRole('group', { name: 'Debt' }));
    expect(section.getByText('Aave V4 · Loading')).toBeInTheDocument();
  });

  it('shows "Provider error" when the last fetch failed, without blanking any last-known data', () => {
    createAndSelectV4(
      {},
      { drawnDebt: 15000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.01 },
    );
    useAaveV4LiveDataStore.setState(
      matchingAaveV4LiveState({
        status: 'error',
        errorMessage: 'Live Aave V4 data is temporarily unavailable.',
      }),
    );
    render(<PortfolioPage />);
    const section = within(screen.getByRole('group', { name: 'Debt' }));
    expect(
      section.getByText('Aave V4 · Provider error (showing last known value)'),
    ).toBeInTheDocument();
    // The portfolio's own last-known v4DebtState is untouched by a failed refresh.
    const activeId = usePortfolioStore.getState().activePortfolioId!;
    expect(usePortfolioStore.getState().portfolios[activeId].portfolio.v4DebtState).toEqual({
      drawnDebt: 15000,
      premiumDebt: 500,
      baseDrawnApr: 0.05,
      riskPremium: 0.01,
      debtAssetPriceUsd: 1.0,
    });
  });

  it('shows "Missing debt state" when the fetch is ready but v4DebtState has not synced onto the portfolio yet', () => {
    createAndSelectV4();
    useAaveV4LiveDataStore.setState(matchingAaveV4LiveState({ status: 'ready' }));
    // V4 Readiness Audit §12 Stage 23F — collateral-risk sync is also
    // "ready" here, proving debt-state absence takes priority over a
    // collateral-risk state that is otherwise perfectly fine.
    useAaveV4CollateralRiskLiveDataStore.setState(
      matchingAaveV4CollateralRiskLiveState({ status: 'ready' }),
    );
    render(<PortfolioPage />);
    const section = within(screen.getByRole('group', { name: 'Debt' }));
    expect(section.getByText('Aave V4 · Missing debt state')).toBeInTheDocument();
  });

  it('shows "Live" once an address is set, the fetch is ready, and v4DebtState is present', () => {
    createAndSelectV4(
      {},
      { drawnDebt: 15000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.01 },
    );
    useAaveV4LiveDataStore.setState(matchingAaveV4LiveState({ status: 'ready' }));
    // V4 Readiness Audit §12 Stage 23F — "Live" now also requires
    // collateral-risk sync to be ready (`createAndSelectV4` already set
    // `v4CollateralRisk` on the portfolio itself, mirroring `v4DebtState`).
    useAaveV4CollateralRiskLiveDataStore.setState(
      matchingAaveV4CollateralRiskLiveState({ status: 'ready' }),
    );
    render(<PortfolioPage />);
    const section = within(screen.getByRole('group', { name: 'Debt' }));
    expect(section.getByText('Aave V4 · Live')).toBeInTheDocument();
  });

  /**
   * "Stale" — V4 Readiness Audit §12 Stage 17. Before this stage, this
   * exact state (ready + synced, just an old fetch) rendered "Aave V4 ·
   * Live" indefinitely — the UI had no way to tell the last successful
   * fetch was old.
   */
  it('shows "Stale" (not "Live") once the last successful fetch is older than the 5-minute freshness window', () => {
    createAndSelectV4(
      {},
      { drawnDebt: 15000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.01 },
    );
    useAaveV4LiveDataStore.setState(
      matchingAaveV4LiveState({
        status: 'ready',
        lastFetchedAt: new Date(Date.now() - 10 * 60_000).toISOString(),
      }),
    );
    // V4 Readiness Audit §12 Stage 23F — collateral-risk sync itself is
    // fresh; staleness here is driven entirely by the debt-state fetch
    // being old (worse-of-two composition, see `utils/protocolStatus.ts`).
    useAaveV4CollateralRiskLiveDataStore.setState(
      matchingAaveV4CollateralRiskLiveState({ status: 'ready' }),
    );
    render(<PortfolioPage />);
    const section = within(screen.getByRole('group', { name: 'Debt' }));
    expect(section.getByText('Aave V4 · Stale')).toBeInTheDocument();
    expect(section.queryByText('Aave V4 · Live')).not.toBeInTheDocument();
  });

  it('a V3 (or unset) portfolio keeps showing the unchanged V3 badge, never a V4 one', () => {
    createAndSelect();
    render(<PortfolioPage />);
    const section = within(screen.getByRole('group', { name: 'Debt' }));
    expect(section.getByText('Aave V3 · Live')).toBeInTheDocument();
  });
});

/**
 * Collateral section status badge — V4 Readiness Audit §12 Stage 25B.
 * Before this stage, `CollateralPositionForm`'s own badge was computed
 * via the pre-V4 `formatAaveDataStatus(deriveAaveDataStatus(marketQuote))`
 * pair, which hardcodes "Aave V3 · ..." regardless of `protocolVersion` —
 * a V4 portfolio's Collateral section always showed "Aave V3 · Live"
 * even for a manual/hypothetical or live-synced V4 position, mislabeling
 * the shared BTC-price-quote freshness signal as the position's own (V3)
 * risk provenance. This block proves the Collateral badge now agrees
 * with the Debt section's own (already protocol-aware) badge in every
 * V4 state, and that V3 is completely unaffected — same wording as
 * before, never a V4 label.
 */
describe('PortfolioPage — Collateral section status badge is protocol-aware (Stage 25B)', () => {
  function createManualV4Portfolio(debtState?: {
    drawnDebt: number;
    premiumDebt: number;
    baseDrawnApr: number;
    riskPremium: number;
  }) {
    const created = createAndSelect();
    usePortfolioStore.getState().setProtocolVersion(created.id, 'v4');
    if (debtState !== undefined) {
      usePortfolioStore.getState().setAaveV4DebtState(created.id, debtState, 'manual');
    }
    usePortfolioStore
      .getState()
      .setAaveV4CollateralRisk(
        created.id,
        { collateralFactor: 0.75, dynamicConfigKey: 0 },
        'manual',
      );
    return usePortfolioStore.getState().portfolios[created.id].portfolio;
  }

  it('shows "Aave V4 · Manual entry" on the Collateral section for a manual V4 portfolio, matching the Debt section', () => {
    createManualV4Portfolio({
      drawnDebt: 30000,
      premiumDebt: 500,
      baseDrawnApr: 0.05,
      riskPremium: 0.01,
    });
    render(<PortfolioPage />);

    const collateralSection = within(screen.getByRole('group', { name: 'Collateral' }));
    const debtSection = within(screen.getByRole('group', { name: 'Debt' }));
    expect(collateralSection.getByText('Aave V4 · Manual entry')).toBeInTheDocument();
    expect(debtSection.getByText('Aave V4 · Manual entry')).toBeInTheDocument();
    expect(collateralSection.queryByText(/Aave V3/)).not.toBeInTheDocument();
  });

  it('shows "Aave V4 · Waiting for address" on the Collateral section before any manual or live V4 data exists', () => {
    const created = createAndSelect();
    usePortfolioStore.getState().setProtocolVersion(created.id, 'v4');
    render(<PortfolioPage />);

    const collateralSection = within(screen.getByRole('group', { name: 'Collateral' }));
    expect(collateralSection.getByText('Aave V4 · Waiting for address')).toBeInTheDocument();
    expect(collateralSection.queryByText(/Aave V3/)).not.toBeInTheDocument();
  });

  it('shows "Aave V4 · Live" on the Collateral section for a live-synced V4 portfolio, matching the Debt section', () => {
    createAndSelectV4(
      {},
      { drawnDebt: 15000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.01 },
    );
    useAaveV4LiveDataStore.setState(matchingAaveV4LiveState({ status: 'ready' }));
    useAaveV4CollateralRiskLiveDataStore.setState(
      matchingAaveV4CollateralRiskLiveState({ status: 'ready' }),
    );
    render(<PortfolioPage />);

    const collateralSection = within(screen.getByRole('group', { name: 'Collateral' }));
    const debtSection = within(screen.getByRole('group', { name: 'Debt' }));
    expect(collateralSection.getByText('Aave V4 · Live')).toBeInTheDocument();
    expect(debtSection.getByText('Aave V4 · Live')).toBeInTheDocument();
  });

  it('shows "Aave V4 · Stale" (not "Live") on the Collateral section once the last successful fetch is old, matching the Debt section', () => {
    createAndSelectV4(
      {},
      { drawnDebt: 15000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.01 },
    );
    useAaveV4LiveDataStore.setState(
      matchingAaveV4LiveState({
        status: 'ready',
        lastFetchedAt: new Date(Date.now() - 10 * 60_000).toISOString(),
      }),
    );
    useAaveV4CollateralRiskLiveDataStore.setState(
      matchingAaveV4CollateralRiskLiveState({ status: 'ready' }),
    );
    render(<PortfolioPage />);

    const collateralSection = within(screen.getByRole('group', { name: 'Collateral' }));
    expect(collateralSection.getByText('Aave V4 · Stale')).toBeInTheDocument();
    expect(collateralSection.queryByText('Aave V4 · Live')).not.toBeInTheDocument();
  });

  it('a V3 (or unset) portfolio keeps the unchanged V3 badge on the Collateral section — never a V4 label', () => {
    createAndSelect();
    render(<PortfolioPage />);
    const collateralSection = within(screen.getByRole('group', { name: 'Collateral' }));
    expect(collateralSection.getByText('Aave V3 · Live')).toBeInTheDocument();
    expect(collateralSection.queryByText(/Aave V4/)).not.toBeInTheDocument();
  });

  it('a V3 (or unset) portfolio still shows "Aave V3 · Unavailable" on the Collateral section exactly as before this stage', () => {
    createAndSelect();
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
    render(<PortfolioPage />);
    const collateralSection = within(screen.getByRole('group', { name: 'Collateral' }));
    expect(collateralSection.getByText(/Aave V3 · Unavailable/)).toBeInTheDocument();
  });

  it('does not change the displayed Collateral Factor or any collateral/HF calculation — purely the badge label', () => {
    const created = createManualV4Portfolio({
      drawnDebt: 30000,
      premiumDebt: 500,
      baseDrawnApr: 0.05,
      riskPremium: 0.01,
    });
    render(<PortfolioPage />);

    const collateralSection = within(screen.getByRole('group', { name: 'Collateral' }));
    expect(collateralSection.getByText('Collateral Factor')).toBeInTheDocument();
    expect(collateralSection.getByText('75%')).toBeInTheDocument();
    expect(usePortfolioStore.getState().portfolios[created.id].portfolio.v4CollateralRisk).toEqual({
      collateralFactor: 0.75,
      dynamicConfigKey: 0,
    });
  });
});

/**
 * Debt form "Borrow rate" stat — V4 Readiness Audit §12 Stage 15.
 * Previously always `formatPercent(portfolio.protocol.borrowApr)`,
 * showing a legacy V3 scalar for a V4 portfolio regardless of its real
 * synced `v4DebtState`.
 */
describe('PortfolioPage — Debt form Borrow rate stat (Stage 15)', () => {
  it('derives the real V4 rate from synced v4DebtState, not the legacy protocol.borrowApr', () => {
    createAndSelectV4(
      {},
      { drawnDebt: 20000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.1 },
    );
    useAaveV4LiveDataStore.setState(matchingAaveV4LiveState({ status: 'ready' }));
    render(<PortfolioPage />);
    const section = within(screen.getByRole('group', { name: 'Debt' }));
    // Same Stage 10 regression vector: annualCost 1100 / totalDebt 20500 ≈ 5.37%.
    expect(section.getByText('5.37%')).toBeInTheDocument();
    expect(section.queryByText('5%')).not.toBeInTheDocument();
  });

  it('shows "—" (never a stale/fabricated number) when v4DebtState has not synced yet', () => {
    createAndSelectV4();
    useAaveV4LiveDataStore.setState(matchingAaveV4LiveState({ status: 'ready' }));
    render(<PortfolioPage />);
    const section = within(screen.getByRole('group', { name: 'Debt' }));
    expect(section.getByText('Borrow rate').nextElementSibling?.textContent).toBe('—');
  });

  it('a V3 (or unset) portfolio is completely unaffected — still reads protocol.borrowApr directly', () => {
    createAndSelect();
    render(<PortfolioPage />);
    const section = within(screen.getByRole('group', { name: 'Debt' }));
    expect(section.getByText('5%')).toBeInTheDocument();
  });
});

/**
 * V4 borrow/repay action UI — V4 Readiness Audit §12 Stage 13, building
 * on Stage 12's real premium-first repayment allocation.
 */
describe('PortfolioPage — V4 borrow/repay action UI (Stage 13)', () => {
  function v4DebtStateFixture() {
    return {
      drawnDebt: 15000,
      premiumDebt: 5000,
      baseDrawnApr: 0.05,
      riskPremium: 0.01,
      debtAssetPriceUsd: 1.0,
    };
  }

  it('blocks a debt increase (a borrow) with a clear, non-fabricated explanation, without ever calling Apply on a broken preview', async () => {
    createAndSelectV4({ debt: { asset: 'USDC', balance: 20000 } }, v4DebtStateFixture());
    useAaveV4LiveDataStore.setState(matchingAaveV4LiveState({ status: 'ready' }));
    const user = userEvent.setup();
    render(<PortfolioPage />);
    const section = within(screen.getByRole('group', { name: 'Debt' }).closest('form')!);

    await user.clear(section.getByLabelText('Debt amount', { exact: false }));
    await user.type(section.getByLabelText('Debt amount', { exact: false }), '25000');
    await user.click(section.getByRole('button', { name: 'Preview Changes' }));

    expect(
      screen.getByText(/Borrowing preview and apply are not available yet/),
    ).toBeInTheDocument();
    expect(screen.getByText(/risk premium can change/)).toBeInTheDocument();
    const applyButton = section.getByRole('button', { name: 'Apply Changes' });
    expect(applyButton).toBeDisabled();

    const activeId = usePortfolioStore.getState().activePortfolioId!;
    const before = usePortfolioStore.getState().portfolios[activeId].portfolio;
    expect(before.debt.balance).toBe(20000);
    expect(before.v4DebtState).toEqual(v4DebtStateFixture());
  });

  it('a partial V4 repay previews and applies correctly, updating v4DebtState via the real premium-first allocation rule', async () => {
    const created = createAndSelectV4(
      { debt: { asset: 'USDC', balance: 20000 } },
      v4DebtStateFixture(),
    );
    useAaveV4LiveDataStore.setState(matchingAaveV4LiveState({ status: 'ready' }));
    const user = userEvent.setup();
    render(<PortfolioPage />);
    const section = within(screen.getByRole('group', { name: 'Debt' }).closest('form')!);

    // Repay $5,000 — exactly clears the $5,000 premiumDebt (premium-first).
    await user.clear(section.getByLabelText('Debt amount', { exact: false }));
    await user.type(section.getByLabelText('Debt amount', { exact: false }), '15000');
    await user.click(section.getByRole('button', { name: 'Preview Changes' }));

    expect(
      screen.queryByText(/Borrowing preview and apply are not available yet/),
    ).not.toBeInTheDocument();
    const applyButton = section.getByRole('button', { name: 'Apply Changes' });
    expect(applyButton).not.toBeDisabled();

    await user.click(applyButton);

    const after = usePortfolioStore.getState().portfolios[created.id].portfolio;
    expect(after.debt.balance).toBe(15000);
    expect(after.v4DebtState).toEqual({
      drawnDebt: 15000,
      premiumDebt: 0,
      baseDrawnApr: 0.05,
      riskPremium: 0.01,
      // V4 Readiness Audit §12 P1-D3 — a repayment changes debt quantity,
      // never the debt asset's own oracle price; `deriveV4DebtStateAfterDelta`
      // carries the fixture's `debtAssetPriceUsd` through unchanged.
      debtAssetPriceUsd: 1.0,
    });
  });

  it('a full V4 repay to exactly $0 previews and applies a real zero-debt v4DebtState, not a silently-stale one', async () => {
    const created = createAndSelectV4(
      { debt: { asset: 'USDC', balance: 20000 } },
      v4DebtStateFixture(),
    );
    useAaveV4LiveDataStore.setState(matchingAaveV4LiveState({ status: 'ready' }));
    const user = userEvent.setup();
    render(<PortfolioPage />);
    const section = within(screen.getByRole('group', { name: 'Debt' }).closest('form')!);

    await user.clear(section.getByLabelText('Debt amount', { exact: false }));
    await user.type(section.getByLabelText('Debt amount', { exact: false }), '0');
    await user.click(section.getByRole('button', { name: 'Preview Changes' }));
    await user.click(section.getByRole('button', { name: 'Apply Changes' }));

    const after = usePortfolioStore.getState().portfolios[created.id].portfolio;
    expect(after.debt.balance).toBe(0);
    expect(after.v4DebtState).toEqual({
      drawnDebt: 0,
      premiumDebt: 0,
      baseDrawnApr: 0.05,
      riskPremium: 0.01,
      debtAssetPriceUsd: 1.0,
    });
  });

  it('leaving the debt amount unchanged (zero delta) is a genuine no-op — Apply does not touch v4DebtState at all', async () => {
    const created = createAndSelectV4(
      { debt: { asset: 'USDC', balance: 20000 } },
      v4DebtStateFixture(),
    );
    useAaveV4LiveDataStore.setState(matchingAaveV4LiveState({ status: 'ready' }));
    const user = userEvent.setup();
    render(<PortfolioPage />);
    const section = within(screen.getByRole('group', { name: 'Debt' }).closest('form')!);

    await user.click(section.getByRole('button', { name: 'Preview Changes' }));
    await user.click(section.getByRole('button', { name: 'Apply Changes' }));

    const after = usePortfolioStore.getState().portfolios[created.id].portfolio;
    expect(after.v4DebtState).toEqual(v4DebtStateFixture());
  });

  it('V3 debt editing (borrow and repay) remains completely unchanged by this stage', async () => {
    const created = createAndSelect({ debt: { asset: 'USDC', balance: 20000 } });
    const user = userEvent.setup();
    render(<PortfolioPage />);
    const section = within(screen.getByRole('group', { name: 'Debt' }).closest('form')!);

    await user.clear(section.getByLabelText('Debt amount', { exact: false }));
    await user.type(section.getByLabelText('Debt amount', { exact: false }), '30000');
    await user.click(section.getByRole('button', { name: 'Preview Changes' }));

    // A V3 borrow is NOT blocked by any V4-only messaging (it may still
    // require the pre-existing PT-10 risk-acknowledgment checkbox below,
    // which is unrelated to this stage and unchanged).
    expect(
      screen.queryByText(/Borrowing preview and apply are not available yet/),
    ).not.toBeInTheDocument();
    await user.click(section.getByRole('checkbox'));
    await user.click(section.getByRole('button', { name: 'Apply Changes' }));

    expect(usePortfolioStore.getState().portfolios[created.id].portfolio.debt.balance).toBe(30000);
  });
});

/**
 * Debt form canonical seed/delta — V4 Readiness Audit §12 Stage 16.
 * `debt.balance` deliberately disagrees with the real synced
 * `v4DebtState` below, proving the "Debt amount" field seeds from the
 * canonical current total (`resolveCanonicalDebtBalance`) and the edit
 * delta is computed against that same canonical base — the exact bug
 * this stage fixed: a stale seed/base would misinterpret the user's
 * intended edit and repay/derive the wrong amount.
 */
describe('PortfolioPage — Debt form canonical V4 seed/delta (Stage 16)', () => {
  function disagreeingV4DebtState() {
    return {
      drawnDebt: 15000,
      premiumDebt: 500,
      baseDrawnApr: 0.05,
      riskPremium: 0.01,
      debtAssetPriceUsd: 1.0,
    };
  }

  it('seeds the "Debt amount" field from the canonical total (15,500), not the deliberately-disagreeing legacy debt.balance (999,999)', () => {
    createAndSelectV4({ debt: { asset: 'USDC', balance: 999999 } }, disagreeingV4DebtState());
    useAaveV4LiveDataStore.setState(matchingAaveV4LiveState({ status: 'ready' }));
    render(<PortfolioPage />);
    const section = within(screen.getByRole('group', { name: 'Debt' }).closest('form')!);
    expect(section.getByLabelText('Debt amount', { exact: false })).toHaveValue(15500);
  });

  it('an unedited field is a genuine no-op (delta 0) against the canonical base, not a spurious borrow from the stale legacy balance', async () => {
    const created = createAndSelectV4(
      { debt: { asset: 'USDC', balance: 999999 } },
      disagreeingV4DebtState(),
    );
    useAaveV4LiveDataStore.setState(matchingAaveV4LiveState({ status: 'ready' }));
    const user = userEvent.setup();
    render(<PortfolioPage />);
    const section = within(screen.getByRole('group', { name: 'Debt' }).closest('form')!);

    await user.click(section.getByRole('button', { name: 'Preview Changes' }));

    // If the stale 999999 were still used as the base, an unedited field
    // (value 15500) would compute a large negative "repay" delta instead
    // of a true no-op.
    expect(
      screen.queryByText(/Borrowing preview and apply are not available yet/),
    ).not.toBeInTheDocument();
    await user.click(section.getByRole('button', { name: 'Apply Changes' }));

    const after = usePortfolioStore.getState().portfolios[created.id].portfolio;
    expect(after.v4DebtState).toEqual(disagreeingV4DebtState());
  });

  it('a partial repay edit is computed against the canonical base and correctly premium-first allocated', async () => {
    const created = createAndSelectV4(
      { debt: { asset: 'USDC', balance: 999999 } },
      disagreeingV4DebtState(),
    );
    useAaveV4LiveDataStore.setState(matchingAaveV4LiveState({ status: 'ready' }));
    const user = userEvent.setup();
    render(<PortfolioPage />);
    const section = within(screen.getByRole('group', { name: 'Debt' }).closest('form')!);

    // Repay $5,000 from the canonical 15,500 → 10,500 — clears the
    // $500 premiumDebt first, then $4,500 of drawnDebt.
    await user.clear(section.getByLabelText('Debt amount', { exact: false }));
    await user.type(section.getByLabelText('Debt amount', { exact: false }), '10500');
    await user.click(section.getByRole('button', { name: 'Preview Changes' }));
    await user.click(section.getByRole('button', { name: 'Apply Changes' }));

    const after = usePortfolioStore.getState().portfolios[created.id].portfolio;
    expect(after.debt.balance).toBe(10500);
    expect(after.v4DebtState).toEqual({
      drawnDebt: 10500,
      premiumDebt: 0,
      baseDrawnApr: 0.05,
      riskPremium: 0.01,
      debtAssetPriceUsd: 1.0,
    });
  });

  it('a V3 (or unset) portfolio is completely unaffected — the field still seeds from the real legacy debt.balance', () => {
    createAndSelect({ debt: { asset: 'USDC', balance: 20000 } });
    render(<PortfolioPage />);
    const section = within(screen.getByRole('group', { name: 'Debt' }).closest('form')!);
    expect(section.getByLabelText('Debt amount', { exact: false })).toHaveValue(20000);
  });
});

/**
 * Debt form live resynchronization — V4 Readiness Audit §12 Stage 25A.
 * Closes the Manual/Hypothetical V4 audit's own finding: `defaultValues`
 * (Stage 16, above) only ever seeds the "Debt amount" field ONCE, at
 * mount. A manual V4 debt edit made via `ManualAaveV4StateForm` — or a
 * live sync landing after the Debt form has already mounted — changes
 * the real canonical total (`resolveCanonicalDebtBalance`) without this
 * form ever remounting (it only remounts on a portfolio switch), so the
 * field used to silently drift from the real total. `onPreview`'s own
 * `debtDelta` is computed against the always-fresh canonical base, so a
 * stale displayed value used to manufacture a phantom repayment the
 * moment the user clicked Preview/Apply on an otherwise-untouched field.
 */
describe('PortfolioPage — Debt form resyncs to a changed canonical V4 total (Stage 25A)', () => {
  const externalDebtState = {
    drawnDebt: 30000,
    premiumDebt: 500,
    baseDrawnApr: 0.05,
    riskPremium: 0.01,
  };

  function createManualV4Portfolio(initialDebtState?: {
    drawnDebt: number;
    premiumDebt: number;
    baseDrawnApr: number;
    riskPremium: number;
  }) {
    const created = createAndSelect();
    usePortfolioStore.getState().setProtocolVersion(created.id, 'v4');
    if (initialDebtState !== undefined) {
      usePortfolioStore.getState().setAaveV4DebtState(created.id, initialDebtState, 'manual');
    }
    usePortfolioStore
      .getState()
      .setAaveV4CollateralRisk(
        created.id,
        { collateralFactor: 0.8, dynamicConfigKey: 0 },
        'manual',
      );
    return usePortfolioStore.getState().portfolios[created.id].portfolio;
  }

  it('syncs "Debt amount" to the fresh canonical total (30,500) after v4DebtState changes externally, with no remount', () => {
    const created = createManualV4Portfolio();
    render(<PortfolioPage />);
    const section = within(screen.getByRole('group', { name: 'Debt' }).closest('form')!);

    // Simulates ManualAaveV4StateForm's own save — a sibling form on this
    // same page, not a remount of this one.
    act(() => {
      usePortfolioStore.getState().setAaveV4DebtState(created.id, externalDebtState, 'manual');
    });

    expect(section.getByLabelText('Debt amount', { exact: false })).toHaveValue(30500);
  });

  it('Preview immediately after an external sync does not manufacture a repayment (zero delta)', async () => {
    const created = createManualV4Portfolio();
    const user = userEvent.setup();
    render(<PortfolioPage />);
    const section = within(screen.getByRole('group', { name: 'Debt' }).closest('form')!);

    act(() => {
      usePortfolioStore.getState().setAaveV4DebtState(created.id, externalDebtState, 'manual');
    });

    await user.click(section.getByRole('button', { name: 'Preview Changes' }));
    expect(
      screen.queryByText(/Borrowing preview and apply are not available yet/),
    ).not.toBeInTheDocument();
  });

  it('Apply immediately after an external sync cannot overwrite canonical debt with a stale value', async () => {
    // Mirrors the exact reported scenario: the field was seeded at mount
    // from an EARLIER, smaller total (26,000 = 25,500 drawn + 500
    // premium), then the user enters a larger manual total afterward.
    const created = createManualV4Portfolio({
      drawnDebt: 25500,
      premiumDebt: 500,
      baseDrawnApr: 0.05,
      riskPremium: 0.01,
    });
    const user = userEvent.setup();
    render(<PortfolioPage />);
    const section = within(screen.getByRole('group', { name: 'Debt' }).closest('form')!);

    act(() => {
      usePortfolioStore.getState().setAaveV4DebtState(created.id, externalDebtState, 'manual');
    });

    await user.click(section.getByRole('button', { name: 'Preview Changes' }));
    await user.click(section.getByRole('button', { name: 'Apply Changes' }));

    const after = usePortfolioStore.getState().portfolios[created.id].portfolio;
    // Without the fix, a phantom $4,500 "repayment" (30,500 → 26,000,
    // premium-first) would land here instead.
    expect(after.v4DebtState).toEqual(externalDebtState);
    expect(after.v4DebtStateSource).toBe('manual');
  });

  it('a genuine user edit made BEFORE an external sync is never clobbered by that sync — the field keeps the user’s typed value', async () => {
    const created = createManualV4Portfolio({
      drawnDebt: 15000,
      premiumDebt: 500,
      baseDrawnApr: 0.05,
      riskPremium: 0.01,
    });
    const user = userEvent.setup();
    render(<PortfolioPage />);
    const section = within(screen.getByRole('group', { name: 'Debt' }).closest('form')!);

    // A real, in-progress user edit — RHF's dirty tracking is keyed off
    // this, not off the specific typed value.
    await user.clear(section.getByLabelText('Debt amount', { exact: false }));
    await user.type(section.getByLabelText('Debt amount', { exact: false }), '20500');
    expect(section.getByLabelText('Debt amount', { exact: false })).toHaveValue(20500);

    // An external sync now lands mid-edit — the fix must defer to the
    // user's own unsaved edit, not overwrite it.
    act(() => {
      usePortfolioStore.getState().setAaveV4DebtState(created.id, externalDebtState, 'manual');
    });

    expect(section.getByLabelText('Debt amount', { exact: false })).toHaveValue(20500);
  });

  it('an unrelated portfolio update (e.g. renaming) never erases an in-progress Debt amount edit', async () => {
    const created = createManualV4Portfolio({
      drawnDebt: 15000,
      premiumDebt: 500,
      baseDrawnApr: 0.05,
      riskPremium: 0.01,
    });
    const user = userEvent.setup();
    render(<PortfolioPage />);
    const section = within(screen.getByRole('group', { name: 'Debt' }).closest('form')!);

    await user.clear(section.getByLabelText('Debt amount', { exact: false }));
    await user.type(section.getByLabelText('Debt amount', { exact: false }), '9000');

    act(() => {
      usePortfolioStore.getState().update(created.id, { name: 'Renamed Portfolio' });
    });

    expect(section.getByLabelText('Debt amount', { exact: false })).toHaveValue(9000);
  });

  it('a genuine edit made AFTER an external sync still computes the intended delta and premium-first allocation against the NEW canonical base', async () => {
    const created = createManualV4Portfolio();
    const user = userEvent.setup();
    render(<PortfolioPage />);
    const section = within(screen.getByRole('group', { name: 'Debt' }).closest('form')!);

    act(() => {
      usePortfolioStore.getState().setAaveV4DebtState(created.id, externalDebtState, 'manual');
    });
    expect(section.getByLabelText('Debt amount', { exact: false })).toHaveValue(30500);

    // Repay $5,000 off the NEW 30,500 base — clears the $500 premium
    // first, then $4,500 of drawn (premium-first allocation, unchanged).
    await user.clear(section.getByLabelText('Debt amount', { exact: false }));
    await user.type(section.getByLabelText('Debt amount', { exact: false }), '25500');
    await user.click(section.getByRole('button', { name: 'Preview Changes' }));
    await user.click(section.getByRole('button', { name: 'Apply Changes' }));

    const after = usePortfolioStore.getState().portfolios[created.id].portfolio;
    expect(after.v4DebtState).toEqual({
      drawnDebt: 25500,
      premiumDebt: 0,
      baseDrawnApr: 0.05,
      riskPremium: 0.01,
    });
  });

  it('after a successful Apply, the field and canonical debt remain aligned — no redundant/conflicting resync', async () => {
    const created = createManualV4Portfolio(externalDebtState);
    const user = userEvent.setup();
    render(<PortfolioPage />);
    const section = within(screen.getByRole('group', { name: 'Debt' }).closest('form')!);

    await user.clear(section.getByLabelText('Debt amount', { exact: false }));
    await user.type(section.getByLabelText('Debt amount', { exact: false }), '30500');
    await user.click(section.getByRole('button', { name: 'Preview Changes' }));
    await user.click(section.getByRole('button', { name: 'Apply Changes' }));

    const after = usePortfolioStore.getState().portfolios[created.id].portfolio;
    expect(resolveCanonicalDebtBalance(after)).toBe(30500);
    expect(section.getByLabelText('Debt amount', { exact: false })).toHaveValue(30500);
  });

  it('the effective V4 borrow-rate display is unaffected by the resync fix — still 4.97% for 30,000/500/5%/1%', () => {
    const created = createManualV4Portfolio();
    render(<PortfolioPage />);
    const section = within(screen.getByRole('group', { name: 'Debt' }).closest('form')!);

    act(() => {
      usePortfolioStore.getState().setAaveV4DebtState(created.id, externalDebtState, 'manual');
    });

    expect(section.getByText('4.97%')).toBeInTheDocument();
  });

  it('V3 Debt editor behavior is unaffected: an unrelated portfolio update never disturbs an in-progress edit, and the legacy balance still seeds/applies exactly as before', async () => {
    const created = createAndSelect({ debt: { asset: 'USDC', balance: 20000 } });
    const user = userEvent.setup();
    render(<PortfolioPage />);
    const section = within(screen.getByRole('group', { name: 'Debt' }).closest('form')!);

    expect(section.getByLabelText('Debt amount', { exact: false })).toHaveValue(20000);

    await user.clear(section.getByLabelText('Debt amount', { exact: false }));
    await user.type(section.getByLabelText('Debt amount', { exact: false }), '18000');

    act(() => {
      usePortfolioStore.getState().update(created.id, { name: 'Renamed Portfolio' });
    });
    expect(section.getByLabelText('Debt amount', { exact: false })).toHaveValue(18000);

    await user.click(section.getByRole('button', { name: 'Preview Changes' }));
    await user.click(section.getByRole('button', { name: 'Apply Changes' }));

    expect(usePortfolioStore.getState().portfolios[created.id].portfolio.debt.balance).toBe(18000);
  });
});

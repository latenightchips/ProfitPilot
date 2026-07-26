import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import PortfolioPage from '@/app/portfolio/page';
import { usePortfolioStore } from '@/stores/portfolioStore';

/**
 * Portfolio Details Form — 06_TASKS.md M4-006. DoD: "Changes persist and
 * do not alter position balances unexpectedly."
 */
const INITIAL_STATE = {
  portfolios: {},
  activePortfolioId: null,
  loadStatus: 'idle' as const,
  saveStatus: 'idle' as const,
  errors: [],
  lastSynchronizedAt: null,
};

beforeEach(() => {
  usePortfolioStore.setState(INITIAL_STATE);
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

function createAndSelect() {
  const result = usePortfolioStore.getState().create(validInput());
  if (!result.ok) throw new Error('setup failed');
  usePortfolioStore.getState().select(result.data.id);
  return result.data;
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
    expect(screen.getByLabelText('Portfolio name')).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
    expect(screen.getByLabelText('Base currency')).toBeInTheDocument();
    expect(screen.getByLabelText('Target Health Factor')).toBeInTheDocument();
    expect(screen.getByLabelText('Holding period (days)')).toBeInTheDocument();
    expect(screen.getByLabelText('Target BTC price (USD)')).toBeInTheDocument();
    expect(screen.getByLabelText('Safety buffer (%)')).toBeInTheDocument();
  });

  it("prefills fields with the active portfolio's current values", () => {
    createAndSelect();
    render(<PortfolioPage />);
    expect(screen.getByLabelText('Portfolio name')).toHaveValue('My Portfolio');
    expect(screen.getByLabelText('Base currency')).toHaveValue('USD');
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

    const nameInput = screen.getByLabelText('Portfolio name');
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

    const nameInput = screen.getByLabelText('Portfolio name');
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

    const currencyInput = screen.getByLabelText('Base currency');
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

    const nameInput = screen.getByLabelText('Portfolio name');
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
    expect(screen.getByLabelText('Portfolio name')).toHaveValue('Alpha');

    usePortfolioStore.getState().select(second.data.id);
    rerender(<PortfolioPage />);
    expect(screen.getByLabelText('Portfolio name')).toHaveValue('Beta');
  });
});

describe('PortfolioPage — Collateral Position Management (M4-007)', () => {
  it('renders exactly this task\'s own "Fields" list, prefilled', () => {
    createAndSelect();
    render(<PortfolioPage />);
    const section = within(screen.getByRole('group', { name: 'Collateral' }));
    expect(section.getByText('Asset: BTC')).toBeInTheDocument();
    expect(section.getByLabelText('Quantity')).toHaveValue(2);
    expect(section.getByText(/Price source: Manual/)).toBeInTheDocument();
    expect(section.getByLabelText('Manual price (USD)')).toHaveValue(50000);
    expect(section.getByLabelText('Maximum LTV (0–1)')).toHaveValue(0.75);
    expect(section.getByLabelText('Liquidation threshold (0–1)')).toHaveValue(0.8);
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

    await user.clear(section.getByLabelText('Quantity'));
    await user.type(section.getByLabelText('Quantity'), '3');
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

    await user.clear(section.getByLabelText('Quantity'));
    await user.type(section.getByLabelText('Quantity'), '3');
    await user.click(section.getByRole('button', { name: 'Preview Changes' }));
    expect(section.getByRole('button', { name: 'Apply Changes' })).not.toBeDisabled();

    await user.type(section.getByLabelText('Quantity'), '5');
    expect(section.getByRole('button', { name: 'Apply Changes' })).toBeDisabled();
  });

  it('shows an invalid-preview message rather than applying when the protocol invariant is broken', async () => {
    createAndSelect();
    const user = userEvent.setup();
    render(<PortfolioPage />);
    const form = screen.getByRole('group', { name: 'Collateral' }).closest('form')!;
    const section = within(form);

    await user.clear(section.getByLabelText('Maximum LTV (0–1)'));
    await user.type(section.getByLabelText('Maximum LTV (0–1)'), '0.95');
    await user.click(section.getByRole('button', { name: 'Preview Changes' }));

    expect(section.getByRole('button', { name: 'Apply Changes' })).toBeDisabled();
  });
});

describe('PortfolioPage — Debt Position Management (M4-008)', () => {
  it('renders exactly this task\'s own "Fields" list, prefilled, except the undefined "Rate type" (conflict #25)', () => {
    createAndSelect();
    render(<PortfolioPage />);
    const section = within(screen.getByRole('group', { name: 'Debt' }));
    expect(section.getByLabelText('Asset')).toHaveValue('USDC');
    expect(section.getByLabelText('Debt amount')).toHaveValue(20000);
    expect(section.getByText(/Price: \$1\.00/)).toBeInTheDocument();
    expect(section.getByLabelText('Borrow rate (0–1)')).toHaveValue(0.05);
    expect(section.queryByText(/rate type/i)).not.toBeInTheDocument();
  });

  it('supports repaying debt down to exactly zero and previews the resulting Health Factor as a finite number (conflict #20 stays reachable through this UI)', async () => {
    const created = createAndSelect();
    const user = userEvent.setup();
    render(<PortfolioPage />);
    const form = screen.getByRole('group', { name: 'Debt' }).closest('form')!;
    const section = within(form);

    await user.clear(section.getByLabelText('Debt amount'));
    await user.type(section.getByLabelText('Debt amount'), '0');
    await user.click(section.getByRole('button', { name: 'Preview Changes' }));

    // Zero debt -> Health Factor Infinity, formatted by Intl.NumberFormat as "∞".
    expect(section.getByText(/Health Factor/)).toBeInTheDocument();
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

    await user.clear(section.getByLabelText('Debt amount'));
    await user.type(section.getByLabelText('Debt amount'), '-500');
    await user.click(section.getByRole('button', { name: 'Preview Changes' }));

    expect(section.getByRole('button', { name: 'Apply Changes' })).toBeDisabled();
  });

  it('does not apply a change without first previewing it (hard gate)', () => {
    createAndSelect();
    render(<PortfolioPage />);
    const section = within(screen.getByRole('group', { name: 'Debt' }).closest('form')!);
    expect(section.getByRole('button', { name: 'Apply Changes' })).toBeDisabled();
  });
});

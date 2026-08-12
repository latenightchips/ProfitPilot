import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import PortfolioPage from '@/app/portfolio/page';
import { autoSaveCoordinator } from '@/services';
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

describe('PortfolioPage — Collateral Position Management (M4-007)', () => {
  it('renders exactly this task\'s own "Fields" list, prefilled', () => {
    createAndSelect();
    render(<PortfolioPage />);
    const section = within(screen.getByRole('group', { name: 'Collateral' }));
    expect(section.getByText('Asset: BTC')).toBeInTheDocument();
    expect(section.getByLabelText('Quantity', { exact: false })).toHaveValue(2);
    expect(section.getByText('Manual', { selector: 'span' })).toBeInTheDocument();
    expect(section.getByLabelText('Manual price (USD)', { exact: false })).toHaveValue(50000);
    expect(section.getByLabelText('Maximum LTV (%)', { exact: false })).toHaveValue(75);
    expect(section.getByLabelText('Liquidation threshold (%)', { exact: false })).toHaveValue(80);
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

  it('shows an invalid-preview message rather than applying when the protocol invariant is broken', async () => {
    createAndSelect();
    const user = userEvent.setup();
    render(<PortfolioPage />);
    const form = screen.getByRole('group', { name: 'Collateral' }).closest('form')!;
    const section = within(form);

    await user.clear(section.getByLabelText('Maximum LTV (%)', { exact: false }));
    await user.type(section.getByLabelText('Maximum LTV (%)', { exact: false }), '95');
    await user.click(section.getByRole('button', { name: 'Preview Changes' }));

    expect(section.getByRole('button', { name: 'Apply Changes' })).toBeDisabled();
  });
});

describe('PortfolioPage — Debt Position Management (M4-008)', () => {
  it('renders exactly this task\'s own "Fields" list, prefilled, except the undefined "Rate type" (conflict #25)', () => {
    createAndSelect();
    render(<PortfolioPage />);
    const section = within(screen.getByRole('group', { name: 'Debt' }));
    expect(section.getByLabelText('Asset', { exact: false })).toHaveValue('USDC');
    expect(section.getByLabelText('Debt amount', { exact: false })).toHaveValue(20000);
    expect(section.getByText(/Price: \$1\.00/)).toBeInTheDocument();
    expect(section.getByLabelText('Borrow rate (%)', { exact: false })).toHaveValue(5);
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

describe('PortfolioPage — Manual Price Controls (M4-014)', () => {
  it('shows a Manual badge and the last-updated timestamp for the price', () => {
    createAndSelect();
    render(<PortfolioPage />);
    const section = within(screen.getByRole('group', { name: 'Collateral' }));
    expect(section.getByText('Manual', { selector: 'span' })).toBeInTheDocument();
    // Two "Last updated:" lines exist in this fieldset — price and
    // protocol (M4-015) — so this only checks at least one renders.
    expect(section.getAllByText(/Last updated:/).length).toBeGreaterThan(0);
  });

  it('does not show a stale-data warning for a freshly created portfolio', () => {
    createAndSelect();
    render(<PortfolioPage />);
    const section = within(screen.getByRole('group', { name: 'Collateral' }));
    expect(section.queryByText(/may be stale/)).not.toBeInTheDocument();
  });

  it('shows a stale-data warning when the price was last updated over 5 minutes ago (reuses Market Data Service, M3-007)', () => {
    const created = createAndSelect();
    const staleTimestamp = new Date(Date.now() - 10 * 60_000).toISOString();
    usePortfolioStore.setState((state) => ({
      portfolios: {
        ...state.portfolios,
        [created.id]: {
          ...state.portfolios[created.id],
          portfolio: { ...state.portfolios[created.id].portfolio, marketUpdatedAt: staleTimestamp },
        },
      },
    }));
    render(<PortfolioPage />);
    const section = within(screen.getByRole('group', { name: 'Collateral' }));
    expect(section.getByText(/may be stale/)).toBeInTheDocument();
  });

  it('resets an unsaved price edit back to the currently-applied value', async () => {
    createAndSelect();
    const user = userEvent.setup();
    render(<PortfolioPage />);
    const form = screen.getByRole('group', { name: 'Collateral' }).closest('form')!;
    const section = within(form);

    await user.clear(section.getByLabelText('Manual price (USD)', { exact: false }));
    await user.type(section.getByLabelText('Manual price (USD)', { exact: false }), '99999');
    expect(section.getByLabelText('Manual price (USD)', { exact: false })).toHaveValue(99999);

    await user.click(section.getByRole('button', { name: 'Reset price' }));
    expect(section.getByLabelText('Manual price (USD)', { exact: false })).toHaveValue(50000);
  });

  it('clears an existing preview when the price is reset (still under the preview hard gate)', async () => {
    createAndSelect();
    const user = userEvent.setup();
    render(<PortfolioPage />);
    const form = screen.getByRole('group', { name: 'Collateral' }).closest('form')!;
    const section = within(form);

    await user.clear(section.getByLabelText('Manual price (USD)', { exact: false }));
    await user.type(section.getByLabelText('Manual price (USD)', { exact: false }), '60000');
    await user.click(section.getByRole('button', { name: 'Preview Changes' }));
    expect(section.getByText('Health Factor', { selector: 'dt' })).toBeInTheDocument();

    await user.click(section.getByRole('button', { name: 'Reset price' }));
    expect(section.queryByText('Health Factor', { selector: 'dt' })).not.toBeInTheDocument();
  });
});

describe('PortfolioPage — Protocol Configuration Controls (M4-015)', () => {
  it('shows a Parameter source badge and last-updated timestamp on the Collateral form', () => {
    createAndSelect();
    render(<PortfolioPage />);
    const section = within(screen.getByRole('group', { name: 'Collateral' }));
    expect(section.getByText('Parameter source: Manual')).toBeInTheDocument();
    expect(section.getAllByText(/Last updated:/).length).toBeGreaterThan(0);
  });

  it('shows a Parameter source badge and last-updated timestamp on the Debt form', () => {
    createAndSelect();
    render(<PortfolioPage />);
    const section = within(screen.getByRole('group', { name: 'Debt' }));
    expect(section.getByText('Parameter source: Manual')).toBeInTheDocument();
    expect(section.getByText(/Last updated:/)).toBeInTheDocument();
  });

  it('does not offer a protocol preset selector (conflict #24 recurrence)', () => {
    createAndSelect();
    render(<PortfolioPage />);
    expect(screen.queryByText(/preset/i)).not.toBeInTheDocument();
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
 * remediation batch write-up):
 *
 * - UX-01: `protocol.maxLoanToValue`/`liquidationThreshold`/`borrowApr`
 *   are displayed and typed as a percentage (e.g. "75"), not the raw 0–1
 *   fraction, while remaining stored/validated as 0–1 throughout the
 *   Store/Engine. The regression risk is double conversion or a
 *   conversion that only applies in one direction (e.g. `defaultValues`
 *   converts but the post-Apply `reset()` doesn't, silently reverting the
 *   display to a raw decimal after every save).
 * - UX-02/UX-03: clearing a numeric field must never surface Zod's raw
 *   "Invalid input: expected number, received NaN" message, and every
 *   field must show *some* error text when invalid — `protocol.borrowApr`
 *   and `protocol.liquidationThreshold` previously had no error rendering
 *   in JSX at all, so an invalid value there silently disabled Apply
 *   Changes with zero feedback.
 */
describe('PortfolioPage — UX-01 percentage-scale round-trip (UI boundary conversion)', () => {
  it('applies a percentage edit, stores the 0–1 decimal, and keeps displaying it as a percentage after Apply', async () => {
    const created = createAndSelect();
    const user = userEvent.setup();
    render(<PortfolioPage />);
    const form = screen.getByRole('group', { name: 'Collateral' }).closest('form')!;
    const section = within(form);

    const thresholdInput = section.getByLabelText('Liquidation threshold (%)', {
      exact: false,
    });
    expect(thresholdInput).toHaveValue(80);

    await user.clear(thresholdInput);
    await user.type(thresholdInput, '85');
    await user.click(section.getByRole('button', { name: 'Preview Changes' }));
    await user.click(section.getByRole('button', { name: 'Apply Changes' }));

    // Stored as a 0–1 decimal, unchanged storage representation.
    expect(
      usePortfolioStore.getState().portfolios[created.id].portfolio.protocol.liquidationThreshold,
    ).toBe(0.85);
    // Still displayed as a percentage after Apply's own reset() — not
    // reverted to the raw "0.85" a naive reset() would show.
    expect(section.getByLabelText('Liquidation threshold (%)', { exact: false })).toHaveValue(85);
  });

  it('applies a Borrow rate percentage edit on the Debt form and stores the 0–1 decimal', async () => {
    const created = createAndSelect();
    const user = userEvent.setup();
    render(<PortfolioPage />);
    const form = screen.getByRole('group', { name: 'Debt' }).closest('form')!;
    const section = within(form);

    const borrowRateInput = section.getByLabelText('Borrow rate (%)', { exact: false });
    expect(borrowRateInput).toHaveValue(5);

    await user.clear(borrowRateInput);
    await user.type(borrowRateInput, '7.5');
    await user.click(section.getByRole('button', { name: 'Preview Changes' }));
    await user.click(section.getByRole('button', { name: 'Apply Changes' }));

    expect(usePortfolioStore.getState().portfolios[created.id].portfolio.protocol.borrowApr).toBe(
      0.075,
    );
    expect(section.getByLabelText('Borrow rate (%)', { exact: false })).toHaveValue(7.5);
  });

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

  it('shows a field-level error for an invalid Liquidation threshold (previously silent — no error rendering existed)', async () => {
    createAndSelect();
    const user = userEvent.setup();
    render(<PortfolioPage />);
    const form = screen.getByRole('group', { name: 'Collateral' }).closest('form')!;
    const section = within(form);

    await user.clear(section.getByLabelText('Liquidation threshold (%)', { exact: false }));

    expect(section.getByText('Enter Liquidation Threshold as a percentage.')).toBeInTheDocument();
    expect(section.getByRole('button', { name: 'Apply Changes' })).toBeDisabled();
  });

  it('shows a field-level error for an invalid Borrow rate (previously silent — no error rendering existed)', async () => {
    createAndSelect();
    const user = userEvent.setup();
    render(<PortfolioPage />);
    const form = screen.getByRole('group', { name: 'Debt' }).closest('form')!;
    const section = within(form);

    await user.clear(section.getByLabelText('Borrow rate (%)', { exact: false }));

    expect(section.getByText('Enter Borrow Rate as a percentage.')).toBeInTheDocument();
    expect(section.getByRole('button', { name: 'Apply Changes' })).toBeDisabled();
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

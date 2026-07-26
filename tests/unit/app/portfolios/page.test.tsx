import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import PortfoliosPage from '@/app/portfolios/page';
import { usePortfolioStore } from '@/stores/portfolioStore';

/**
 * Portfolio List Page — 06_TASKS.md M4-004 — and its M4-016 empty
 * states, folded into the same page (see `app/portfolios/page.tsx`'s
 * own header comment for why).
 */
const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

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
  push.mockClear();
});

function validInput(overrides: Partial<ReturnType<typeof baseInput>> = {}) {
  return { ...baseInput(), ...overrides };
}

function baseInput() {
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
  };
}

describe('PortfoliosPage — no portfolios (M4-016 "No portfolios")', () => {
  it('shows the empty state with a Create action', () => {
    render(<PortfoliosPage />);
    expect(screen.getByText('No portfolios yet')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Create Portfolio' }).length).toBeGreaterThan(0);
  });
});

describe('PortfoliosPage — with portfolios (M4-004)', () => {
  it('displays name, net equity, health factor, debt, and last updated for each portfolio', () => {
    usePortfolioStore.getState().create(validInput({ name: 'Alpha' }));
    render(<PortfoliosPage />);

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText(/Net Equity: \$80,000/)).toBeInTheDocument();
    expect(screen.getByText(/Health Factor: 4/)).toBeInTheDocument();
    expect(screen.getByText(/Debt: \$20,000/)).toBeInTheDocument();
    expect(screen.getByText(/Updated/)).toBeInTheDocument();
  });

  it('displays the global storage status on every row (Conflict B; real "saved" transitions added in M4-013)', () => {
    usePortfolioStore.getState().create(validInput({ name: 'Alpha' }));
    render(<PortfoliosPage />);
    expect(screen.getByText(/Storage: saved/)).toBeInTheDocument();
  });

  it('selecting a portfolio updates the store and navigates to /portfolio', async () => {
    const created = usePortfolioStore.getState().create(validInput({ name: 'Alpha' }));
    if (!created.ok) throw new Error('setup failed');
    render(<PortfoliosPage />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Alpha/ }));

    expect(usePortfolioStore.getState().activePortfolioId).toBe(created.data.id);
    expect(push).toHaveBeenCalledWith('/portfolio');
  });

  it('shows a "No collateral" badge for a zero-quantity collateral portfolio (Conflict A)', () => {
    usePortfolioStore
      .getState()
      .create(validInput({ name: 'Zero Collateral', collateral: { asset: 'BTC', quantity: 0 } }));
    render(<PortfoliosPage />);
    expect(screen.getByText('No collateral')).toBeInTheDocument();
  });

  it('shows a "No debt" badge for a zero-balance debt portfolio (conflict #20 stays reachable end to end)', () => {
    usePortfolioStore
      .getState()
      .create(validInput({ name: 'Zero Debt', debt: { asset: 'USDC', balance: 0 } }));
    render(<PortfoliosPage />);
    expect(screen.getByText('No debt')).toBeInTheDocument();
    // conflict #20 resolved: a null liquidation summary still renders a
    // usable Health Factor, not a calculation-failure state.
    expect(screen.queryByText(/Unable to calculate/)).not.toBeInTheDocument();
  });

  it('does not show either badge for a fully-funded portfolio', () => {
    usePortfolioStore.getState().create(validInput({ name: 'Funded' }));
    render(<PortfoliosPage />);
    expect(screen.queryByText('No collateral')).not.toBeInTheDocument();
    expect(screen.queryByText('No debt')).not.toBeInTheDocument();
  });

  it('lists more recently updated portfolios first', () => {
    const first = usePortfolioStore.getState().create(validInput({ name: 'First' }));
    const second = usePortfolioStore.getState().create(validInput({ name: 'Second' }));
    if (!first.ok || !second.ok) throw new Error('setup failed');
    // Two synchronous creates can land on the same millisecond timestamp
    // — set distinct updatedAt values directly for a deterministic sort.
    usePortfolioStore.setState((state) => ({
      portfolios: {
        ...state.portfolios,
        [first.data.id]: {
          ...state.portfolios[first.data.id],
          portfolio: {
            ...state.portfolios[first.data.id].portfolio,
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        },
        [second.data.id]: {
          ...state.portfolios[second.data.id],
          portfolio: {
            ...state.portfolios[second.data.id].portfolio,
            updatedAt: '2026-01-02T00:00:00.000Z',
          },
        },
      },
    }));

    render(<PortfoliosPage />);
    const buttons = screen.getAllByRole('button', { name: /^(First|Second)/ });
    const names = buttons.map((button) => button.textContent);
    expect(names[0]).toContain('Second');
    expect(names[1]).toContain('First');
  });
});

describe('PortfoliosPage — error state (M4-004)', () => {
  it('displays store errors', () => {
    usePortfolioStore.setState({
      errors: [{ category: 'validation', code: 'PORTFOLIO_NOT_FOUND', message: 'Not found.' }],
    });
    render(<PortfoliosPage />);
    expect(screen.getByText('Not found.')).toBeInTheDocument();
  });
});

describe('PortfoliosPage — loading state (M4-004)', () => {
  it('displays a loading indicator whenever loadStatus is loading', () => {
    // `load()`'s own mount effect resolves 'loading' -> 'idle'
    // synchronously (Conflict B — there is nothing to await), so this
    // sets the state directly afterward to verify the JSX reacts
    // correctly to the loading branch, rather than relying on the
    // instantaneous real transition.
    render(<PortfoliosPage />);
    act(() => {
      usePortfolioStore.setState({ loadStatus: 'loading' });
    });
    expect(screen.getByRole('status')).toHaveTextContent(/loading/i);
  });
});

describe('PortfoliosPage — Duplication (M4-011)', () => {
  it('creates an independent copy with an appended name when Duplicate is clicked', async () => {
    usePortfolioStore.getState().create(validInput({ name: 'Alpha' }));
    render(<PortfoliosPage />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Duplicate' }));

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Alpha (Copy)')).toBeInTheDocument();
    expect(Object.keys(usePortfolioStore.getState().portfolios)).toHaveLength(2);
  });
});

describe('PortfoliosPage — Archive and Unarchive (M4-012)', () => {
  it('moves an archived portfolio out of the main list and into "Show archived"', async () => {
    usePortfolioStore.getState().create(validInput({ name: 'Alpha' }));
    render(<PortfoliosPage />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Archive' }));

    expect(screen.queryByRole('button', { name: /^Alpha/ })).not.toBeInTheDocument();
    expect(screen.getByText('Show archived (1)')).toBeInTheDocument();
  });

  it('reveals archived portfolios as non-selectable rows once expanded', async () => {
    const created = usePortfolioStore.getState().create(validInput({ name: 'Alpha' }));
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().archive(created.data.id);
    render(<PortfoliosPage />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Show archived (1)' }));

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Archived')).toBeInTheDocument();
    // Archived rows are not a select control — no button carries the
    // portfolio's own name as its accessible name.
    expect(screen.queryByRole('button', { name: /^Alpha/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unarchive' })).toBeInTheDocument();
  });

  it('restores an archived portfolio to the active list when Unarchive is clicked', async () => {
    const created = usePortfolioStore.getState().create(validInput({ name: 'Alpha' }));
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().archive(created.data.id);
    render(<PortfoliosPage />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Show archived (1)' }));

    await user.click(screen.getByRole('button', { name: 'Unarchive' }));

    expect(screen.getByRole('button', { name: /^Alpha/ })).toBeInTheDocument();
    expect(screen.queryByText('Show archived')).not.toBeInTheDocument();
  });

  it('shows an "all archived" message instead of the main list when every portfolio is archived', () => {
    const created = usePortfolioStore.getState().create(validInput({ name: 'Alpha' }));
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().archive(created.data.id);
    render(<PortfoliosPage />);

    expect(screen.getByText(/All portfolios are archived/)).toBeInTheDocument();
  });
});

describe('PortfoliosPage — Delete (M4-012)', () => {
  it('requires confirmation and explains consequences before deleting', async () => {
    usePortfolioStore.getState().create(validInput({ name: 'Alpha' }));
    render(<PortfoliosPage />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(screen.getByText(/Delete .Alpha.\?/)).toBeInTheDocument();
    expect(screen.getByText(/permanently removes the portfolio/)).toBeInTheDocument();
    expect(Object.keys(usePortfolioStore.getState().portfolios)).toHaveLength(1);
  });

  it('cancels without deleting', async () => {
    usePortfolioStore.getState().create(validInput({ name: 'Alpha' }));
    render(<PortfoliosPage />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText(/Delete .Alpha.\?/)).not.toBeInTheDocument();
    expect(Object.keys(usePortfolioStore.getState().portfolios)).toHaveLength(1);
  });

  it('deletes a non-active portfolio directly, with no replacement selector shown', async () => {
    const active = usePortfolioStore.getState().create(validInput({ name: 'Active' }));
    usePortfolioStore.getState().create(validInput({ name: 'Other' }));
    if (!active.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(active.data.id);
    render(<PortfoliosPage />);
    const user = userEvent.setup();

    const otherRow = screen.getByText('Other').closest('li');
    if (otherRow === null) throw new Error('row not found');
    await user.click(within(otherRow).getByRole('button', { name: 'Delete' }));

    expect(screen.queryByLabelText('Replacement portfolio')).not.toBeInTheDocument();
    await user.click(within(otherRow).getByRole('button', { name: 'Confirm Delete' }));

    expect(screen.queryByText('Other')).not.toBeInTheDocument();
    expect(usePortfolioStore.getState().activePortfolioId).toBe(active.data.id);
  });

  it('requires selecting a replacement before deleting the active portfolio, when another exists', async () => {
    const active = usePortfolioStore.getState().create(validInput({ name: 'Active' }));
    const other = usePortfolioStore.getState().create(validInput({ name: 'Other' }));
    if (!active.ok || !other.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(active.data.id);
    render(<PortfoliosPage />);
    const user = userEvent.setup();

    const activeRow = screen.getByText('Active').closest('li');
    if (activeRow === null) throw new Error('row not found');
    await user.click(within(activeRow).getByRole('button', { name: 'Delete' }));

    const confirmButton = within(activeRow).getByRole('button', { name: 'Confirm Delete' });
    expect(confirmButton).toBeDisabled();

    await user.selectOptions(
      within(activeRow).getByLabelText('Replacement portfolio'),
      other.data.id,
    );
    expect(confirmButton).toBeEnabled();
    await user.click(confirmButton);

    expect(screen.queryByText('Active')).not.toBeInTheDocument();
    expect(usePortfolioStore.getState().activePortfolioId).toBe(other.data.id);
  });

  it('allows deleting the active portfolio directly when no other active portfolio exists', async () => {
    const created = usePortfolioStore.getState().create(validInput({ name: 'Alpha' }));
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);
    render(<PortfoliosPage />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByText(/no other active portfolio is available/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Replacement portfolio')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Confirm Delete' }));

    expect(usePortfolioStore.getState().activePortfolioId).toBeNull();
    expect(Object.keys(usePortfolioStore.getState().portfolios)).toHaveLength(0);
  });
});

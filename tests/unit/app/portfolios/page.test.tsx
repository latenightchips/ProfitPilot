import { act, render, screen } from '@testing-library/react';
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

  it('displays the global storage status on every row (Conflict B)', () => {
    usePortfolioStore.getState().create(validInput({ name: 'Alpha' }));
    render(<PortfoliosPage />);
    expect(screen.getByText(/Storage: idle/)).toBeInTheDocument();
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
    const buttons = screen.getAllByRole('button');
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

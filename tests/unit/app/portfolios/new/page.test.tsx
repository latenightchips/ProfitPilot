import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import NewPortfolioPage from '@/app/portfolios/new/page';
import { usePortfolioStore } from '@/stores/portfolioStore';

/**
 * Portfolio Creation Flow — 06_TASKS.md M4-005. DoD: "A valid portfolio
 * is created, selected, calculated, and saved."
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

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Portfolio name'), 'My Portfolio');
  await user.clear(screen.getByLabelText('BTC quantity'));
  await user.type(screen.getByLabelText('BTC quantity'), '2');
  await user.selectOptions(screen.getByLabelText('Debt asset'), 'USDC');
  await user.clear(screen.getByLabelText('Debt balance'));
  await user.type(screen.getByLabelText('Debt balance'), '20000');
  await user.clear(screen.getByLabelText('Current BTC price (USD)'));
  await user.type(screen.getByLabelText('Current BTC price (USD)'), '50000');
  await user.clear(screen.getByLabelText('Maximum LTV (0–1)'));
  await user.type(screen.getByLabelText('Maximum LTV (0–1)'), '0.75');
  await user.clear(screen.getByLabelText('Liquidation threshold (0–1)'));
  await user.type(screen.getByLabelText('Liquidation threshold (0–1)'), '0.8');
  await user.clear(screen.getByLabelText('Borrow APR (0–1)'));
  await user.type(screen.getByLabelText('Borrow APR (0–1)'), '0.05');
  await user.clear(screen.getByLabelText('Supply APR (0–1)'));
  await user.type(screen.getByLabelText('Supply APR (0–1)'), '0.02');
}

describe('NewPortfolioPage — Portfolio Creation Flow (M4-005)', () => {
  it('collects exactly this task\'s own "Collect" list', () => {
    render(<NewPortfolioPage />);
    expect(screen.getByLabelText('Portfolio name')).toBeInTheDocument();
    expect(screen.getByLabelText('Base currency')).toBeInTheDocument();
    expect(screen.getByLabelText('BTC quantity')).toBeInTheDocument();
    expect(screen.getByLabelText('Debt asset')).toBeInTheDocument();
    expect(screen.getByLabelText('Debt balance')).toBeInTheDocument();
    expect(screen.getByLabelText('Current BTC price (USD)')).toBeInTheDocument();
    expect(screen.getByLabelText('Maximum LTV (0–1)')).toBeInTheDocument();
    expect(screen.getByLabelText('Liquidation threshold (0–1)')).toBeInTheDocument();
    expect(screen.getByLabelText('Borrow APR (0–1)')).toBeInTheDocument();
    expect(screen.getByLabelText('Supply APR (0–1)')).toBeInTheDocument();
    expect(screen.getByLabelText('Target Health Factor')).toBeInTheDocument();
    expect(screen.getByLabelText('Holding period (days)')).toBeInTheDocument();
    expect(screen.getByLabelText('Target BTC price (USD)')).toBeInTheDocument();
    expect(screen.getByLabelText('Safety buffer (%)')).toBeInTheDocument();
  });

  it('does not offer a protocol preset option (documented gap, conflict — no values exist anywhere)', () => {
    render(<NewPortfolioPage />);
    expect(screen.getByText(/no preset available/i)).toBeInTheDocument();
  });

  it('creates, selects, and navigates to the portfolio on valid submission (DoD)', async () => {
    const user = userEvent.setup();
    render(<NewPortfolioPage />);
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Create Portfolio' }));

    const portfolios = Object.values(usePortfolioStore.getState().portfolios);
    expect(portfolios).toHaveLength(1);
    expect(portfolios[0].portfolio.name).toBe('My Portfolio');
    // "calculated": the summary is computed and cached as part of create().
    expect(portfolios[0].summary.ok).toBe(true);
    // "selected":
    expect(usePortfolioStore.getState().activePortfolioId).toBe(portfolios[0].portfolio.id);
    // "saved" (Conflict B: saved = committed to the in-memory Store) and opened:
    expect(push).toHaveBeenCalledWith('/portfolio');
  });

  it('rejects submission with an empty required name and does not create a portfolio', async () => {
    const user = userEvent.setup();
    render(<NewPortfolioPage />);
    await fillValidForm(user);
    await user.clear(screen.getByLabelText('Portfolio name'));
    await user.click(screen.getByRole('button', { name: 'Create Portfolio' }));

    expect(Object.keys(usePortfolioStore.getState().portfolios)).toHaveLength(0);
    expect(push).not.toHaveBeenCalled();
  });

  it('rejects a protocol invariant violation (maxLoanToValue > liquidationThreshold)', async () => {
    const user = userEvent.setup();
    render(<NewPortfolioPage />);
    await fillValidForm(user);
    await user.clear(screen.getByLabelText('Maximum LTV (0–1)'));
    await user.type(screen.getByLabelText('Maximum LTV (0–1)'), '0.9');
    await user.click(screen.getByRole('button', { name: 'Create Portfolio' }));

    expect(Object.keys(usePortfolioStore.getState().portfolios)).toHaveLength(0);
    expect(push).not.toHaveBeenCalled();
  });

  it("shows the Store's own error and does not navigate if create() itself fails (defense-in-depth fallback)", async () => {
    // Client-side (zodResolver) validation passes for this data; this
    // exercises the fallback path for when the Store's own re-validation
    // fails anyway — a defensive branch, not normally reachable through
    // the UI alone since both layers share the identical schema.
    usePortfolioStore.setState({
      create: () => ({
        ok: false,
        errors: [{ category: 'validation', code: 'TEST_FAILURE', message: 'Simulated failure.' }],
      }),
    });
    const user = userEvent.setup();
    render(<NewPortfolioPage />);
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Create Portfolio' }));

    expect(screen.getByText('Simulated failure.')).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});

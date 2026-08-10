import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import NewPortfolioPage from '@/app/portfolios/new/page';
import { usePortfolioStore } from '@/stores/portfolioStore';

/**
 * Portfolio Creation Flow — 06_TASKS.md M4-005. DoD: "A valid portfolio
 * is created, selected, calculated, and saved."
 *
 * **Every `getByLabelText` call below passes `{ exact: false }` (M9-026
 * "Audit Form Accessibility")** — required fields now render a trailing
 * `<RequiredMark />` (`app/portfolios/new/NewPortfolioPageClient.tsx`'s
 * own header comment) inside each `<label>`, which becomes part of the
 * label's computed text content (e.g. "Portfolio name *"). An exact
 * match against the old, marker-less string would fail for every
 * required field; `{ exact: false }` matches the original text as a
 * substring instead, unaffected by whether a given field is required.
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
  await user.type(screen.getByLabelText('Portfolio name', { exact: false }), 'My Portfolio');
  await user.clear(screen.getByLabelText('BTC quantity', { exact: false }));
  await user.type(screen.getByLabelText('BTC quantity', { exact: false }), '2');
  await user.selectOptions(screen.getByLabelText('Debt asset', { exact: false }), 'USDC');
  await user.clear(screen.getByLabelText('Debt balance', { exact: false }));
  await user.type(screen.getByLabelText('Debt balance', { exact: false }), '20000');
  await user.clear(screen.getByLabelText('Current BTC price (USD)', { exact: false }));
  await user.type(screen.getByLabelText('Current BTC price (USD)', { exact: false }), '50000');
  await user.clear(screen.getByLabelText('Maximum LTV (%)', { exact: false }));
  await user.type(screen.getByLabelText('Maximum LTV (%)', { exact: false }), '75');
  await user.clear(screen.getByLabelText('Liquidation threshold (%)', { exact: false }));
  await user.type(screen.getByLabelText('Liquidation threshold (%)', { exact: false }), '80');
  await user.clear(screen.getByLabelText('Borrow APR (%)', { exact: false }));
  await user.type(screen.getByLabelText('Borrow APR (%)', { exact: false }), '5');
  await user.clear(screen.getByLabelText('Supply APR (%)', { exact: false }));
  await user.type(screen.getByLabelText('Supply APR (%)', { exact: false }), '2');
}

describe('NewPortfolioPage — Portfolio Creation Flow (M4-005)', () => {
  it('collects exactly this task\'s own "Collect" list', () => {
    render(<NewPortfolioPage />);
    expect(screen.getByLabelText('Portfolio name', { exact: false })).toBeInTheDocument();
    expect(screen.getByLabelText('Base currency', { exact: false })).toBeInTheDocument();
    expect(screen.getByLabelText('BTC quantity', { exact: false })).toBeInTheDocument();
    expect(screen.getByLabelText('Debt asset', { exact: false })).toBeInTheDocument();
    expect(screen.getByLabelText('Debt balance', { exact: false })).toBeInTheDocument();
    expect(screen.getByLabelText('Current BTC price (USD)', { exact: false })).toBeInTheDocument();
    expect(screen.getByLabelText('Maximum LTV (%)', { exact: false })).toBeInTheDocument();
    expect(
      screen.getByLabelText('Liquidation threshold (%)', { exact: false }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Borrow APR (%)', { exact: false })).toBeInTheDocument();
    expect(screen.getByLabelText('Supply APR (%)', { exact: false })).toBeInTheDocument();
    expect(screen.getByLabelText('Target Health Factor', { exact: false })).toBeInTheDocument();
    expect(screen.getByLabelText('Holding period (days)', { exact: false })).toBeInTheDocument();
    expect(screen.getByLabelText('Target BTC price (USD)', { exact: false })).toBeInTheDocument();
    expect(screen.getByLabelText('Safety buffer (%)', { exact: false })).toBeInTheDocument();
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
    await user.clear(screen.getByLabelText('Portfolio name', { exact: false }));
    await user.click(screen.getByRole('button', { name: 'Create Portfolio' }));

    expect(Object.keys(usePortfolioStore.getState().portfolios)).toHaveLength(0);
    expect(push).not.toHaveBeenCalled();
  });

  it('rejects a protocol invariant violation (maxLoanToValue > liquidationThreshold)', async () => {
    const user = userEvent.setup();
    render(<NewPortfolioPage />);
    await fillValidForm(user);
    await user.clear(screen.getByLabelText('Maximum LTV (%)', { exact: false }));
    await user.type(screen.getByLabelText('Maximum LTV (%)', { exact: false }), '90');
    await user.click(screen.getByRole('button', { name: 'Create Portfolio' }));

    expect(Object.keys(usePortfolioStore.getState().portfolios)).toHaveLength(0);
    expect(push).not.toHaveBeenCalled();
  });

  it('shows a field-level error for an invalid Liquidation threshold, Borrow APR, or Supply APR (UX-02/UX-03 same-class fix — previously silent)', async () => {
    // This form validates on submit (no `mode: 'onChange'`), so each
    // invalid field needs its own submit attempt to surface — unlike
    // `PortfolioPageClient.tsx`'s Collateral/Debt forms, which validate
    // live.
    const user = userEvent.setup();
    render(<NewPortfolioPage />);
    await fillValidForm(user);

    await user.clear(screen.getByLabelText('Liquidation threshold (%)', { exact: false }));
    await user.click(screen.getByRole('button', { name: 'Create Portfolio' }));
    expect(screen.getByText('Enter Liquidation Threshold as a percentage.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Liquidation threshold (%)', { exact: false }), '80');
    await user.clear(screen.getByLabelText('Borrow APR (%)', { exact: false }));
    await user.click(screen.getByRole('button', { name: 'Create Portfolio' }));
    expect(screen.getByText('Enter Borrow Rate as a percentage.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Borrow APR (%)', { exact: false }), '5');
    await user.clear(screen.getByLabelText('Supply APR (%)', { exact: false }));
    await user.click(screen.getByRole('button', { name: 'Create Portfolio' }));
    expect(screen.getByText('Enter Supply APR as a percentage.')).toBeInTheDocument();

    expect(Object.keys(usePortfolioStore.getState().portfolios)).toHaveLength(0);
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

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NewPortfolioPageClient } from '@/app/portfolios/new/NewPortfolioPageClient';
import { useAaveLiveDataStore } from '@/stores/aaveLiveDataStore';
import { useAaveV4CollateralRiskLiveDataStore } from '@/stores/aaveV4CollateralRiskLiveDataStore';
import { useAaveV4LiveDataStore } from '@/stores/aaveV4LiveDataStore';
import { usePortfolioStore } from '@/stores/portfolioStore';

/**
 * Safety Buffer ≥100% Persistence-Compatibility batch — verifies
 * `/portfolios/new` end to end: the write-time domain guard
 * (`isValidSafetyBufferTarget`, called by `portfolioStore.create()`) is
 * enforced here exactly like every other `create()` validation failure —
 * via the form's existing `setError('root', ...)` /
 * `{errors.root && ...}` convention (`app/portfolios/new/NewPortfolioPageClient.tsx`),
 * reused verbatim, not a new UI mechanism. No form/schema change was
 * needed to surface this: `portfolioInputSchema`'s own Zod bound on
 * `safetyBufferPercent` stays unchanged (see
 * `services/portfolio/safetyTargetsStatus.ts`'s own header comment), so
 * a value that passes `zodResolver` here can still be rejected by
 * `create()` — this file confirms that rejection is never silent.
 */
const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

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

const IDLE_V4_DEBT_STATE = {
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

const IDLE_V4_COLLATERAL_RISK_STATE = {
  status: 'idle' as const,
  canonical: null,
  userAddress: null,
  errorMessage: null,
  errorCode: null,
  attemptedUserAddress: null,
  lastFetchedAt: null,
  fetchAaveV4CollateralRiskLiveData: vi.fn().mockResolvedValue(undefined),
};

beforeEach(() => {
  usePortfolioStore.setState(INITIAL_PORTFOLIO_STATE);
  useAaveLiveDataStore.setState({ ...IDLE_AAVE_STATE, status: 'error' as const });
  useAaveV4LiveDataStore.setState(IDLE_V4_DEBT_STATE);
  useAaveV4CollateralRiskLiveDataStore.setState(IDLE_V4_COLLATERAL_RISK_STATE);
  push.mockClear();
});

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Portfolio name', { exact: false }), 'My Portfolio');
  await user.clear(screen.getByLabelText('BTC quantity', { exact: false }));
  await user.type(screen.getByLabelText('BTC quantity', { exact: false }), '2');
  await user.clear(screen.getByLabelText('Debt balance', { exact: false }));
  await user.type(screen.getByLabelText('Debt balance', { exact: false }), '20000');
  await user.type(screen.getByLabelText('Current BTC price (USD)', { exact: false }), '50000');
  await user.type(screen.getByLabelText('Maximum LTV (%)', { exact: false }), '75');
  await user.type(screen.getByLabelText('Liquidation threshold (%)', { exact: false }), '80');
  await user.type(screen.getByLabelText('Borrow APR (%)', { exact: false }), '5');
  await user.type(screen.getByLabelText('Supply APR (%)', { exact: false }), '2');
}

async function submitWithSafetyBuffer(user: ReturnType<typeof userEvent.setup>, value: string) {
  await fillRequiredFields(user);
  await user.type(screen.getByLabelText('Safety buffer (%)', { exact: false }), value);
  await user.click(screen.getByRole('button', { name: 'Create Portfolio' }));
}

describe('NewPortfolioPageClient — Safety Buffer write-time domain guard', () => {
  it('accepts a new Safety Buffer target just below 100% (99.99)', async () => {
    const user = userEvent.setup();
    render(<NewPortfolioPageClient />);
    await submitWithSafetyBuffer(user, '99.99');

    const portfolios = Object.values(usePortfolioStore.getState().portfolios);
    expect(portfolios).toHaveLength(1);
    expect(portfolios[0].portfolio.settings.safetyTargets?.safetyBufferPercent).toBe(99.99);
    expect(push).toHaveBeenCalledWith('/portfolio');
  });

  it('rejects a Safety Buffer target of exactly 100%, creating no portfolio, with a useful inline message', async () => {
    const user = userEvent.setup();
    render(<NewPortfolioPageClient />);
    await submitWithSafetyBuffer(user, '100');

    expect(Object.values(usePortfolioStore.getState().portfolios)).toHaveLength(0);
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByText(/Safety Buffer target must be/i)).toBeInTheDocument();
  });

  it('rejects a Safety Buffer target of 150%, creating no portfolio, with a useful inline message', async () => {
    const user = userEvent.setup();
    render(<NewPortfolioPageClient />);
    await submitWithSafetyBuffer(user, '150');

    expect(Object.values(usePortfolioStore.getState().portfolios)).toHaveLength(0);
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByText(/Safety Buffer target must be/i)).toBeInTheDocument();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { authService } from '@/services/auth';
import { useAuthStore } from '@/stores/authStore';
import { usePortfolioStore } from '@/stores/portfolioStore';

/**
 * 06_TASKS.md M8-056's "Local-data preservation" — DoD: "Authentication
 * behavior is reliable and does not affect local data unexpectedly."
 * `authStore.ts`'s own header comment already documents that it imports
 * nothing from `stores/portfolioStore.ts` and vice versa; this is the
 * behavioral proof of that architectural claim, not just a structural
 * one — it exercises real `usePortfolioStore` state across real
 * `useAuthStore` sign-in/sign-out transitions and asserts nothing in the
 * portfolio Store moves.
 */
vi.mock('@/services/auth', () => ({
  authService: {
    checkAvailability: vi.fn(),
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    signUp: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
    requestPasswordReset: vi.fn(),
    completePasswordReset: vi.fn(),
  },
}));

const mockAuthService = vi.mocked(authService);

const AUTH_SESSION = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  expiresAt: 1234567890,
  user: { id: 'user-1', email: 'user@example.com' },
};

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

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ user: null, status: 'idle', errors: [], cloudSyncEligible: false });
  usePortfolioStore.setState({
    portfolios: {},
    activePortfolioId: null,
    loadStatus: 'idle',
    saveStatus: 'idle',
    errors: [],
    lastSynchronizedAt: null,
  });
  window.localStorage.clear();
});

describe('authentication does not affect local portfolio data (M8-056)', () => {
  it('signing in leaves an existing portfolio, its active selection, and its data untouched', async () => {
    const created = usePortfolioStore.getState().create(validInput());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const beforeSignIn = usePortfolioStore.getState();

    mockAuthService.signIn.mockResolvedValue({ ok: true, data: AUTH_SESSION });
    const signedIn = await useAuthStore.getState().signIn('user@example.com', 'password123');

    expect(signedIn).toBe(true);
    expect(useAuthStore.getState().status).toBe('authenticated');
    const afterSignIn = usePortfolioStore.getState();
    expect(afterSignIn.portfolios).toEqual(beforeSignIn.portfolios);
    expect(afterSignIn.activePortfolioId).toBe(beforeSignIn.activePortfolioId);
    expect(afterSignIn.errors).toEqual(beforeSignIn.errors);
  });

  it('signing out leaves an existing portfolio, its active selection, and its data untouched', async () => {
    const created = usePortfolioStore.getState().create(validInput());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    useAuthStore.setState({
      user: AUTH_SESSION.user,
      status: 'authenticated',
      errors: [],
      cloudSyncEligible: true,
    });
    const beforeSignOut = usePortfolioStore.getState();

    mockAuthService.signOut.mockResolvedValue({ ok: true, data: undefined });
    const signedOut = await useAuthStore.getState().signOut();

    expect(signedOut).toBe(true);
    expect(useAuthStore.getState().status).toBe('unauthenticated');
    const afterSignOut = usePortfolioStore.getState();
    expect(afterSignOut.portfolios).toEqual(beforeSignOut.portfolios);
    expect(afterSignOut.activePortfolioId).toBe(beforeSignOut.activePortfolioId);
    expect(afterSignOut.errors).toEqual(beforeSignOut.errors);
  });

  it('a failed sign-in leaves local portfolio data untouched', async () => {
    const created = usePortfolioStore.getState().create(validInput());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const beforeSignIn = usePortfolioStore.getState();

    mockAuthService.signIn.mockResolvedValue({
      ok: false,
      errors: [{ category: 'authentication', code: 'INVALID_CREDENTIALS', message: 'Invalid.' }],
    });
    const signedIn = await useAuthStore.getState().signIn('user@example.com', 'wrong-password');

    expect(signedIn).toBe(false);
    const afterSignIn = usePortfolioStore.getState();
    expect(afterSignIn.portfolios).toEqual(beforeSignIn.portfolios);
    expect(afterSignIn.activePortfolioId).toBe(beforeSignIn.activePortfolioId);
  });
});

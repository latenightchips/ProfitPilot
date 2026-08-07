import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PersistenceProvider } from '@/providers/PersistenceProvider';
import { authService } from '@/services/auth';
import { autoSaveCoordinator } from '@/services/persistence';
import { useAuthStore } from '@/stores/authStore';
import { useDeveloperModeStore } from '@/stores/developerModeStore';
import { useExitPlannerStore } from '@/stores/exitPlannerStore';
import { useLoopBuilderStore } from '@/stores/loopBuilderStore';
import { usePortfolioStore } from '@/stores/portfolioStore';
import { useRecommendationCenterStore } from '@/stores/recommendationCenterStore';
import { useSimulationStore } from '@/stores/simulationStore';

/**
 * Application Restart Recovery — 06_TASKS.md M9-014 ("Test Application
 * Restart Recovery"). Dependencies: M8-061. Description: "Verify state
 * restoration after browser refresh or application restart." Cover:
 * "Active portfolio, Unsynchronized local changes, Saved simulations,
 * Saved strategies, Preferences, Authentication session where valid,
 * Pending sync queue." DoD: "The application restores a coherent last
 * valid state."
 *
 * **"Pending sync queue" is N/A — removed by product decision**
 * (Milestone 8 local-only re-scope; `docs/MILESTONE_8_SCOPE_CHANGE.md`;
 * `PROJECT_STATUS.md` Conflict #34) — no cloud sync queue exists.
 *
 * **Every other named item already has dedicated, real
 * local-storage-round-trip coverage at the individual Store level**, not
 * duplicated here: Active portfolio + Unsynchronized local changes
 * (`tests/unit/stores/portfolioStore.test.ts`'s own "survives a
 * simulated refresh" and "flushes any still-debounced write before
 * reading" tests), Saved simulations
 * (`tests/unit/stores/simulationStore.test.ts`'s own "loadSavedScenarios
 * hydrates... flushing first"), Saved strategies
 * (`tests/unit/stores/loopBuilderStore.test.ts`'s own equivalent),
 * Preferences (`tests/unit/stores/developerModeStore.test.ts`'s own
 * "local preference persistence"), Authentication session where valid
 * (`tests/unit/stores/authStore.test.ts`'s own "restores an existing
 * session when Supabase is configured and a session exists").
 * `tests/unit/providers/PersistenceProvider.test.tsx` already proves the
 * Provider *wires up* every Store's load action on mount, but explicitly
 * defers "hydration itself works" to those per-Store suites — using
 * mocked load functions, never exercising all six together for real.
 *
 * **What was genuinely missing, and what this file adds**: no test
 * exercised the *real*, full, multi-Store hydration path together — the
 * actual production sequence (migration, then all six Stores' real
 * `load*` actions in parallel) a genuine browser refresh triggers. This
 * is the DoD's own "coherent" requirement: not just that each slice
 * restores correctly in isolation, but that restoring several together,
 * through the one real code path the application actually uses at boot,
 * produces no cross-Store interference.
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

function wipeAllStoresInMemory(): void {
  usePortfolioStore.setState({
    portfolios: {},
    activePortfolioId: null,
    loadStatus: 'idle',
    saveStatus: 'idle',
    errors: [],
    lastSynchronizedAt: null,
  });
  useDeveloperModeStore.setState({ enabled: false });
  useLoopBuilderStore.setState({ savedStrategies: [] });
  useExitPlannerStore.setState({ savedPlans: [] });
  useSimulationStore.setState({ savedScenarios: [] });
  useRecommendationCenterStore.setState({ acknowledgements: {} });
  useAuthStore.setState({ user: null, status: 'idle', errors: [], cloudSyncEligible: false });
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  wipeAllStoresInMemory();
});

describe('Application restart recovery — coherent, real, multi-Store hydration (M9-014)', () => {
  it('restores the active portfolio and an unrelated preference together, through the real PersistenceProvider mount path, not individually mocked', async () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);
    useDeveloperModeStore.getState().toggle();
    await autoSaveCoordinator.flushAll();

    expect(useDeveloperModeStore.getState().enabled).toBe(true);

    wipeAllStoresInMemory();
    expect(usePortfolioStore.getState().portfolios).toEqual({});
    expect(useDeveloperModeStore.getState().enabled).toBe(false);

    render(
      <PersistenceProvider>
        <div>app content</div>
      </PersistenceProvider>,
    );

    await waitFor(() => {
      expect(usePortfolioStore.getState().activePortfolioId).toBe(created.data.id);
    });
    expect(usePortfolioStore.getState().portfolios[created.data.id]?.portfolio.name).toBe(
      'My Portfolio',
    );
    expect(useDeveloperModeStore.getState().enabled).toBe(true);
  });

  it('restores a valid authentication session independently of, and alongside, local data restoration', async () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);
    await autoSaveCoordinator.flushAll();

    wipeAllStoresInMemory();
    mockAuthService.checkAvailability.mockReturnValue({ available: true });
    mockAuthService.getSession.mockResolvedValue({
      ok: true,
      data: {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: 1234567890,
        user: { id: 'user-1', email: 'user@example.com' },
      },
    });
    mockAuthService.onAuthStateChange.mockReturnValue(() => {});

    render(
      <PersistenceProvider>
        <div>app content</div>
      </PersistenceProvider>,
    );
    await useAuthStore.getState().initialize();

    await waitFor(() => {
      expect(usePortfolioStore.getState().activePortfolioId).toBe(created.data.id);
    });
    expect(useAuthStore.getState().status).toBe('authenticated');
    expect(useAuthStore.getState().user?.id).toBe('user-1');
  });
});

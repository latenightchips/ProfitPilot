import { beforeEach, describe, expect, it, vi } from 'vitest';

import { authService } from '@/services/auth';
import { autoSaveCoordinator } from '@/services/persistence';
import { useAuthStore } from '@/stores/authStore';
import { usePortfolioStore } from '@/stores/portfolioStore';
import { useSimulationStore } from '@/stores/simulationStore';

/**
 * Concurrent State Update Tests — 06_TASKS.md M9-013 ("Test Concurrent
 * State Updates"). Dependencies: M9-012. Description: "Test rapid and
 * overlapping updates." Cases: "Price refresh during portfolio edit,"
 * "Auto-save during portfolio switch," "Sync during local edit,"
 * "Simulation recalculation during input changes," "Sign-out during
 * pending cloud write," "Import during stale background refresh." DoD:
 * "Stale operations cannot overwrite newer valid state."
 *
 * **Two of the six named cases are N/A — removed by product decision**
 * (Milestone 8 local-only re-scope; `docs/MILESTONE_8_SCOPE_CHANGE.md`;
 * `PROJECT_STATUS.md` Conflict #34):
 *   - "Sync during local edit" — no synchronization mechanism exists to
 *     race against.
 *   - "Sign-out during pending cloud write" — no cloud write is ever
 *     pending. Its non-cloud half — sign-out during a pending *local*
 *     auto-save write — remains valid, real scope, and is covered below.
 *
 * **"Auto-save during portfolio switch" is already covered**, not
 * duplicated here: `tests/unit/stores/portfolioStore.test.ts`'s own
 * "flushes any still-debounced write before reading, so load never
 * clobbers an in-flight create with stale disk contents".
 *
 * **"Import during stale background refresh" is structurally safe by
 * this application's own architecture, verified by inspection, not
 * assumed**: this app has no background/polling refresh mechanism of
 * any kind (Manual Mode only, per `01_PRD.md` REQ-010 — confirmed by
 * direct search: no price-provider polling, no `setInterval` anywhere in
 * `services/`/`stores/`). `autoSaveCoordinator` (M8-011) keys every
 * debounced write by `(recordType, id)`
 * (`services/persistence/autoSaveCoordinator.ts`), so an import writing
 * one record cannot collide with an unrelated pending auto-save for a
 * different one regardless of timing — a structural property of the
 * coordinator's own key-based isolation, not something a runtime race
 * test could exercise further without inventing a background process
 * this application does not have.
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

beforeEach(() => {
  vi.clearAllMocks();
  usePortfolioStore.setState({
    portfolios: {},
    activePortfolioId: null,
    loadStatus: 'idle',
    saveStatus: 'idle',
    errors: [],
    lastSynchronizedAt: null,
  });
  useAuthStore.setState({ user: null, status: 'idle', errors: [], cloudSyncEligible: false });
  useSimulationStore.setState({
    currentScenario: null,
    currentResult: null,
    portfolioActionPreview: null,
    savedScenarios: [],
    comparisonSelection: [],
    timelineProjection: null,
    lastMetadata: null,
    status: 'idle',
    errors: [],
    warnings: [],
    previewMode: false,
    workingPortfolioId: null,
  });
  window.localStorage.clear();
});

describe('Price refresh during portfolio edit (M9-013)', () => {
  it('a recompute (price refresh) immediately followed by a real edit leaves the edit in effect, never overwritten by the stale recompute', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');

    usePortfolioStore.getState().recomputeSummary(created.data.id);
    usePortfolioStore.getState().update(created.data.id, { name: 'Edited During Refresh' });

    expect(usePortfolioStore.getState().portfolios[created.data.id]?.portfolio.name).toBe(
      'Edited During Refresh',
    );
  });

  it('an edit immediately followed by a recompute (price refresh) does not revert the edit', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');

    usePortfolioStore.getState().update(created.data.id, { name: 'Edited Before Refresh' });
    usePortfolioStore.getState().recomputeSummary(created.data.id);

    expect(usePortfolioStore.getState().portfolios[created.data.id]?.portfolio.name).toBe(
      'Edited Before Refresh',
    );
  });
});

describe('Simulation recalculation during input changes (M9-013)', () => {
  it('rapid, back-to-back scenario changes leave only the last scenario in effect, never an earlier one', () => {
    useSimulationStore.getState().setCurrentScenario({
      type: 'price',
      priceScenario: { type: 'absolute', btcPriceUsd: 55000 },
    });
    useSimulationStore.getState().setCurrentScenario({
      type: 'price',
      priceScenario: { type: 'absolute', btcPriceUsd: 60000 },
    });
    useSimulationStore.getState().setCurrentScenario({
      type: 'price',
      priceScenario: { type: 'absolute', btcPriceUsd: 65000 },
    });

    const scenario = useSimulationStore.getState().currentScenario;
    expect(scenario?.type).toBe('price');
    if (scenario?.type === 'price' && scenario.priceScenario.type === 'absolute') {
      expect(scenario.priceScenario.btcPriceUsd).toBe(65000);
    }
  });

  it('running a simulation for a rapidly-superseded scenario still reflects the final scenario’s own result, not an intermediate one', () => {
    const portfolio = {
      collateral: { asset: 'BTC' as const, quantity: 2 },
      debt: { asset: 'USDC', balance: 20000 },
      market: { btcPriceUsd: 50000 },
      protocol: {
        maxLoanToValue: 0.75,
        liquidationThreshold: 0.8,
        borrowApr: 0.05,
        supplyApr: 0.02,
      },
    };

    useSimulationStore.getState().setCurrentScenario({
      type: 'price',
      priceScenario: { type: 'absolute', btcPriceUsd: 60000 },
    });
    useSimulationStore.getState().runSimulation(portfolio);
    useSimulationStore.getState().setCurrentScenario({
      type: 'price',
      priceScenario: { type: 'absolute', btcPriceUsd: 70000 },
    });
    useSimulationStore.getState().runSimulation(portfolio);

    const result = useSimulationStore.getState().currentResult;
    expect(result?.assumptions).toEqual({
      type: 'price',
      priceScenario: { type: 'absolute', btcPriceUsd: 70000 },
    });
  });
});

describe('Sign-out during a pending local auto-save write (M9-013, "Sign-out during pending cloud write" narrowed to its local-only remainder)', () => {
  it('a debounced portfolio write still lands even when sign-out fires before it flushes', async () => {
    useAuthStore.setState({
      user: { id: 'user-1', email: 'user@example.com' },
      status: 'authenticated',
      errors: [],
      cloudSyncEligible: true,
    });

    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    expect(usePortfolioStore.getState().saveStatus).toBe('saving');

    mockAuthService.signOut.mockResolvedValue({ ok: true, data: undefined });
    const signedOut = await useAuthStore.getState().signOut();
    expect(signedOut).toBe(true);

    await autoSaveCoordinator.flushAll();
    expect(usePortfolioStore.getState().saveStatus).toBe('saved');
    expect(usePortfolioStore.getState().portfolios[created.data.id]?.portfolio.name).toBe(
      'My Portfolio',
    );
  });
});

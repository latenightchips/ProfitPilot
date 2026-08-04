import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PersistenceProvider } from '@/providers/PersistenceProvider';
import { useDeveloperModeStore } from '@/stores/developerModeStore';
import { useExitPlannerStore } from '@/stores/exitPlannerStore';
import { useLoopBuilderStore } from '@/stores/loopBuilderStore';
import { usePortfolioStore } from '@/stores/portfolioStore';
import { useRecommendationCenterStore } from '@/stores/recommendationCenterStore';
import { useSimulationStore } from '@/stores/simulationStore';

/**
 * Persistence Provider — Milestone 8 Batch 2 (M8-006–M8-013). Hydrates
 * every Store from local storage once, on the very first client mount,
 * after first running `runLocalDataMigration` (M8-013) against the real
 * local storage adapter. Each Store's own `load*` action is replaced
 * with a spy here — this test proves the Provider calls every one of
 * them exactly once on mount, not that hydration itself works (each
 * Store's own test suite already covers that). `waitFor` is required
 * because the awaited migration step means the `load*` calls land after
 * a microtask, not synchronously within the mount effect.
 */
describe('PersistenceProvider (M8-006–M8-013)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    usePortfolioStore.setState({ load: vi.fn(async () => {}) });
    useLoopBuilderStore.setState({ loadSavedStrategies: vi.fn(async () => {}) });
    useExitPlannerStore.setState({ loadSavedPlans: vi.fn(async () => {}) });
    useSimulationStore.setState({ loadSavedScenarios: vi.fn(async () => {}) });
    useRecommendationCenterStore.setState({ loadAcknowledgements: vi.fn(async () => {}) });
    useDeveloperModeStore.setState({ load: vi.fn(async () => {}) });
  });

  it('renders its children unchanged', () => {
    render(
      <PersistenceProvider>
        <div>child content</div>
      </PersistenceProvider>,
    );
    expect(screen.getByText('child content')).toBeInTheDocument();
  });

  it('calls every Store load action exactly once on mount, after migration completes', async () => {
    render(
      <PersistenceProvider>
        <div>child content</div>
      </PersistenceProvider>,
    );

    await waitFor(() => {
      expect(usePortfolioStore.getState().load).toHaveBeenCalledTimes(1);
    });
    expect(useLoopBuilderStore.getState().loadSavedStrategies).toHaveBeenCalledTimes(1);
    expect(useExitPlannerStore.getState().loadSavedPlans).toHaveBeenCalledTimes(1);
    expect(useSimulationStore.getState().loadSavedScenarios).toHaveBeenCalledTimes(1);
    expect(useRecommendationCenterStore.getState().loadAcknowledgements).toHaveBeenCalledTimes(1);
    expect(useDeveloperModeStore.getState().load).toHaveBeenCalledTimes(1);
  });
});

import { create } from 'zustand';

import {
  type ApplicationError,
  type ApplicationPortfolio,
  type LoopSafetyCheck,
  type LoopStrategyPreview,
  type LoopStrategySettings,
  planLoopStrategy,
  type ServiceMetadata,
} from '@/services';
import type { StrategyWarning, StrategyWarningCategory } from '@/types/strategy';

/**
 * Loop Builder Store — 06_TASKS.md M7-007 ("Implement Loop Builder
 * Store"). Dependencies: M7-006. Priority P0, Effort M. Description:
 * "Create Zustand state for loop strategies." DoD: "Loop strategy state
 * remains independent from portfolio and simulation state."
 *
 * **Independence is structural, not just a comment** — the same
 * "never import `usePortfolioStore`/`useSimulationStore`, accept a
 * plain `ApplicationPortfolio` value at call time" precedent
 * `stores/simulationStore.ts`'s own header comment already established
 * for M6-003.
 *
 * **`CHECK_CATEGORY`/`CHECK_SUGGESTED_RESPONSE` map the Engine's own
 * 6-value `LoopSafetyCheck` union (`validateLoopStrategySafety`,
 * M2-018) into the shared `StrategyWarning` shape (M7-005, Batch 1) —
 * no new classification invented, just a display mapping for values
 * the Engine already produces.** `toStrategyWarning` is this Store's
 * own implementation of M7-005's own forward reference ("M7-013...
 * declare an explicit M7-005 dependency for exactly this reason") —
 * done here in Batch 2 rather than deferred to M7-013 (Batch 3),
 * since leaving genuinely available safety findings completely
 * unsurfaced until a later batch would contradict this engagement's
 * own "never let genuinely available data sit unused" discipline (the
 * same reasoning `ScenarioSummary.tsx`'s own Batch 9 "Warnings" section
 * already applied for Simulation).
 */
const CHECK_CATEGORY: Record<LoopSafetyCheck, StrategyWarningCategory> = {
  VALID_PROTOCOL_PARAMETERS: 'safety',
  LIQUIDATION_PROXIMITY: 'liquidation',
  MINIMUM_HEALTH_FACTOR: 'safety',
  BORROWING_CAPACITY: 'borrowingCapacity',
  MAXIMUM_LTV: 'safety',
  MAXIMUM_LOOP_COUNT: 'safety',
};

const CHECK_SUGGESTED_RESPONSE: Record<LoopSafetyCheck, string> = {
  VALID_PROTOCOL_PARAMETERS:
    'Correct the Maximum LTV/Borrow-Rate Assumption so they describe a valid protocol configuration.',
  LIQUIDATION_PROXIMITY:
    'Reduce leverage or add collateral before looping — the starting position is already too close to liquidation.',
  MINIMUM_HEALTH_FACTOR:
    'Raise the Minimum Health Factor floor, or reduce Borrow Percentage Per Step/Maximum Number of Loops.',
  BORROWING_CAPACITY:
    'Reduce the target borrow percentage — no further borrowing capacity remains.',
  MAXIMUM_LTV: 'Reduce the target borrow percentage — the resulting LTV would exceed the maximum.',
  MAXIMUM_LOOP_COUNT: 'Reduce the requested Maximum Number of Loops.',
};

function toStrategyWarning(finding: {
  check: LoopSafetyCheck;
  severity: 'error' | 'warning';
}): StrategyWarning {
  return {
    category: CHECK_CATEGORY[finding.check],
    severity: finding.severity,
    cause: `Safety check "${finding.check}" ${finding.severity === 'error' ? 'failed' : 'raised a warning'}.`,
    suggestedResponse: CHECK_SUGGESTED_RESPONSE[finding.check],
  };
}

export interface SavedLoopStrategy {
  id: string;
  name: string;
  settings: LoopStrategySettings;
  result: LoopStrategyPreview;
  createdAt: string;
}

export type LoopBuilderStatus = 'idle' | 'calculating' | 'error';

export interface LoopBuilderStoreState {
  settings: LoopStrategySettings | null;
  currentResult: LoopStrategyPreview | null;
  status: LoopBuilderStatus;
  errors: ApplicationError[];
  warnings: StrategyWarning[];
  lastMetadata: ServiceMetadata | null;
  savedStrategies: SavedLoopStrategy[];
  selectedStrategyId: string | null;
}

export interface LoopBuilderStoreActions {
  setSettings: (settings: LoopStrategySettings) => void;
  runLoopStrategy: (portfolio: ApplicationPortfolio) => void;
  reset: () => void;
}

const SOURCE_STATUS = 'manual';

const INITIAL_STATE: LoopBuilderStoreState = {
  settings: null,
  currentResult: null,
  status: 'idle',
  errors: [],
  warnings: [],
  lastMetadata: null,
  savedStrategies: [],
  selectedStrategyId: null,
};

export const useLoopBuilderStore = create<LoopBuilderStoreState & LoopBuilderStoreActions>(
  (set, get) => ({
    ...INITIAL_STATE,

    setSettings: (settings) => {
      set({ settings, currentResult: null });
    },

    runLoopStrategy: (portfolio) => {
      const { settings } = get();
      if (settings === null) return;

      set({ status: 'calculating' });
      const result = planLoopStrategy(portfolio, settings, SOURCE_STATUS);

      if (!result.ok) {
        set({
          status: 'error',
          errors: result.errors,
          currentResult: null,
          lastMetadata: null,
          warnings: [],
        });
        return;
      }

      set({
        status: 'idle',
        errors: [],
        currentResult: result.data,
        lastMetadata: result.metadata,
        warnings: result.data.findings.map(toStrategyWarning),
      });
    },

    reset: () => {
      set(INITIAL_STATE);
    },
  }),
);

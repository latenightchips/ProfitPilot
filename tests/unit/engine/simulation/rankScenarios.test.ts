import { describe, expect, it } from 'vitest';

import type { ScenarioSummary } from '@/engine/simulation/compareScenarios';
import { rankScenarios } from '@/engine/simulation/rankScenarios';

function summary(overrides: Partial<ScenarioSummary> = {}): ScenarioSummary {
  return {
    label: 'Scenario',
    equity: 100000,
    profitOrLoss: 0,
    healthFactor: 1.6,
    liquidationDistance: 0.6,
    debtCost: 2500,
    leverage: 1.8,
    ...overrides,
  };
}

describe('rankScenarios (M2-022)', () => {
  it('ranks scenarios by a chosen metric, highest first', () => {
    const scenarios = [
      summary({ label: 'Low', healthFactor: 1.2 }),
      summary({ label: 'High', healthFactor: 2.4 }),
      summary({ label: 'Mid', healthFactor: 1.8 }),
    ];
    const ranked = rankScenarios(scenarios, 'healthFactor');
    expect(ranked.map((r) => r.label)).toEqual(['High', 'Mid', 'Low']);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it('ranks by a different metric independently', () => {
    const scenarios = [
      summary({ label: 'A', debtCost: 500 }),
      summary({ label: 'B', debtCost: 1500 }),
    ];
    const ranked = rankScenarios(scenarios, 'debtCost');
    expect(ranked.map((r) => r.label)).toEqual(['B', 'A']);
  });

  it('returns an empty array for no scenarios', () => {
    expect(rankScenarios([], 'equity')).toEqual([]);
  });

  it('does not wrap the result in a FormulaResult, per its documented non-formula nature', () => {
    const ranked = rankScenarios([summary()], 'equity');
    expect(ranked).not.toHaveProperty('ok');
    expect(Array.isArray(ranked)).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';

import { compareScenarios, type ScenarioSummary } from '@/engine/simulation/compareScenarios';

function summary(overrides: Partial<ScenarioSummary> = {}): ScenarioSummary {
  return {
    label: 'Scenario',
    equity: 180000,
    profitOrLoss: 0,
    healthFactor: 1.6,
    liquidationDistance: 0.6,
    debtCost: 2500,
    leverage: 1.8,
    ...overrides,
  };
}

describe('compareScenarios (M2-022, F-053)', () => {
  it('matches the documented example: Net Worth Scenario A $180,000, Scenario B $210,000 -> +$30,000', () => {
    const scenarioA = summary({ label: 'Scenario A', equity: 180000 });
    const scenarioB = summary({ label: 'Scenario B', equity: 210000 });
    const result = compareScenarios(scenarioA, scenarioB);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.metadata.formulaId).toBe('F-053');
    expect(result.value.scenarioALabel).toBe('Scenario A');
    expect(result.value.scenarioBLabel).toBe('Scenario B');
    const equityDiff = result.value.differences.find((d) => d.metric === 'equity');
    expect(equityDiff?.difference).toBe(30000);
  });

  it('computes a difference for every ScenarioSummary metric', () => {
    const result = compareScenarios(summary(), summary({ leverage: 2.5 }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.differences).toHaveLength(6);
    const leverageDiff = result.value.differences.find((d) => d.metric === 'leverage');
    expect(leverageDiff?.difference).toBeCloseTo(0.7, 6);
  });

  it('handles a zero-debt Health Factor of Infinity without crashing', () => {
    const result = compareScenarios(
      summary({ healthFactor: Infinity }),
      summary({ healthFactor: 2.0 }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const hfDiff = result.value.differences.find((d) => d.metric === 'healthFactor');
    expect(hfDiff?.difference).toBe(-Infinity);
  });

  it('warns rather than fails when both scenarios have an infinite Health Factor', () => {
    const result = compareScenarios(
      summary({ healthFactor: Infinity }),
      summary({ healthFactor: Infinity }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.warnings.some((w) => w.code === 'UNDEFINED_DIFFERENCE')).toBe(true);
    const hfDiff = result.value.differences.find((d) => d.metric === 'healthFactor');
    expect(Number.isNaN(hfDiff?.difference)).toBe(true);
  });

  it('rejects a NaN metric value on scenario A', () => {
    const result = compareScenarios(summary({ equity: NaN }), summary());
    expect(result.ok).toBe(false);
  });

  it('rejects a NaN metric value on scenario B', () => {
    const result = compareScenarios(summary(), summary({ equity: NaN }));
    expect(result.ok).toBe(false);
  });
});

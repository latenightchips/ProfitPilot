import { toDecimal, toOutputNumber } from '../shared/decimal';
import {
  createFailure,
  createSuccess,
  type FormulaResult,
  type FormulaWarning,
} from '../shared/result';

const FORMULA_ID = 'F-053';
const FORMULA_VERSION = '1.0';

/**
 * A pre-computed scenario result, flattened to exactly the six metrics
 * 06_TASKS.md M2-022 lists under "Compare": Equity, Profit or loss,
 * Health Factor, Liquidation distance, Debt cost, Leverage.
 *
 * M2-022's DoD ("scenarios can be ranked and displayed without
 * recalculating values in the UI") means compareScenarios/rankScenarios
 * consume values already produced elsewhere (simulatePriceScenario F-004/
 * F-007/F-022/F-023, simulateInterestScenario/simulatePositionChange, or
 * calculateEffectiveLeverage F-011 / a loop cost's accrued interest for
 * "Debt cost") rather than recomputing anything themselves — callers
 * assemble this summary from whichever scenario function they used.
 */
export interface ScenarioSummary {
  label: string;
  equity: number;
  profitOrLoss: number;
  healthFactor: number;
  liquidationDistance: number;
  debtCost: number;
  leverage: number;
}

export type ScenarioMetric = Exclude<keyof ScenarioSummary, 'label'>;

const SCENARIO_METRICS: ScenarioMetric[] = [
  'equity',
  'profitOrLoss',
  'healthFactor',
  'liquidationDistance',
  'debtCost',
  'leverage',
];

export interface ScenarioMetricDifference {
  metric: ScenarioMetric;
  scenarioAValue: number;
  scenarioBValue: number;
  /** Scenario Difference — F-053. Equation: Difference = Scenario B − Scenario A. */
  difference: number;
}

export interface ScenarioComparisonResult {
  scenarioALabel: string;
  scenarioBLabel: string;
  differences: ScenarioMetricDifference[];
}

/**
 * Scenario Difference — 02_Formulas.md F-053.
 * Equation: Difference = Scenario B − Scenario A.
 * Applied across all six ScenarioSummary metrics at once, satisfying
 * 06_TASKS.md M2-022's "Compare" list in a single call.
 *
 * healthFactor may legitimately be `Infinity` for a zero-debt scenario
 * (calculateHealthFactor's own documented F-022 exception, Batch 3), so
 * values are only rejected for NaN, not for being infinite — unlike most
 * of the Engine's inputs, which reject non-finite values outright.
 * Comparing two infinite Health Factors produces a NaN difference
 * (Infinity − Infinity is undefined); that specific field gets a warning
 * rather than failing the whole comparison, since the other metrics
 * remain meaningful.
 */
export function compareScenarios(
  scenarioA: ScenarioSummary,
  scenarioB: ScenarioSummary,
): FormulaResult<ScenarioComparisonResult> {
  const options = {
    formulaId: FORMULA_ID,
    formulaVersion: FORMULA_VERSION,
    inputsUsed: { scenarioA, scenarioB },
  };

  const differences: ScenarioMetricDifference[] = [];
  const warnings: FormulaWarning[] = [];

  for (const metric of SCENARIO_METRICS) {
    const valueA = scenarioA[metric];
    const valueB = scenarioB[metric];

    if (Number.isNaN(valueA)) {
      return createFailure(
        { code: 'INVALID_FINITE', message: `scenarioA.${metric} must not be NaN.` },
        options,
      );
    }
    if (Number.isNaN(valueB)) {
      return createFailure(
        { code: 'INVALID_FINITE', message: `scenarioB.${metric} must not be NaN.` },
        options,
      );
    }

    const difference =
      Number.isFinite(valueA) && Number.isFinite(valueB)
        ? toOutputNumber(toDecimal(valueB).minus(valueA))
        : valueB - valueA;

    if (Number.isNaN(difference)) {
      warnings.push({
        code: 'UNDEFINED_DIFFERENCE',
        message: `The difference for "${metric}" is undefined (both scenarios have an infinite value).`,
      });
    }

    differences.push({ metric, scenarioAValue: valueA, scenarioBValue: valueB, difference });
  }

  return createSuccess(
    { scenarioALabel: scenarioA.label, scenarioBLabel: scenarioB.label, differences },
    options,
    warnings,
  );
}

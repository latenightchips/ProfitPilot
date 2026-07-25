import type { ScenarioMetric, ScenarioSummary } from './compareScenarios';

export interface RankedScenario {
  label: string;
  value: number;
  rank: number;
}

/**
 * Ranks pre-computed scenario summaries by a single named metric —
 * 06_TASKS.md M2-022's "Scenarios can be ranked and displayed without
 * recalculating values in the UI".
 *
 * This deliberately does NOT implement 02_Formulas.md F-058 "Scenario
 * Ranking Score" (a composite 0-100 score combining Expected Return,
 * Health Factor, Debt, Interest Cost, Risk Score, and Target Completion):
 * F-058 documents no equation, weighting scheme, or worked example for
 * combining those six inputs — implementing it would mean inventing a
 * scoring formula, which is out of scope. Ranking by one already-computed
 * metric at a time is the literal, non-invented reading of M2-022's DoD
 * that doesn't require F-058's undefined methodology.
 *
 * This is a data-ordering utility, not a formula computation, so unlike
 * every other public Engine function it does not return a FormulaResult
 * or carry a Formula ID — the same reasoning `engine/validation/validate.ts`
 * (M2-005) uses for its plain validation helpers.
 *
 * Descending order (highest value first) for every metric, including
 * `liquidationDistance` and `healthFactor` where a higher value is safer
 * — 06_TASKS.md does not ask for metric-specific sort direction, and
 * "higher is more attractive" matches F-058's own stated direction
 * ("Higher score, More attractive scenario") for the one part of it that
 * is unambiguous.
 */
export function rankScenarios(
  scenarios: ScenarioSummary[],
  metric: ScenarioMetric,
): RankedScenario[] {
  return scenarios
    .map((scenario) => ({ label: scenario.label, value: scenario[metric] }))
    .sort((a, b) => b.value - a.value)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

/**
 * Simulation Service — 06_TASKS.md M3-009 ("Implement Simulation
 * Service"): "Coordinate scenario creation and comparison." DoD:
 * "Simulation features require no direct Formula Engine orchestration."
 * Responsibilities: validate scenario inputs, call Engine simulation
 * functions, attach current portfolio baseline, return comparison-ready
 * results, preserve assumptions.
 *
 * **Scope: price and interest scenarios only, not position-change.**
 * `06_TASKS.md`'s Scenario Simulation chapter (M2-019/M2-020, F-050/F-033)
 * and its Comparison chapter (M2-022, F-053, `ScenarioSummary`'s
 * `profitOrLoss` field) were built around "what if the market moves"
 * scenarios. `engine/simulation/simulatePositionChange.ts` (M2-021)
 * exists and is public, but forcing it into this same `ScenarioSummary`
 * shape would require inventing a "profit or loss" meaning for a
 * deliberate capital contribution (adding collateral increases net
 * equity by exactly the contributed amount — that is not profit) that
 * no document defines. Position-change previewing is already M3-006's
 * job (`previewPortfolioAction`), which correctly has no `profitOrLoss`
 * concept at all. Excluding it here avoids inventing one.
 *
 * **"Attach current portfolio baseline"**: the baseline `ScenarioSummary`
 * reuses `calculatePortfolioSummary` (M3-005) directly rather than
 * recomputing portfolio metrics a second way — the same reuse M3-006
 * already established. `profitOrLoss` is trivially `0` for the baseline
 * (compared to itself).
 *
 * **Field completion per scenario type**: neither `simulatePriceScenario`
 * nor `simulateInterestScenario` returns every field `ScenarioSummary`
 * needs (`leverage` is never included by either; `simulateInterestScenario`
 * also omits `liquidationDistance` and `profitOrLoss`). Rather than
 * reimplementing those functions' own logic through a different
 * composition path, this file calls the documented Engine functions
 * directly for the fields they provide (preserving their own Formula
 * IDs, validation, and warnings) and supplements only the missing
 * fields with additional already-public Engine calls
 * (`calculateEffectiveLeverage`, `calculateLiquidationDistance`,
 * `calculatePortfolioGain`, `calculateAnnualInterest` — the same
 * "Annual Interest" interpretation M3-005 already established for
 * "debt cost").
 *
 * **"Preserve assumptions"**: interpreted as never discarding the
 * caller's own scenario definition — `SimulationResult.assumptions`
 * echoes the exact `SimulationScenario` the caller supplied (including
 * `timeHorizonDays`/`borrowApr` for interest scenarios), so a UI can
 * always display what was assumed alongside the numbers.
 *
 * Reuses `services/shared/formulaStep.ts` (relocated here from
 * `services/portfolio/summary.ts` at this same batch) for the same
 * conflict #19 formula-version-tracking stopgap M3-005 established.
 */
import {
  calculateAnnualInterest,
  calculateEffectiveLeverage,
  calculateLiquidationDistance,
  calculatePortfolioGain,
  compareScenarios,
  type PriceScenarioInput,
  type ScenarioComparisonResult,
  type ScenarioSummary,
  simulateInterestScenario,
  simulatePriceScenario,
} from '@/engine';

import { mapApplicationPortfolioToEngineInput } from '../portfolio/mapping';
import type { ApplicationPortfolio } from '../portfolio/models';
import { calculatePortfolioSummary, type PortfolioSummary } from '../portfolio/summary';
import { formulaStep, optionsFromTracked, type TrackedFormulaVersion } from '../shared/formulaStep';
import { createServiceSuccess, type ServiceResult, type ServiceWarning } from '../shared/result';

export type SimulationScenario =
  | { type: 'price'; priceScenario: PriceScenarioInput }
  | {
      type: 'interest';
      priceScenario: PriceScenarioInput;
      timeHorizonDays: number;
      borrowApr: number;
    };

export interface SimulationResult {
  baseline: ScenarioSummary;
  scenario: ScenarioSummary;
  comparison: ScenarioComparisonResult;
  assumptions: SimulationScenario;
}

const BASELINE_LABEL = 'Current Portfolio';

function toScenarioSummary(
  label: string,
  portfolioSummary: PortfolioSummary,
  profitOrLoss: number,
): ScenarioSummary {
  return {
    label,
    equity: portfolioSummary.netEquity,
    profitOrLoss,
    healthFactor: portfolioSummary.healthFactor,
    liquidationDistance: portfolioSummary.liquidation.distance,
    debtCost: portfolioSummary.interestCost,
    leverage: portfolioSummary.leverage,
  };
}

function finalize(
  baselineSummary: ScenarioSummary,
  scenarioSummary: ScenarioSummary,
  tracked: TrackedFormulaVersion,
  warnings: ServiceWarning[],
  scenario: SimulationScenario,
  sourceStatus: string,
): ServiceResult<SimulationResult> {
  const comparisonStep = formulaStep(
    compareScenarios(baselineSummary, scenarioSummary),
    tracked,
    sourceStatus,
  );
  if (!comparisonStep.ok) return comparisonStep.failure;

  return createServiceSuccess(
    {
      baseline: baselineSummary,
      scenario: scenarioSummary,
      comparison: comparisonStep.value,
      assumptions: scenario,
    },
    optionsFromTracked(sourceStatus, comparisonStep.tracked),
    [...warnings, ...comparisonStep.warnings],
  );
}

/**
 * Simulates a price or interest scenario against a portfolio and returns
 * a comparison-ready result — 06_TASKS.md M3-009. `sourceStatus` is
 * caller-supplied for the same reason as `calculatePortfolioSummary`
 * (M3-005): this Service has no source of its own to report.
 */
export function simulateScenario(
  portfolio: ApplicationPortfolio,
  scenario: SimulationScenario,
  scenarioLabel: string,
  sourceStatus: string,
): ServiceResult<SimulationResult> {
  const baselineResult = calculatePortfolioSummary(portfolio, sourceStatus);
  if (!baselineResult.ok) return baselineResult;

  const baselineSummary = toScenarioSummary(BASELINE_LABEL, baselineResult.data, 0);
  const engineInput = mapApplicationPortfolioToEngineInput(portfolio);
  const warnings: ServiceWarning[] = [...baselineResult.warnings];
  let tracked: TrackedFormulaVersion = {
    engineVersion: baselineResult.metadata.engineVersion,
    formulaVersion: baselineResult.metadata.formulaVersion,
  };

  if (scenario.type === 'price') {
    const priceStep = formulaStep(
      simulatePriceScenario({ portfolio: engineInput, scenario: scenario.priceScenario }),
      tracked,
      sourceStatus,
    );
    if (!priceStep.ok) return priceStep.failure;
    tracked = priceStep.tracked;
    warnings.push(...priceStep.warnings);
    const priceResult = priceStep.value;

    const leverageStep = formulaStep(
      calculateEffectiveLeverage({
        ...engineInput,
        market: { btcPriceUsd: priceResult.scenarioBtcPriceUsd },
      }),
      tracked,
      sourceStatus,
    );
    if (!leverageStep.ok) return leverageStep.failure;
    tracked = leverageStep.tracked;
    warnings.push(...leverageStep.warnings);

    const debtCostStep = formulaStep(
      calculateAnnualInterest(priceResult.debtValue, engineInput.protocol.borrowApr),
      tracked,
      sourceStatus,
    );
    if (!debtCostStep.ok) return debtCostStep.failure;
    tracked = debtCostStep.tracked;
    warnings.push(...debtCostStep.warnings);

    const scenarioSummary: ScenarioSummary = {
      label: scenarioLabel,
      equity: priceResult.netEquity,
      profitOrLoss: priceResult.profitOrLoss,
      healthFactor: priceResult.healthFactor,
      liquidationDistance: priceResult.liquidationDistance,
      debtCost: debtCostStep.value,
      leverage: leverageStep.value,
    };

    return finalize(baselineSummary, scenarioSummary, tracked, warnings, scenario, sourceStatus);
  }

  const interestStep = formulaStep(
    simulateInterestScenario({
      portfolio: engineInput,
      priceScenario: scenario.priceScenario,
      timeHorizonDays: scenario.timeHorizonDays,
      borrowApr: scenario.borrowApr,
    }),
    tracked,
    sourceStatus,
  );
  if (!interestStep.ok) return interestStep.failure;
  tracked = interestStep.tracked;
  warnings.push(...interestStep.warnings);
  const interestResult = interestStep.value;

  const liquidationDistanceStep = formulaStep(
    calculateLiquidationDistance(
      interestResult.projectedCollateralValue,
      engineInput.protocol.liquidationThreshold,
      interestResult.projectedDebt,
    ),
    tracked,
    sourceStatus,
  );
  if (!liquidationDistanceStep.ok) return liquidationDistanceStep.failure;
  tracked = liquidationDistanceStep.tracked;
  warnings.push(...liquidationDistanceStep.warnings);

  const profitOrLossStep = formulaStep(
    calculatePortfolioGain(
      interestResult.projectedCollateralValue,
      baselineResult.data.collateralValue,
    ),
    tracked,
    sourceStatus,
  );
  if (!profitOrLossStep.ok) return profitOrLossStep.failure;
  tracked = profitOrLossStep.tracked;
  warnings.push(...profitOrLossStep.warnings);

  const leverageStep = formulaStep(
    calculateEffectiveLeverage({
      ...engineInput,
      market: { btcPriceUsd: interestResult.scenarioBtcPriceUsd },
      debt: { asset: engineInput.debt.asset, balance: interestResult.projectedDebt },
    }),
    tracked,
    sourceStatus,
  );
  if (!leverageStep.ok) return leverageStep.failure;
  tracked = leverageStep.tracked;
  warnings.push(...leverageStep.warnings);

  const scenarioSummary: ScenarioSummary = {
    label: scenarioLabel,
    equity: interestResult.projectedEquity,
    profitOrLoss: profitOrLossStep.value,
    healthFactor: interestResult.projectedHealthFactor,
    liquidationDistance: liquidationDistanceStep.value,
    debtCost: interestResult.accruedInterest,
    leverage: leverageStep.value,
  };

  return finalize(baselineSummary, scenarioSummary, tracked, warnings, scenario, sourceStatus);
}

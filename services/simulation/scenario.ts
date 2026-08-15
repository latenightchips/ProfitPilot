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
 * **Field completion per scenario type**: `simulatePriceScenario` doesn't
 * return every field `ScenarioSummary` needs (`leverage` is never
 * included), so this file supplements it with additional already-public
 * Engine calls (`calculateEffectiveLeverage`, `calculateAnnualInterest` —
 * the same "Annual Interest" interpretation M3-005 already established
 * for "debt cost").
 *
 * **Interest scenarios compose Engine primitives directly rather than
 * calling `simulateInterestScenario`.** `simulateInterestScenario`
 * (F-033) internally uses `calculateProratedInterest`/`calculateDebtGrowth`
 * — simple, non-compounding interest, correct for its own documented
 * scope but not a real protocol's actual on-chain variable-debt accrual.
 * Since this is the one place in the app that projects debt forward over
 * an explicit holding period, this branch calls `resolveScenarioPrice` +
 * `calculateCollateralValue` + `projectProtocolDebt` (protocol/version
 * dispatch, `engine/protocols/`) + `calculateNetWorth` +
 * `calculateHealthFactor` + `calculateLiquidationDistance` +
 * `calculatePortfolioGain` + `calculateEffectiveLeverage` directly —
 * the same "call several already-public Engine primitives instead of one
 * bundled function" pattern the price-scenario branch above already
 * uses. `simulateInterestScenario`/`calculateDebtGrowth` themselves are
 * untouched and remain available with their original, documented
 * simple-interest semantics for any other caller.
 *
 * **`projectProtocolDebt` — protocol/version dispatch (V4 Readiness Audit
 * §12 Stage 1).** This file previously imported `projectVariableDebt`
 * from `engine/protocols/aaveV3` directly — a hardcoded V3 assumption
 * with no version boundary, the exact architectural gap the audit
 * identified. Both `projectVariableDebt` call sites below now go through
 * `projectProtocolDebt(protocolVersion, ...)` instead, resolving
 * `protocolVersion` from `portfolio.protocolVersion ?? 'v3'` once per
 * call to `simulateScenario`. For `'v3'` (every portfolio today —
 * `protocolVersion` is not settable anywhere yet), the dispatcher forwards
 * to the exact same, unmodified V3 projector: identical inputs, identical
 * outputs, identical `FormulaResult` metadata. A portfolio explicitly
 * marked `'v4'` (test-only this stage; no UI sets it) fails closed with a
 * structured `AAVE_V4_PROJECTION_NOT_IMPLEMENTED` error instead of
 * silently reusing V3's math or a placeholder number.
 *
 * **Interest Cost comparison semantics (PT-12 follow-up round 3,
 * preserved and updated for compounding)**: the baseline `debtCost` set
 * up above (`toScenarioSummary`, via `calculatePortfolioSummary`'s own
 * `interestCost`) is always the unprorated *annual* figure, since it is
 * computed once, before either scenario branch, with no time horizon in
 * scope. That is the correct comparison for a `type: 'price'` scenario
 * (whose own `debtCost` above is also annual, via `calculateAnnualInterest`
 * — unmodified, still true), but for a `type: 'interest'` scenario the
 * two sides must represent the same Holding Period, so the baseline is
 * reprorated here over that same `scenario.timeHorizonDays`, using the
 * portfolio's own actual current debt value and Borrow APR (not the
 * scenario's own, possibly stress-tested `borrowApr`). This now calls
 * `projectProtocolDebt` (the same dispatch, and for V3 the same
 * compounding curve, as the scenario side below) rather than the old
 * `calculateProratedInterest` — both sides of the comparison must use the
 * same accrual formula, or a scenario run at the portfolio's own real
 * current rate would show a spurious baseline/scenario gap that is purely
 * an artifact of comparing simple interest against compound interest, not
 * a real rate or price difference.
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
  type AaveProtocolVersion,
  calculateAnnualInterest,
  calculateCollateralValue,
  calculateEffectiveLeverage,
  calculateHealthFactor,
  calculateLiquidationDistance,
  calculateNetWorth,
  calculatePortfolioGain,
  compareScenarios,
  type PriceScenarioInput,
  projectProtocolDebt,
  resolveScenarioPrice,
  type ScenarioComparisonResult,
  type ScenarioSummary,
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

/**
 * Backward-compatible default (V4 Readiness Audit §12 Stage 1) —
 * `ApplicationPortfolio.protocolVersion` is not settable anywhere yet, so
 * every real portfolio resolves here. See `services/portfolio/models.ts`'s
 * own `protocolVersion` doc comment for the full backward-compatibility
 * reasoning.
 */
const DEFAULT_PROTOCOL_VERSION: AaveProtocolVersion = 'v3';

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
    // `liquidation` is `null` for a zero-debt portfolio (conflict #20);
    // `Infinity` mirrors calculateLiquidationDistance's (F-023) own
    // zero-debt behavior, which this baseline would otherwise have
    // produced if `calculatePortfolioSummary` hadn't already computed it.
    liquidationDistance: portfolioSummary.liquidation?.distance ?? Infinity,
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

  const protocolVersion: AaveProtocolVersion =
    portfolio.protocolVersion ?? DEFAULT_PROTOCOL_VERSION;
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

  const scenarioPriceStep = formulaStep(
    resolveScenarioPrice(engineInput.market.btcPriceUsd, scenario.priceScenario),
    tracked,
    sourceStatus,
  );
  if (!scenarioPriceStep.ok) return scenarioPriceStep.failure;
  tracked = scenarioPriceStep.tracked;
  warnings.push(...scenarioPriceStep.warnings);
  const scenarioMarket = { btcPriceUsd: scenarioPriceStep.value };

  const projectedCollateralValueStep = formulaStep(
    calculateCollateralValue(engineInput.collateral, scenarioMarket),
    tracked,
    sourceStatus,
  );
  if (!projectedCollateralValueStep.ok) return projectedCollateralValueStep.failure;
  tracked = projectedCollateralValueStep.tracked;
  warnings.push(...projectedCollateralValueStep.warnings);

  // Protocol/version-dispatched debt accrual — see this file's header
  // comment. Not `simulateInterestScenario`/`calculateProratedInterest`
  // (simple interest), which remain unchanged for any other caller.
  const projectedDebtStep = formulaStep(
    projectProtocolDebt(
      protocolVersion,
      engineInput.debt.balance,
      scenario.borrowApr,
      scenario.timeHorizonDays,
    ),
    tracked,
    sourceStatus,
  );
  if (!projectedDebtStep.ok) return projectedDebtStep.failure;
  tracked = projectedDebtStep.tracked;
  warnings.push(...projectedDebtStep.warnings);
  const projectedDebt = projectedDebtStep.value;
  const accruedInterest = projectedDebt - engineInput.debt.balance;

  const projectedPortfolio = {
    ...engineInput,
    market: scenarioMarket,
    debt: { asset: engineInput.debt.asset, balance: projectedDebt },
  };

  const projectedEquityStep = formulaStep(
    calculateNetWorth(projectedPortfolio),
    tracked,
    sourceStatus,
  );
  if (!projectedEquityStep.ok) return projectedEquityStep.failure;
  tracked = projectedEquityStep.tracked;
  warnings.push(...projectedEquityStep.warnings);

  const projectedHealthFactorStep = formulaStep(
    calculateHealthFactor(
      projectedCollateralValueStep.value,
      engineInput.protocol.liquidationThreshold,
      projectedDebt,
    ),
    tracked,
    sourceStatus,
  );
  if (!projectedHealthFactorStep.ok) return projectedHealthFactorStep.failure;
  tracked = projectedHealthFactorStep.tracked;
  warnings.push(...projectedHealthFactorStep.warnings);

  // Baseline debtCost reproration (PT-12 follow-up round 3) — matches the
  // scenario side's own accrual formula (same protocol/version dispatch)
  // so both sides of the comparison stay apples-to-apples over the same
  // Holding Period, using the portfolio's own real current debt/rate
  // rather than the scenario's own (possibly stress-tested) borrowApr.
  const baselineProjectedDebtStep = formulaStep(
    projectProtocolDebt(
      protocolVersion,
      baselineResult.data.debtValue,
      engineInput.protocol.borrowApr,
      scenario.timeHorizonDays,
    ),
    tracked,
    sourceStatus,
  );
  if (!baselineProjectedDebtStep.ok) return baselineProjectedDebtStep.failure;
  tracked = baselineProjectedDebtStep.tracked;
  warnings.push(...baselineProjectedDebtStep.warnings);
  const proratedBaselineSummary: ScenarioSummary = {
    ...baselineSummary,
    debtCost: baselineProjectedDebtStep.value - baselineResult.data.debtValue,
  };

  const liquidationDistanceStep = formulaStep(
    calculateLiquidationDistance(
      projectedCollateralValueStep.value,
      engineInput.protocol.liquidationThreshold,
      projectedDebt,
    ),
    tracked,
    sourceStatus,
  );
  if (!liquidationDistanceStep.ok) return liquidationDistanceStep.failure;
  tracked = liquidationDistanceStep.tracked;
  warnings.push(...liquidationDistanceStep.warnings);

  const profitOrLossStep = formulaStep(
    calculatePortfolioGain(projectedCollateralValueStep.value, baselineResult.data.collateralValue),
    tracked,
    sourceStatus,
  );
  if (!profitOrLossStep.ok) return profitOrLossStep.failure;
  tracked = profitOrLossStep.tracked;
  warnings.push(...profitOrLossStep.warnings);

  const leverageStep = formulaStep(
    calculateEffectiveLeverage(projectedPortfolio),
    tracked,
    sourceStatus,
  );
  if (!leverageStep.ok) return leverageStep.failure;
  tracked = leverageStep.tracked;
  warnings.push(...leverageStep.warnings);

  const scenarioSummary: ScenarioSummary = {
    label: scenarioLabel,
    equity: projectedEquityStep.value,
    profitOrLoss: profitOrLossStep.value,
    healthFactor: projectedHealthFactorStep.value,
    liquidationDistance: liquidationDistanceStep.value,
    debtCost: accruedInterest,
    leverage: leverageStep.value,
  };

  return finalize(
    proratedBaselineSummary,
    scenarioSummary,
    tracked,
    warnings,
    scenario,
    sourceStatus,
  );
}

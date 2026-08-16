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
 * §12).** This file previously imported `projectVariableDebt` from
 * `engine/protocols/aaveV3` directly — a hardcoded V3 assumption with no
 * version boundary, the exact architectural gap the audit identified.
 * Both `projectVariableDebt` call sites below now go through
 * `projectProtocolDebt({ protocolVersion, ... })` instead, resolving
 * `protocolVersion` from `portfolio.protocolVersion ?? 'v3'` once per call
 * to `simulateScenario`. For `'v3'` (every portfolio today —
 * `protocolVersion` is not settable anywhere yet), the dispatcher forwards
 * to the exact same, unmodified V3 projector: identical inputs, identical
 * outputs, identical `FormulaResult` metadata.
 *
 * **V4 interest-scenario dispatch (V4 Readiness Audit §12 Stage 8) — real
 * math now, not just a typed unsupported boundary.** `engine/protocols/aaveV4`'s
 * `projectAaveV4Debt` needs `drawnDebt`, `premiumDebt`, `baseDrawnApr`, and
 * `riskPremium` — Stage 6/7 gave `ApplicationPortfolio.v4DebtState` exactly
 * those four fields, live-synced from real on-chain reads (never
 * user-entered, never inferred). When `protocolVersion === 'v4'` AND
 * `v4DebtState` is present, both `projectProtocolDebt` calls below dispatch
 * to the V4 overload using `v4DebtState`'s own real values unchanged —
 * still through the same single dispatcher Stage 1/2 established, no
 * second V4 accrual implementation here. When `protocolVersion === 'v4'`
 * but `v4DebtState` is `undefined` (no UI can set it yet, and no live
 * sync has ever landed for this portfolio), this Service still fails
 * closed, now with `AAVE_V4_DEBT_STATE_MISSING` — distinct from the
 * Engine's own `PROTOCOL_VERSION_UNSUPPORTED`, because the reason is a
 * missing *data source* on this specific portfolio, not a missing Engine
 * implementation (there is one, and it runs whenever real data exists).
 *
 * **V4 rate stress — resolved at Stage 10 (V4 Readiness Audit §12),
 * previously an open boundary limitation.** `SimulationScenario`'s
 * `type: 'interest'` shape carries one scalar `borrowApr` field — a
 * stress-tested rate a V3 caller substitutes for the portfolio's own real
 * `protocol.borrowApr`. V4's real accrual model is genuinely two-parameter
 * (`baseDrawnApr` and `riskPremium`, which compound differently — premium
 * accrues proportional to *drawn* interest, not as a second flat rate), so
 * `scenario.borrowApr` was never reinterpreted for V4 — no audit finding
 * or task ever defined how a single V3 scalar should map onto that pair,
 * and Stage 10 does not invent one either. Instead, Stage 10 adds a
 * separate, explicit, optional `scenario.v4RateStress: { baseDrawnApr,
 * riskPremium }` field (`AaveV4RateStress`, defined just above
 * `SimulationScenario` below) that overrides `v4DebtState`'s own real
 * rates for the scenario-side V4 projection only. When omitted (every
 * caller before Stage 10, and any caller that still doesn't pass it), the
 * V4 branch behaves exactly as it did before this stage — both the
 * scenario-side and baseline-reproration-side projections use
 * `v4DebtState`'s own real, currently-effective `baseDrawnApr`/
 * `riskPremium` unconditionally, so `debtCost` again equals the reprorated
 * baseline's. When `v4RateStress` is supplied, only the scenario side
 * responds to it — the baseline reproration always uses the portfolio's
 * real current rates, the same "baseline never uses the scenario's own
 * stress rate" rule V3's own `borrowApr` already followed — so a V4
 * "rate stress test" now produces a real, non-degenerate baseline/scenario
 * `debtCost` gap, exactly like a V3 interest scenario always could.
 *
 * **Canonical V4 debt reconciliation (V4 Readiness Audit §12 Stage 9).**
 * Before this stage, `calculatePortfolioSummary`'s baseline — and
 * therefore this file's own `baselineSummary`, `type: 'price'` scenarios
 * (which never touch `projectProtocolDebt` at all), and Health Factor/
 * Net Worth/Liquidation everywhere they're computed from `engineInput` —
 * all silently read the legacy `ApplicationPortfolio.debt.balance` field
 * even for a `protocolVersion: 'v4'` portfolio, which Stage 6/7's live
 * sync never writes to and which can freely disagree with real synced
 * `v4DebtState`. `services/portfolio/mapping.ts`'s
 * `mapApplicationPortfolioToEngineInput` now resolves ONE canonical debt
 * balance (`v4DebtState.drawnDebt + v4DebtState.premiumDebt` for V4-with-
 * state, the legacy field otherwise) — this file's own `engineInput`,
 * `currentTotalDebt`, and `calculatePortfolioSummary`'s `baselineResult`
 * all derive from that single chokepoint, so no separate reconciliation
 * logic lives here. `calculatePortfolioSummary` also gained the
 * fail-closed guard for "v4 with no synced state" (see that file's own
 * header comment) — computed first, before either scenario-type branch
 * below runs, which is why this file's own interest-scenario branch no
 * longer needs its own copy of that guard (Stage 8 had one; removed this
 * stage as now-unreachable, not as a behavior change).
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
  type AaveV4DebtProjection,
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

import {
  mapApplicationPortfolioToEngineInput,
  projectAaveV4AnnualInterestCost,
} from '../portfolio/mapping';
import type { ApplicationPortfolio } from '../portfolio/models';
import { calculatePortfolioSummary, type PortfolioSummary } from '../portfolio/summary';
import { formulaStep, optionsFromTracked, type TrackedFormulaVersion } from '../shared/formulaStep';
import { createServiceSuccess, type ServiceResult, type ServiceWarning } from '../shared/result';

/**
 * V4-only rate stress override for an interest scenario (V4 Readiness
 * Audit §12 Stage 10) — the resolution to the "V4 interest-scenario
 * `scenario.borrowApr` is not applied" boundary this file's own header
 * comment previously documented as unresolved. `scenario.borrowApr`
 * itself is deliberately left untouched and unreinterpreted for V4: it
 * remains exactly what it always was, a V3-only stress rate substituted
 * for `protocol.borrowApr` (see `simulateScenario`'s V3 branch below,
 * unchanged). A V4 portfolio's real accrual model is genuinely
 * two-parameter (`baseDrawnApr` + `riskPremium`, which compound
 * differently — `AaveV4DebtState`'s own doc comment), so a V4 rate stress
 * needs its own two-field shape rather than overloading the V3 scalar.
 * Optional and additive: omitted, the V4 branch behaves exactly as before
 * Stage 10, projecting the portfolio's own real, currently-effective
 * `v4DebtState.baseDrawnApr`/`riskPremium` unchanged. When supplied, it
 * overrides those two rates for the scenario-side projection only — never
 * the baseline reproration, which must keep representing the portfolio's
 * real current cost for the comparison to mean anything (the same "the
 * baseline never uses the scenario's own stress rate" rule V3's own
 * `borrowApr` already follows). Ignored entirely for a `'v3'`/unset
 * portfolio, or a `'v4'` portfolio with no synced `v4DebtState` (which
 * fails closed before either scenario branch runs — see this file's
 * header comment).
 */
export interface AaveV4RateStress {
  baseDrawnApr: number;
  riskPremium: number;
}

export type SimulationScenario =
  | { type: 'price'; priceScenario: PriceScenarioInput }
  | {
      type: 'interest';
      priceScenario: PriceScenarioInput;
      timeHorizonDays: number;
      borrowApr: number;
      v4RateStress?: AaveV4RateStress;
    };

export interface SimulationResult {
  baseline: ScenarioSummary;
  scenario: ScenarioSummary;
  comparison: ScenarioComparisonResult;
  assumptions: SimulationScenario;
}

const BASELINE_LABEL = 'Current Portfolio';

/**
 * Backward-compatible default (V4 Readiness Audit §12 Stage 1) — every
 * portfolio that has never had `setProtocolVersion` (Stage 5) called on
 * it still has `protocolVersion: undefined` and resolves here. See
 * `services/portfolio/models.ts`'s own `protocolVersion` doc comment for
 * the full backward-compatibility reasoning.
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

/**
 * Resolves the single "total debt" scalar the interest-scenario branch's
 * shared downstream formulas need (`calculateNetWorth`/
 * `calculateHealthFactor`/`calculateLiquidationDistance`/
 * `calculatePortfolioGain`/`calculateEffectiveLeverage` all only ever
 * wanted one number) from whichever shape `projectProtocolDebt` actually
 * returned — V3's already-normalized `number`, or V4's
 * `AaveV4DebtProjection`. Not a re-implementation of V4's accrual math
 * (V4 Readiness Audit §12 Stage 8): `totalDebt` here is exactly the
 * Engine's own already-summed field
 * (`engine/protocols/aaveV4/projectAaveV4Debt.ts`'s own
 * `newDrawnDebtRay + newPremiumDebtRay`), read, not recomputed.
 */
function projectedDebtBalance(value: number | AaveV4DebtProjection): number {
  return typeof value === 'number' ? value : value.totalDebt;
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

    // V4 Readiness Audit §12 Stage 10 (resolves the Stage 9 NOTE previously
    // here): a price scenario never moves debt, so `priceResult.debtValue`
    // is the same canonical current total `engineInput.debt.balance`
    // already is. For a V4 portfolio with synced `v4DebtState`, `debtCost`
    // now comes from `projectAaveV4AnnualInterestCost` — the real V4 rate
    // model projected through the Engine's own validated accrual math —
    // instead of the V3-shaped `engineInput.protocol.borrowApr`, which was
    // amount-correct but rate-questionable for V4 (same fix as
    // `calculatePortfolioSummary`'s own `interestCost`).
    const debtCostStep =
      protocolVersion === 'v4' && portfolio.v4DebtState !== undefined
        ? formulaStep(projectAaveV4AnnualInterestCost(portfolio.v4DebtState), tracked, sourceStatus)
        : formulaStep(
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

  // Interest-scenario debt projection needs `projectProtocolDebt` — see
  // this file's header comment (Stage 8). A `'v4'` portfolio with no
  // synced `v4DebtState` (Stage 6/7) already failed closed above, at
  // `calculatePortfolioSummary`'s own guard (V4 Readiness Audit §12 Stage
  // 9 — `baselineResult` is computed from this same `portfolio` before
  // either scenario-type branch runs, so this Service never reaches this
  // line with `protocolVersion: 'v4'` and `v4DebtState` both true and
  // missing at once). `v4DebtState` is guaranteed defined below whenever
  // `protocolVersion === 'v4'`.
  const v4DebtState = portfolio.v4DebtState;

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
  // comment (Stage 8). Not `simulateInterestScenario`/
  // `calculateProratedInterest` (simple interest), which remain unchanged
  // for any other caller. `currentTotalDebt` is the value both this call
  // and the baseline reproration below start from: `engineInput.debt.balance`
  // — byte-identical to every V3 call before Stage 8, and, since Stage 9,
  // already the canonical `v4DebtState.drawnDebt + v4DebtState.premiumDebt`
  // sum for V4 too (`mapApplicationPortfolioToEngineInput` resolves it once,
  // centrally — see that function's own doc comment; this file no longer
  // duplicates that sum itself).
  const currentTotalDebt = engineInput.debt.balance;

  // V4 Readiness Audit §12 Stage 10 — `scenario.v4RateStress`, when
  // supplied, overrides `v4DebtState`'s own real rates for THIS
  // scenario-side projection only (see `AaveV4RateStress`'s own doc
  // comment above `SimulationScenario`). `scenario.borrowApr` remains V3-
  // only and is never read here, matching the V3 branch's own unchanged
  // behavior below.
  const projectedDebtStep =
    protocolVersion === 'v4' && v4DebtState !== undefined
      ? formulaStep(
          projectProtocolDebt({
            protocolVersion: 'v4',
            drawnDebt: v4DebtState.drawnDebt,
            premiumDebt: v4DebtState.premiumDebt,
            baseDrawnApr: scenario.v4RateStress?.baseDrawnApr ?? v4DebtState.baseDrawnApr,
            riskPremium: scenario.v4RateStress?.riskPremium ?? v4DebtState.riskPremium,
            elapsedDays: scenario.timeHorizonDays,
          }),
          tracked,
          sourceStatus,
        )
      : formulaStep(
          projectProtocolDebt({
            protocolVersion: 'v3',
            currentDebt: engineInput.debt.balance,
            borrowApr: scenario.borrowApr,
            elapsedDays: scenario.timeHorizonDays,
          }),
          tracked,
          sourceStatus,
        );
  if (!projectedDebtStep.ok) return projectedDebtStep.failure;
  tracked = projectedDebtStep.tracked;
  warnings.push(...projectedDebtStep.warnings);
  const projectedDebt = projectedDebtBalance(projectedDebtStep.value);
  const accruedInterest = projectedDebt - currentTotalDebt;

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
  // rather than the scenario's own (possibly stress-tested) borrowApr. For
  // V4 this starts from the same `currentTotalDebt`
  // (`v4DebtState.drawnDebt + v4DebtState.premiumDebt`) as the scenario
  // side above, not `baselineResult.data.debtValue` (which is
  // `debt.balance`-derived and may not reflect the live-synced V4 state)
  // — see this file's header comment for why `v4DebtState`'s own real
  // `baseDrawnApr`/`riskPremium` are used unconditionally here (Stage 10's
  // `scenario.v4RateStress`, unlike the scenario side above, is NEVER read
  // on the baseline side — the baseline must keep representing the
  // portfolio's real current cost, or the comparison stops meaning
  // anything).
  const baselineProjectedDebtStep =
    protocolVersion === 'v4' && v4DebtState !== undefined
      ? formulaStep(
          projectProtocolDebt({
            protocolVersion: 'v4',
            drawnDebt: v4DebtState.drawnDebt,
            premiumDebt: v4DebtState.premiumDebt,
            baseDrawnApr: v4DebtState.baseDrawnApr,
            riskPremium: v4DebtState.riskPremium,
            elapsedDays: scenario.timeHorizonDays,
          }),
          tracked,
          sourceStatus,
        )
      : formulaStep(
          projectProtocolDebt({
            protocolVersion: 'v3',
            currentDebt: baselineResult.data.debtValue,
            borrowApr: engineInput.protocol.borrowApr,
            elapsedDays: scenario.timeHorizonDays,
          }),
          tracked,
          sourceStatus,
        );
  if (!baselineProjectedDebtStep.ok) return baselineProjectedDebtStep.failure;
  tracked = baselineProjectedDebtStep.tracked;
  warnings.push(...baselineProjectedDebtStep.warnings);
  const proratedBaselineSummary: ScenarioSummary = {
    ...baselineSummary,
    debtCost: projectedDebtBalance(baselineProjectedDebtStep.value) - currentTotalDebt,
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

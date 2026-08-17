/**
 * Scenario Builder input resolution — 06_TASKS.md M6-006 ("Implement
 * Interest Rate Simulation", Batch 6) + M6-007 ("Implement Time
 * Projection", Batch 7). Pure, Store-independent helpers that turn the
 * Scenario Builder's current form values into the
 * `PriceScenarioInput`/`timeHorizonDays` pieces `simulateScenario`'s own
 * `type: 'interest'` variant requires alongside Borrow Rate. No Engine
 * access, no new calculation — just reading already-validated form
 * state into the Service's own input shape, matching
 * `04_BUILD_GUIDE.md`'s own "Only services communicate directly with
 * the Formula Engine" rule already followed since Batch 4.
 *
 * **Reuses whichever price input the user already has active** — the
 * same precedence `ScenarioBuilder.tsx`'s own BTC Price/Percentage
 * Change handlers already use since Batch 3/4: a valid Percentage
 * Change value takes priority when present; otherwise the absolute BTC
 * Price field (always pre-filled with the portfolio's own current
 * price) is used — equivalent to "no percentage override," never a
 * fabricated third default.
 *
 * **Time horizon reuses the Holding Period field built in M6-004,
 * Batch 3.** `simulateInterestScenario` (M2-020) structurally requires
 * a `timeHorizonDays` value to run at all; Batch 3 already built and
 * validated exactly this field (`holdingPeriod`/`customHoldingPeriodDays`,
 * matching M6-007's own "Support: 30 days/90 days/180 days/1 year/Custom
 * duration" list verbatim) as one of M6-004's own six named fields.
 *
 * **"Rate increase," "Rate decrease," and "Custom rate" are not three
 * separate inputs or preset buttons** — unlike M6-005's own "Preset
 * scenarios" item, M6-006's Include list names no presets. The single,
 * already-built, free-form Borrow Rate field (any value above, below,
 * or unrelated to the portfolio's own current rate) already satisfies
 * all three by construction.
 *
 * **`resolveInterestScenario` (Batch 7)**: the one place that combines
 * all three pieces (Borrow Rate + resolved price + resolved time
 * horizon) into a complete `SimulationScenario`. Batch 6 inlined this
 * directly in `ScenarioBuilder.tsx`'s own Borrow Rate handler; Batch 7
 * extracts it here so the Holding Period/Custom Duration handlers can
 * reuse the exact same construction (see `ScenarioBuilder.tsx`'s own
 * header comment for why Holding Period changes now also re-trigger a
 * live calculation, satisfying M6-007's own "Project portfolio changes
 * over time" Description — not just capturing the value passively at
 * Borrow-Rate-change time, which is all Batch 6 did).
 *
 * **`borrowAprEstablished` / `v4RateStress` — V4 Readiness Audit §12
 * Stage 20.** `scenario.borrowApr` (below) is always set from the
 * form's own current value, unchanged — V3's own semantics, exactly as
 * before. For V4, `scenario.borrowApr` is never read by
 * `services/simulation/scenario.ts`'s V4 branch at all; the mechanism
 * that actually reaches V4's real accrual model is `AaveV4RateStress`
 * (`services/simulation/scenario.ts`'s own Stage 10 addition).
 *
 * **`AaveV4RateStress.baseDrawnApr` is NOT the same quantity as the
 * canonical "effective borrow rate" (`deriveAaveV4EffectiveBorrowRate`,
 * Stage 15/17) shown elsewhere as this field's own default value — see
 * `resolveEffectiveBorrowRate.ts`'s own header comment for the full
 * derivation of why they differ (a blended whole-position rate vs. the
 * raw drawn-only rate `riskPremium` is layered on top of separately).**
 * Submitting the form's default, UNTOUCHED value as `baseDrawnApr`
 * would double-count `riskPremium`'s effect for any position with
 * nonzero `premiumDebt`. `borrowAprEstablished` (threaded in from
 * `ScenarioBuilder.tsx`'s own field-level "has the user actually typed
 * into Borrow Rate" tracking — the exact same pattern
 * `LoopStrategyControls.tsx`'s own `rateEstablishedRef` already uses,
 * reused here rather than inventing a second interaction model) gates
 * this: while `false`, no `v4RateStress` is sent at all, so the real
 * portfolio's own current, unstressed `baseDrawnApr`/`riskPremium`
 * apply — which is exactly what produced the displayed default in the
 * first place, so this is self-consistent, not a silent no-op. Once
 * `true` (the user has genuinely edited the field), the typed value
 * becomes `v4RateStress.baseDrawnApr` directly — an absolute
 * replacement for the raw base rate, the same semantics
 * `scenario.borrowApr` already has for V3 — with `riskPremium` carried
 * over from the portfolio's own real, current value, applied exactly
 * once, by the Engine itself, never touched here.
 */
import type { ApplicationPortfolio, PriceScenarioInput, SimulationScenario } from '@/services';

import type { ScenarioBuilderFormValues } from '../types/scenarioBuilder';
import { validateScenarioBuilderInput } from './validateScenarioBuilderInput';

export function resolvePriceScenarioInput(
  values: ScenarioBuilderFormValues,
  portfolio: ApplicationPortfolio,
): PriceScenarioInput | null {
  const errors = validateScenarioBuilderInput(values, portfolio);

  if (values.percentageChange.trim() !== '') {
    if (errors.percentageChange !== null) return null;
    return { type: 'percentageChange', percentageChange: Number(values.percentageChange) / 100 };
  }

  if (errors.btcPriceUsd !== null) return null;
  return { type: 'absolute', btcPriceUsd: Number(values.btcPriceUsd) };
}

export function resolveTimeHorizonDays(values: ScenarioBuilderFormValues): number | null {
  if (values.holdingPeriod !== 'custom') {
    return Number(values.holdingPeriod);
  }

  const customDays = Number(values.customHoldingPeriodDays);
  if (!Number.isFinite(customDays) || customDays <= 0 || !Number.isInteger(customDays)) {
    return null;
  }
  return customDays;
}

export function resolveInterestScenario(
  values: ScenarioBuilderFormValues,
  portfolio: ApplicationPortfolio,
  borrowAprEstablished: boolean,
): SimulationScenario | null {
  const errors = validateScenarioBuilderInput(values, portfolio);
  if (errors.borrowApr !== null) return null;

  const priceScenario = resolvePriceScenarioInput(values, portfolio);
  const timeHorizonDays = resolveTimeHorizonDays(values);
  if (priceScenario === null || timeHorizonDays === null) return null;

  return {
    type: 'interest',
    priceScenario,
    timeHorizonDays,
    // V3-only; services/simulation/scenario.ts's V4 branch never reads
    // this field (see this file's own header comment). Kept unchanged,
    // unconditionally, for both protocol versions — V3's own semantics.
    borrowApr: Number(values.borrowApr) / 100,
    ...(portfolio.protocolVersion === 'v4' &&
      borrowAprEstablished &&
      portfolio.v4DebtState !== undefined && {
        v4RateStress: {
          // The user's typed value, absolute — this is the raw
          // AaveV4DebtState.baseDrawnApr the Engine applies to the
          // drawn-debt stream, NOT the blended "effective borrow rate"
          // this field displayed as its own default before being
          // established. See this file's own header comment.
          baseDrawnApr: Number(values.borrowApr) / 100,
          // Unstressed — carried from the portfolio's real, current
          // value so riskPremium is applied exactly once, by the Engine
          // itself, never doubled up with anything already blended into
          // a displayed rate.
          riskPremium: portfolio.v4DebtState.riskPremium,
        },
      }),
  };
}

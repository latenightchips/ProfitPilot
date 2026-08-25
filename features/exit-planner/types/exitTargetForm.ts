import { z } from 'zod';

import { EXIT_PLANNER_TYPES, type ExitPlannerType } from '@/stores/exitPlannerStore';

export { EXIT_PLANNER_TYPES, type ExitPlannerType };

/**
 * Exit Planner Target Form — 06_TASKS.md M7-022 ("Implement Exit Target
 * Form"), also covers M7-021 ("Implement Exit Type Selection")'s own
 * per-type field requirement. Inputs may include: "Target BTC price,
 * Debt repayment amount, Target Health Factor, BTC quantity to retain,
 * Debt balance to retain, Cash proceeds target, Fees, Slippage, Gas
 * estimate." Requirements: "Use React Hook Form and Zod. Clearly
 * distinguish target price from current price."
 *
 * **`ExitPlannerType` itself is defined in `stores/exitPlannerStore.ts`,
 * not here** — see that file's own header comment for why (the Store
 * owns the shape; this file only converts to/from it for RHF/Zod).
 *
 * **"Cash proceeds target" is excluded — see
 * `stores/exitPlannerStore.ts`'s own header comment (Conflict #10).**
 * "Fees," "Slippage," and "Gas estimate" are excluded for the same
 * reason `LoopStrategyControls.tsx` excludes them (V4 Readiness Audit
 * §12 P1-6) — conflict #8 is resolved, but as portfolio-level settings
 * (`Portfolio.settings.executionCostAssumptions`), edited once on the
 * Portfolio Details form, not as a per-target override here. `ExitTargetForm`
 * receives the already-resolved value as a separate prop and passes it
 * straight through to `runExitCalculation`/`runPriceSensitivity`, never
 * rendering an editable input for it — the shared
 * `StrategyAssumptionsPanel` this route also renders is where the
 * configured values (or their absence) are shown.
 *
 * **"Target BTC price" is a field on every type's schema, not a
 * standalone type** — mirrors `calculateExitPosition`'s own
 * `scenarioBtcPriceUsd` (optional, defaults to the portfolio's current
 * market price), satisfying "Clearly distinguish target price from
 * current price" by making it an explicit override alongside whichever
 * type-specific target field is shown, always paired with the
 * portfolio's own real current price displayed via
 * `StrategyAssumptionsPanel`.
 *
 * **One schema per type, not one shared schema with conditional
 * `superRefine` branches.** Each type renders exactly one type-specific
 * field (M7-021's own Requirement: "Display only fields relevant to the
 * selected exit type"), so each type's schema only needs to validate
 * what is actually rendered — simpler and more direct than one giant
 * schema branching on a discriminant field.
 *
 * **Validation here is format-level only (sign, positivity) — never a
 * feasibility bound against the portfolio's current debt/collateral.**
 * `calculateTargetExit` (F-040) already reports infeasibility as data
 * (`feasible: false`, an explanatory reason), the same "unsafe but
 * well-formed" convention `validateLoopStrategySafety` established —
 * duplicating a feasibility bound here would risk a UI-layer message
 * that disagrees with the Engine's own, already-tested reasoning.
 *
 * **`scenarioBtcPriceUsd` preprocesses `NaN` to `undefined` before
 * `.optional()` ever sees it — a real, found-not-assumed gap, not
 * defensive padding.** `register(name, { valueAsNumber: true })` (RHF)
 * runs `parseFloat` on an empty `<input type="number">`, which yields
 * `NaN`, not `undefined` — Zod's own `.optional()` only tolerates a
 * genuinely missing/`undefined` key, so an untouched, legitimately-
 * empty "Target BTC Price" field (the common case: most users leave it
 * blank and take the portfolio's own current price) would otherwise
 * fail validation with a confusing "expected number, received NaN"
 * message. Found via this batch's own test suite, not a hypothetical —
 * see `tests/unit/features/exit-planner/ExitTargetForm.test.tsx`.
 */
function optionalScenarioPrice() {
  return z.preprocess(
    (value) => (typeof value === 'number' && Number.isNaN(value) ? undefined : value),
    z.coerce.number().positive().optional(),
  );
}

export const exitTargetFormSchemas = {
  fullExit: z.object({ scenarioBtcPriceUsd: optionalScenarioPrice() }),
  partialDebtRepayment: z.object({
    repaymentAmount: z.coerce.number().positive(),
    scenarioBtcPriceUsd: optionalScenarioPrice(),
  }),
  targetHealthFactor: z.object({
    targetHealthFactor: z.coerce.number().positive(),
    scenarioBtcPriceUsd: optionalScenarioPrice(),
  }),
  targetRetainedBtc: z.object({
    targetRetainedBtc: z.coerce.number().nonnegative(),
    scenarioBtcPriceUsd: optionalScenarioPrice(),
  }),
  targetDebtBalance: z.object({
    targetDebtBalance: z.coerce.number().nonnegative(),
    scenarioBtcPriceUsd: optionalScenarioPrice(),
  }),
} as const satisfies Record<ExitPlannerType, z.ZodType>;

export type ExitTargetFormValues<T extends ExitPlannerType> = z.input<
  (typeof exitTargetFormSchemas)[T]
>;

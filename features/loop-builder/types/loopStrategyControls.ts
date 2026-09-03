import { z } from 'zod';

import { riskCapacityLabel } from '../utils/riskCapacityLabel';

/**
 * Loop Strategy Controls form schema — 06_TASKS.md M7-008 ("Implement
 * Loop Strategy Controls"). Requirement: "Use React Hook Form and Zod."
 * `z.coerce.number()` handles the `<input type="number">` string values
 * RHF's `register` hands back before `valueAsNumber` normalizes them —
 * the same coercion precedent already established wherever this
 * codebase validates a numeric HTML input via Zod.
 *
 * `borrowPercentagePerStep`/`maxLoanToValue`/`borrowRateAssumption` are
 * stored/validated here as a 0–1 fraction (unchanged — matches
 * `services/loop/strategy.ts`'s own `LoopStrategySettings` shape), but
 * the UI boundary (`LoopStrategyControls.tsx`) converts to/from a 0–100
 * percentage for display — 06_TASKS.md UX punch-list UX-06. These bound
 * messages describe the percentage the user actually typed, not the
 * internal fraction, so a violation reads correctly regardless of which
 * side of that conversion produced it.
 *
 * **`maxLoanToValue`'s own validation messages are built from
 * `riskCapacityLabel` (V4 semantic audit, Batch 2 / A1), not a
 * hardcoded "Maximum LTV."** These messages render verbatim in the UI
 * (`LoopStrategyControls.tsx`'s `errors.maxLoanToValue.message`), so a
 * V4 portfolio typing an out-of-range Collateral Factor previously saw
 * an error calling it "Maximum LTV" — the same V3-oriented leak as the
 * field's own on-screen label, now fixed the same way. The field's
 * *name* (`maxLoanToValue`) and its stored 0–1 fraction semantics are
 * unchanged — only the user-visible wording in these three messages.
 */
export function buildLoopStrategyControlsSchema(protocolVersion: 'v3' | 'v4' | undefined) {
  const label = riskCapacityLabel(protocolVersion);
  return z.object({
    borrowPercentagePerStep: z.coerce
      .number({ error: 'Enter how much to borrow each loop, as a percentage.' })
      .min(0, 'Borrow percentage per step must be between 0% and 100%.')
      .max(100, 'Borrow percentage per step must be between 0% and 100%.'),
    maxLoops: z.coerce.number().int().min(1),
    minHealthFactor: z.coerce.number().positive(),
    maxLoanToValue: z.coerce
      .number({ error: `Enter ${label} as a percentage.` })
      .min(0, `${label} must be between 0% and 100%.`)
      .max(100, `${label} must be between 0% and 100%.`),
    borrowRateAssumption: z.coerce
      .number({ error: 'Enter the borrow interest rate assumption as a percentage.' })
      .min(0, 'Borrow interest rate assumption cannot be negative.'),
  });
}

export type LoopStrategyControlsFormValues = z.input<
  ReturnType<typeof buildLoopStrategyControlsSchema>
>;
export type LoopStrategyControlsFormOutput = z.output<
  ReturnType<typeof buildLoopStrategyControlsSchema>
>;

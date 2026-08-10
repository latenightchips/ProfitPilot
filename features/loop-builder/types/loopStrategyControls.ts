import { z } from 'zod';

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
 */
export const loopStrategyControlsSchema = z.object({
  borrowPercentagePerStep: z.coerce
    .number({ error: 'Enter how much to borrow each loop, as a percentage.' })
    .min(0, 'Borrow percentage per step must be between 0% and 100%.')
    .max(100, 'Borrow percentage per step must be between 0% and 100%.'),
  maxLoops: z.coerce.number().int().min(1),
  minHealthFactor: z.coerce.number().positive(),
  maxLoanToValue: z.coerce
    .number({ error: 'Enter Maximum LTV as a percentage.' })
    .min(0, 'Maximum LTV must be between 0% and 100%.')
    .max(100, 'Maximum LTV must be between 0% and 100%.'),
  borrowRateAssumption: z.coerce
    .number({ error: 'Enter the borrow interest rate assumption as a percentage.' })
    .min(0, 'Borrow interest rate assumption cannot be negative.'),
});

export type LoopStrategyControlsFormValues = z.input<typeof loopStrategyControlsSchema>;
export type LoopStrategyControlsFormOutput = z.output<typeof loopStrategyControlsSchema>;

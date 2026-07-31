import { z } from 'zod';

/**
 * Loop Strategy Controls form schema — 06_TASKS.md M7-008 ("Implement
 * Loop Strategy Controls"). Requirement: "Use React Hook Form and Zod."
 * `z.coerce.number()` handles the `<input type="number">` string values
 * RHF's `register` hands back before `valueAsNumber` normalizes them —
 * the same coercion precedent already established wherever this
 * codebase validates a numeric HTML input via Zod.
 */
export const loopStrategyControlsSchema = z.object({
  borrowPercentagePerStep: z.coerce.number().min(0).max(1),
  maxLoops: z.coerce.number().int().min(1),
  minHealthFactor: z.coerce.number().positive(),
  maxLoanToValue: z.coerce.number().min(0).max(1),
  borrowRateAssumption: z.coerce.number().min(0),
});

export type LoopStrategyControlsFormValues = z.input<typeof loopStrategyControlsSchema>;
export type LoopStrategyControlsFormOutput = z.output<typeof loopStrategyControlsSchema>;

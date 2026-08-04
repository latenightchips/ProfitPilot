/**
 * Persisted Strategy payload validation — 06_TASKS.md M8-005's "Strategy
 * data" item. Covers `'loopStrategy'`, `'exitPlan'`, `'simulation'`, and
 * `'recommendationAcknowledgements'` records.
 *
 * Identifiers/timestamps/portfolio-linkage fields are validated strictly
 * (`id`, `name`, `portfolioId`, `portfolioUpdatedAt`, `createdAt`) —
 * these are exactly M8-005's own "Identifiers"/"Timestamps" validation
 * items. The nested Engine/Service-result fields (`result`, `settings`,
 * `scenario`) use `looseRecordSchema` — see `./shared.schema.ts`'s own
 * header comment for why a deep re-specification is out of scope here.
 */
import { z } from 'zod';

import { looseRecordSchema, serviceMetadataSchema, strategyWarningSchema } from './shared.schema';

export const persistedLoopStrategyPayloadSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  portfolioId: z.string().min(1),
  portfolioUpdatedAt: z.string().datetime(),
  settings: looseRecordSchema,
  result: looseRecordSchema,
  warnings: z.array(strategyWarningSchema),
  metadata: serviceMetadataSchema.nullable(),
  createdAt: z.string().datetime(),
});

/**
 * Mirrors `stores/exitPlannerStore.ts`'s own `EXIT_PLANNER_TYPES` list
 * exactly, rather than a bare non-empty string — small and fully known,
 * unlike the deep Engine-result fields around it.
 */
const exitPlannerTypeSchema = z.enum([
  'fullExit',
  'partialDebtRepayment',
  'targetHealthFactor',
  'targetRetainedBtc',
  'targetDebtBalance',
]);

export const persistedExitPlanPayloadSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  portfolioId: z.string().min(1),
  portfolioUpdatedAt: z.string().datetime(),
  exitType: exitPlannerTypeSchema,
  targetInputs: looseRecordSchema,
  result: looseRecordSchema,
  warnings: z.array(strategyWarningSchema),
  metadata: serviceMetadataSchema.nullable(),
  createdAt: z.string().datetime(),
});

export const persistedSimulationPayloadSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable(),
  portfolioId: z.string().min(1),
  portfolioUpdatedAt: z.string().datetime(),
  scenario: looseRecordSchema,
  result: looseRecordSchema,
  metadata: serviceMetadataSchema.nullable(),
  createdAt: z.string().datetime(),
});

/**
 * Mirrors `stores/recommendationCenterStore.ts`'s own
 * `AcknowledgementsByPortfolio` shape exactly: portfolio ID → item ID →
 * a snapshot of the relevant numeric values acknowledged at that time.
 * Fully specifiable without any Engine-result ambiguity, unlike the
 * three schemas above.
 */
export const persistedRecommendationAcknowledgementsPayloadSchema = z.record(
  z.string(),
  z.record(z.string(), z.record(z.string(), z.number())),
);

/**
 * Shared sub-schemas reused across the Strategy payload schemas
 * (`./strategy.schema.ts`) — 06_TASKS.md M8-005's "Strategy data" and
 * "Metadata" items.
 *
 * `StrategyWarning` (`types/strategy.ts`, M7-005) and `ServiceMetadata`
 * (`services/shared/result.ts`, M3-002) are both small, stable,
 * cross-cutting shapes already living in shared (non-Store) layers, so
 * validating them field-for-field here carries none of the drift risk a
 * full re-specification of a deep Engine-result type would.
 */
import { z } from 'zod';

export const strategyWarningSchema = z.object({
  category: z.enum([
    'safety',
    'liquidation',
    'borrowingCapacity',
    'interestBurden',
    'transactionCost',
    'staleData',
    'invalidTarget',
    'infeasibleStrategy',
  ]),
  severity: z.enum(['error', 'warning']),
  cause: z.string().min(1),
  suggestedResponse: z.string().min(1),
});

export const serviceMetadataSchema = z.object({
  sourceStatus: z.string(),
  calculationTimestamp: z.string().datetime(),
  engineVersion: z.string().min(1),
  formulaVersion: z.string().min(1),
});

/**
 * Deliberately shallow — "looks like a real object," not a field-by-field
 * re-specification of a deep Engine/Service result type
 * (`LoopStrategyPreview`, `ExitPlanResult`, `SimulationResult`,
 * `LoopStrategySettings`, `SimulationScenario`). Those types are already
 * enforced at their own layer (Engine golden tests, Service-level
 * TypeScript); duplicating their exact shape here would drift out of
 * sync as they evolve and would not protect against anything the
 * envelope/identifier/timestamp checks around it don't already cover.
 * What this *does* catch: a corrupted or truncated stored/imported value
 * that is not a plain object at all (a string, `null`, an array, a
 * primitive) — the real failure mode local storage corruption or a
 * malformed import file produces.
 */
export const looseRecordSchema = z.record(z.string(), z.unknown());

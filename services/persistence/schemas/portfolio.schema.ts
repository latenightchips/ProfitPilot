/**
 * Persisted Portfolio payload validation — 06_TASKS.md M8-005's "Portfolio
 * data" item.
 *
 * Reuses the individual field schemas `types/portfolio.schema.ts`
 * already defines (`collateralPositionSchema`, `debtPositionSchema`,
 * `marketPricesSchema`, `protocolParametersSchema`,
 * `portfolioSettingsSchema`) rather than redefining bounds that could
 * drift from the Engine-aligned rules that file already documents.
 * `types/` is a shared, low-level directory every layer already imports
 * from safely (`services/portfolio/mapping.ts` does today), so this is
 * not a reverse dependency — see `../types/models.ts`'s own header
 * comment for why the same is not done for Store-owned types.
 *
 * Adds exactly the fields `types/portfolio.ts`'s `Portfolio` has beyond
 * `portfolioInputSchema` (`id`, `archivedAt`, `marketUpdatedAt`,
 * `protocolUpdatedAt`, `createdAt`, `updatedAt`) — field-for-field, no
 * more, no less.
 *
 * **`name`/`description` sanitized (Milestone 8 Batch 6, M8-052)** — see
 * `services/shared/sanitizeText.ts`'s own header comment for what this
 * does and doesn't defend against. This is the write/import choke point
 * both a normal `create`/`update` and an imported portfolio pass through.
 *
 * **`protocolVersion`/`v4Position` (V4 Readiness Audit §12 Stage 5)** —
 * both optional, matching `ApplicationPortfolio`'s own optionality
 * (`services/portfolio/models.ts`) and `Portfolio`'s inherited fields
 * (`types/portfolio.ts`). Their absence here before Stage 5 was the
 * actual bug this stage closes, not a deliberate omission like the ones
 * documented above: `autoSaveCoordinator`/`persistenceService` validate
 * every portfolio write against this exact schema
 * (`../validate.ts`/`./index.ts`'s `PAYLOAD_SCHEMAS_BY_RECORD_TYPE`), and
 * Zod's `z.object()` silently strips any key not listed here on
 * `.parse()` — so before this change, a portfolio carrying either field
 * in memory would have had it discarded on the very next autosave, even
 * though `types/portfolio.ts`'s `Portfolio extends ApplicationPortfolio`
 * already made both fields structurally legal. Reuses
 * `protocolVersionSchema`/`aaveV4PositionIdentitySchema` directly (the
 * same schemas `stores/portfolioStore.ts`'s new `setProtocolVersion`/
 * `setAaveV4Position` actions validate against) rather than redefining
 * either shape here.
 *
 * **`v4DebtState` (V4 Readiness Audit §12 Stage 6)** — same reasoning and
 * same "extend model, schema, and Store action together" discipline as
 * `v4Position` above, now for `services/portfolio/models.ts`'s
 * `AaveV4DebtState` (drawn/premium debt, base drawn rate, risk premium).
 * Reuses `aaveV4DebtStateSchema` directly.
 *
 * **`v4CollateralRisk` (V4 Readiness Audit §12 Stage 23C)** — same
 * discipline again, now for `services/portfolio/models.ts`'s
 * `AaveV4CollateralRiskConfig` (collateral factor, dynamic-config key).
 * Reuses `aaveV4CollateralRiskConfigSchema` directly.
 *
 * **`v4DebtStateSource`/`v4CollateralRiskSource` (V4 Readiness Audit §12
 * Stage 25)** — same discipline again, for `services/portfolio/models.ts`'s
 * `AaveV4DataSource`. Both optional, independently: a portfolio persisted
 * before Stage 25 has neither, even though it may already carry a real
 * `v4DebtState`/`v4CollateralRisk` (necessarily from a live sync, since
 * manual entry did not exist before this stage) — `stores/portfolioStore.ts`'s
 * `load()` is where that historical gap gets a conservative, provable
 * default (`'manual'`, never a silently-assumed `'live'`), not this
 * schema. This schema only needs to round-trip whatever the Store
 * already attached, on both read and write.
 *
 * **`v4DebtStateUpdatedAt`/`v4CollateralRiskUpdatedAt` (V4 Readiness Audit
 * §12 P2-1)** — same discipline again, for `services/portfolio/models.ts`'s
 * new freshness timestamps. Both optional, independently, for the same
 * reason as `v4DebtStateSource`/`v4CollateralRiskSource`: a portfolio
 * persisted before P2-1 has neither, and this schema just needs to
 * round-trip whatever `stores/portfolioStore.ts`'s `setAaveV4DebtState`/
 * `setAaveV4CollateralRisk` already attached — no backfill, no fabricated
 * timestamp for old data.
 */
import { z } from 'zod';

import { sanitizedOptionalTextSchema, sanitizedTextSchema } from '@/services/shared/sanitizeText';
import {
  aaveV4CollateralRiskConfigSchema,
  aaveV4DataSourceSchema,
  aaveV4DebtStateSchema,
  aaveV4PositionIdentitySchema,
  collateralPositionSchema,
  debtPositionSchema,
  marketPricesSchema,
  portfolioSettingsSchema,
  protocolParametersSchema,
  protocolVersionSchema,
} from '@/types/portfolio.schema';

export const persistedPortfolioPayloadSchema = z.object({
  id: z.string().min(1),
  name: sanitizedTextSchema('Portfolio name is required.'),
  description: sanitizedOptionalTextSchema(),
  baseCurrency: z.string().min(1),
  collateral: collateralPositionSchema,
  debt: debtPositionSchema,
  market: marketPricesSchema,
  protocol: protocolParametersSchema,
  // V1.1 Batch 1 (Live-Data Trust Parity) — see `ApplicationPortfolio`'s
  // own doc comment (`services/portfolio/models.ts`) for why this reuses
  // `aaveV4DataSourceSchema` rather than a duplicate schema.
  marketSource: aaveV4DataSourceSchema.optional(),
  protocolSource: aaveV4DataSourceSchema.optional(),
  settings: portfolioSettingsSchema,
  protocolVersion: protocolVersionSchema.optional(),
  v4Position: aaveV4PositionIdentitySchema.optional(),
  v4DebtState: aaveV4DebtStateSchema.optional(),
  v4CollateralRisk: aaveV4CollateralRiskConfigSchema.optional(),
  v4DebtStateSource: aaveV4DataSourceSchema.optional(),
  v4CollateralRiskSource: aaveV4DataSourceSchema.optional(),
  v4DebtStateUpdatedAt: z.string().datetime().optional(),
  v4CollateralRiskUpdatedAt: z.string().datetime().optional(),
  // V4 Mixed-Provenance UX batch — see `ApplicationPortfolio`'s own doc
  // comment (`services/portfolio/models.ts`). Optional for the same
  // backward-compatibility reason as every other V4 field here: a
  // portfolio persisted before this batch has it `undefined`, even if it
  // already carries a real `v4DebtState` — `stores/portfolioStore.ts`'s
  // `load()` normalization backfills the conservative `'manual'` default,
  // not this schema.
  v4BaseDrawnAprSource: aaveV4DataSourceSchema.optional(),
  archivedAt: z.string().datetime().nullable(),
  marketUpdatedAt: z.string().datetime(),
  protocolUpdatedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

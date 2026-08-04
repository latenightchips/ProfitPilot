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
 */
import { z } from 'zod';

import {
  collateralPositionSchema,
  debtPositionSchema,
  marketPricesSchema,
  portfolioSettingsSchema,
  protocolParametersSchema,
} from '@/types/portfolio.schema';

export const persistedPortfolioPayloadSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  baseCurrency: z.string().min(1),
  collateral: collateralPositionSchema,
  debt: debtPositionSchema,
  market: marketPricesSchema,
  protocol: protocolParametersSchema,
  settings: portfolioSettingsSchema,
  archivedAt: z.string().datetime().nullable(),
  marketUpdatedAt: z.string().datetime(),
  protocolUpdatedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

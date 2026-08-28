/**
 * Persisted Portfolio History Entry payload validation — V1.1 Batch 2
 * ("Portfolio History & Risk Timeline"). Mirrors
 * `../types/models.ts`'s `PersistedPortfolioHistoryEntry` field-for-field,
 * the same discipline every other payload schema in this directory
 * already follows.
 */
import { z } from 'zod';

export const portfolioHistoryProtocolVersionSchema = z.enum(['v3', 'v4']);
export const portfolioHistoryDataSourceSchema = z.enum(['manual', 'live']);

export const persistedPortfolioHistoryEntryPayloadSchema = z.object({
  portfolioId: z.string().min(1),
  protocolVersion: portfolioHistoryProtocolVersionSchema,
  createdAt: z.string().datetime(),
  collateral: z.object({
    quantity: z.number().finite(),
    valueUsd: z.number().finite(),
  }),
  debt: z.object({
    asset: z.string().min(1),
    quantity: z.number().finite(),
    valueUsd: z.number().finite(),
  }),
  marketPriceUsd: z.number().finite(),
  healthFactor: z.number().finite().nullable(),
  liquidationPriceUsd: z.number().finite().nullable(),
  loanToValue: z.number().finite(),
  leverage: z.number().finite(),
  borrowApr: z.number().finite().optional(),
  supplyApr: z.number().finite().optional(),
  annualizedInterestCost: z.number().finite(),
  dataSource: portfolioHistoryDataSourceSchema,
});

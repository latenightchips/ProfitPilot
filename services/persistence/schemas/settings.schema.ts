/**
 * Persisted Preferences / Active Portfolio payload validation —
 * 06_TASKS.md M8-005's "Settings" item, extended in Milestone 8 Batch 2
 * for M8-007's "Active portfolio" key. Mirrors `../types/models.ts`'s
 * `PersistedPreferences`/`PersistedActivePortfolio` field-for-field.
 */
import { z } from 'zod';

export const persistedPreferencesPayloadSchema = z.object({
  developerModeEnabled: z.boolean(),
});

export const persistedActivePortfolioPayloadSchema = z.object({
  portfolioId: z.string().min(1).nullable(),
});

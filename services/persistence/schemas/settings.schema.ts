/**
 * Persisted Preferences payload validation — 06_TASKS.md M8-005's
 * "Settings" item. Mirrors `../types/models.ts`'s `PersistedPreferences`
 * field-for-field.
 */
import { z } from 'zod';

export const persistedPreferencesPayloadSchema = z.object({
  developerModeEnabled: z.boolean(),
});

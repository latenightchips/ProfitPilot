/**
 * Persistence schemas — public entry point, plus the
 * record-type-to-payload-schema registry `../validate.ts` (M8-005) uses
 * to validate a record without the caller having to name its own schema
 * every time.
 */
import type { ZodTypeAny } from 'zod';

import type { PersistedRecordType } from '../types/envelope';
import {
  persistedApplicationMetadataPayloadSchema,
  persistedSyncMetadataPayloadSchema,
} from './metadata.schema';
import { persistedPortfolioPayloadSchema } from './portfolio.schema';
import { persistedRecoverySnapshotPayloadSchema } from './recoverySnapshot.schema';
import {
  persistedActivePortfolioPayloadSchema,
  persistedPreferencesPayloadSchema,
} from './settings.schema';
import {
  persistedExitPlanPayloadSchema,
  persistedLoopStrategyPayloadSchema,
  persistedRecommendationAcknowledgementsPayloadSchema,
  persistedSimulationPayloadSchema,
} from './strategy.schema';

export * from './envelope.schema';
export * from './metadata.schema';
export * from './portfolio.schema';
export * from './recoverySnapshot.schema';
export * from './settings.schema';
export * from './shared.schema';
export * from './strategy.schema';

export const PAYLOAD_SCHEMAS_BY_RECORD_TYPE: Record<PersistedRecordType, ZodTypeAny> = {
  portfolio: persistedPortfolioPayloadSchema,
  loopStrategy: persistedLoopStrategyPayloadSchema,
  exitPlan: persistedExitPlanPayloadSchema,
  simulation: persistedSimulationPayloadSchema,
  recommendationAcknowledgements: persistedRecommendationAcknowledgementsPayloadSchema,
  preferences: persistedPreferencesPayloadSchema,
  syncMetadata: persistedSyncMetadataPayloadSchema,
  applicationMetadata: persistedApplicationMetadataPayloadSchema,
  activePortfolio: persistedActivePortfolioPayloadSchema,
  recoverySnapshot: persistedRecoverySnapshotPayloadSchema,
};

/**
 * JSON Exporter — 06_TASKS.md M8-037 ("Implement Full JSON Export") and
 * M8-038 ("Implement Single-Record JSON Export"). Builds the two file
 * shapes `./types.ts` declares; `ExportService.ts` is the only caller,
 * and the only thing that turns a built file into an actual browser
 * download (M8-036's own DoD: "Feature components do not create export
 * files directly").
 *
 * **Never imports a Store-owned type** (`SavedLoopStrategy`,
 * `SavedExitPlan`, `SavedSimulation`, `AcknowledgementsByPortfolio`,
 * `PersistedPreferences`) — the same "Services stay generic over a
 * caller-supplied payload type, never import a Store's own shape"
 * discipline `services/persistence/types/models.ts`'s own header comment
 * already established, applied here to a second Service for the same
 * dependency-direction reason. `extractPortfolioId` reads a
 * `portfolioId` field structurally, off an otherwise-opaque
 * `StorageEnvelope<unknown>` payload, rather than importing the Store
 * type that happens to declare it.
 *
 * **M8-037's own "Requirements"** ("Exclude authentication tokens...
 * provider secrets... internal Supabase session data") are satisfied
 * structurally, not by an explicit filter: no such data exists anywhere
 * in this application yet (Milestone 8's Authentication/Cloud Sync
 * batches, both explicitly out of scope for this batch) — every record
 * type a full backup can include (`PERSISTED_RECORD_TYPES`) is already
 * one of the 9 that `services/persistence/types/envelope.ts` documents,
 * and `'syncMetadata'` (the one record type that could one day carry
 * something session-like) is still an always-empty stub (`syncMetadata.ts`
 * has no writer yet — see that file's own header comment).
 *
 * **`service: PersistenceService` is a parameter, not a fixed import of
 * the shared `persistenceService` singleton** — the same
 * dependency-injection convention `createPersistenceService` itself
 * established, so tests can build export files against an isolated
 * in-memory adapter instead of real `localStorage`.
 */
import type { MappingResult } from '@/services/shared';
import { createApplicationError } from '@/services/shared';

import {
  APP_NAME,
  APP_VERSION,
  PERSISTED_RECORD_TYPES,
  type PersistedRecordType,
  type PersistenceService,
  persistenceService,
  STORAGE_SCHEMA_VERSION,
} from '../persistence';
import type { ExportFileMeta, FullBackupFile, SingleRecordExportFile } from './types';

function buildMeta(now: () => string): ExportFileMeta {
  return {
    app: APP_NAME,
    storageSchemaVersion: STORAGE_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    exportedAt: now(),
  };
}

function extractPortfolioId(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const candidate = (payload as Record<string, unknown>).portfolioId;
  return typeof candidate === 'string' && candidate.length > 0 ? candidate : null;
}

export interface JsonExporterOptions {
  now?: () => string;
  service?: PersistenceService;
}

export async function buildFullBackupFile(
  options: JsonExporterOptions = {},
): Promise<MappingResult<FullBackupFile>> {
  const now = options.now ?? (() => new Date().toISOString());
  const service = options.service ?? persistenceService;
  const records: FullBackupFile['records'] = {};

  for (const recordType of PERSISTED_RECORD_TYPES) {
    const result = await service.listEnvelopes<unknown>(recordType);
    if (!result.ok) return result;
    if (result.data.length > 0) records[recordType] = result.data;
  }

  return {
    ok: true,
    data: { ...buildMeta(now), kind: 'full-backup', records },
  };
}

export async function buildSingleRecordExportFile(
  recordType: PersistedRecordType,
  recordId: string,
  options: JsonExporterOptions = {},
): Promise<MappingResult<SingleRecordExportFile>> {
  const now = options.now ?? (() => new Date().toISOString());
  const service = options.service ?? persistenceService;

  const envelopesResult = await service.listEnvelopes<unknown>(recordType);
  if (!envelopesResult.ok) return envelopesResult;
  const envelope = envelopesResult.data.find((candidate) => candidate.recordId === recordId);
  if (envelope === undefined) {
    return {
      ok: false,
      errors: [
        createApplicationError(
          'export',
          'EXPORT_RECORD_NOT_FOUND',
          `No "${recordType}" record exists with id "${recordId}" to export.`,
        ),
      ],
    };
  }

  const dependencies: SingleRecordExportFile['dependencies'] = {};
  const portfolioId = extractPortfolioId(envelope.payload);
  if (portfolioId !== null && recordType !== 'portfolio') {
    const portfolioResult = await service.listEnvelopes<unknown>('portfolio');
    if (portfolioResult.ok) {
      const portfolioEnvelope = portfolioResult.data.find(
        (candidate) => candidate.recordId === portfolioId,
      );
      if (portfolioEnvelope !== undefined) {
        dependencies.portfolio = [portfolioEnvelope];
      }
    }
  }

  return {
    ok: true,
    data: { ...buildMeta(now), kind: 'single-record', recordType, record: envelope, dependencies },
  };
}

export function serializeExportFile(file: FullBackupFile | SingleRecordExportFile): string {
  return JSON.stringify(file, null, 2);
}

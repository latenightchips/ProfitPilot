/**
 * Import Service — 06_TASKS.md M8-040 ("Create Import Service"). Support
 * import of: "Full backup restoration, Single portfolio import, Single
 * strategy import." The one entry point `app/settings/page.tsx` calls —
 * mirrors `ExportService.ts`'s own role on the export side, and the same
 * `service: PersistenceService` dependency-injection convention
 * `JsonExporter.ts` already established.
 */
import type { MappingResult } from '@/services/shared';

import {
  PERSISTED_RECORD_TYPES,
  type PersistenceService,
  persistenceService,
} from '../persistence';
import { applyImport, type ApplyImportOptions } from './apply';
import type { ImportFileValidationResult } from './ImportValidator';
import { validateImportFile } from './ImportValidator';
import { buildImportPreview } from './preview';
import type { ImportApplyResult, ImportPreview, MergeMode } from './types';

export interface PreviewImportOptions {
  service?: PersistenceService;
  selectedRecordIds?: ReadonlySet<string>;
}

export interface ImportPreviewBundle {
  validation: ImportFileValidationResult;
  preview: ImportPreview;
}

export async function previewImport(
  rawText: string,
  mergeMode: MergeMode,
  options: PreviewImportOptions = {},
): Promise<MappingResult<ImportPreviewBundle>> {
  const validation = validateImportFile(rawText);
  if (!validation.ok) return validation;

  const service = options.service ?? persistenceService;
  const existingIdsByType: Partial<
    Record<(typeof PERSISTED_RECORD_TYPES)[number], ReadonlySet<string>>
  > = {};
  for (const recordType of PERSISTED_RECORD_TYPES) {
    const listed = await service.listEnvelopes<unknown>(recordType);
    if (!listed.ok) return listed;
    existingIdsByType[recordType] = new Set(listed.data.map((e) => e.recordId));
  }

  const preview = buildImportPreview(
    validation.data.file.storageSchemaVersion,
    validation.data.file.exportedAt,
    validation.data.validRecordsByType,
    existingIdsByType,
    validation.data.issues,
    mergeMode,
    options.selectedRecordIds,
  );

  return { ok: true, data: { validation: validation.data, preview } };
}

export async function applyValidatedImport(
  validation: ImportFileValidationResult,
  mergeMode: MergeMode,
  options: ApplyImportOptions = {},
): Promise<MappingResult<ImportApplyResult>> {
  return applyImport(validation.validRecordsByType, mergeMode, validation.issues, options);
}

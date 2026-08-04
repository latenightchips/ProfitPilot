/**
 * Import Validator — 06_TASKS.md M8-041 ("Implement Import Validation").
 * Requirements: "Validate file format, Validate schema version, Validate
 * record structure, Validate against tampering where feasible." DoD:
 * "Unsupported or corrupted import files are rejected safely."
 *
 * **Two failure tiers, matching the DoD's own "rejected safely" (not
 * "rejected all-or-nothing").** A malformed *file* (unparsable JSON, an
 * unrecognized outer shape, a `kind` this app doesn't produce, or an
 * `app` identifier that isn't `"ProfitPilot"`) fails the whole import —
 * there is nothing safe to salvage from a file that isn't even
 * recognizable as one of this app's own exports. A malformed or
 * unsupported *record* inside an otherwise-valid file (a future schema
 * version this app build can't migrate, a payload that fails its own
 * record type's schema, a duplicate id within the file) is instead
 * collected as an `ImportValidationIssue` and that one record is simply
 * excluded from `validRecordsByType` — the rest of a large, mostly-valid
 * backup file still imports.
 *
 * Reuses `validatePersistedRecord` (`services/persistence/validate.ts`,
 * M8-005) for the same per-record migration + payload-schema check every
 * `localStorage` read already goes through — an imported record is not
 * held to a lesser standard than a locally stored one.
 */
import type { MappingResult } from '@/services/shared';
import { createApplicationError } from '@/services/shared';

import type { ExportFile } from '../export';
import {
  APP_NAME,
  type PersistedRecordType,
  type StorageEnvelope,
  validatePersistedRecord,
} from '../persistence';
import { importFileSchema } from './schemas';

export type ImportValidationIssueCode =
  'UNSUPPORTED_SCHEMA_VERSION' | 'INVALID_RECORD' | 'DUPLICATE_RECORD_ID';

export interface ImportValidationIssue {
  recordType: PersistedRecordType;
  recordId: string;
  code: ImportValidationIssueCode;
  message: string;
}

export interface ImportFileValidationResult {
  file: ExportFile;
  validRecordsByType: Partial<Record<PersistedRecordType, StorageEnvelope<unknown>[]>>;
  issues: ImportValidationIssue[];
}

function fileLevelFailure(message: string): MappingResult<never> {
  return {
    ok: false,
    errors: [createApplicationError('import', 'INVALID_IMPORT_FILE', message)],
  };
}

function parseJson(rawText: string): MappingResult<unknown> {
  try {
    return { ok: true, data: JSON.parse(rawText) };
  } catch {
    return fileLevelFailure('This file is not valid JSON and cannot be imported.');
  }
}

function validateRecordArray(
  recordType: PersistedRecordType,
  envelopes: { recordId: string }[] | undefined,
  seenIds: Set<string>,
  issues: ImportValidationIssue[],
): StorageEnvelope<unknown>[] {
  const valid: StorageEnvelope<unknown>[] = [];
  if (envelopes === undefined) return valid;

  for (const raw of envelopes) {
    if (seenIds.has(`${recordType}:${raw.recordId}`)) {
      issues.push({
        recordType,
        recordId: raw.recordId,
        code: 'DUPLICATE_RECORD_ID',
        message: `Duplicate "${recordType}" record id "${raw.recordId}" in this file; only the first occurrence was kept.`,
      });
      continue;
    }
    seenIds.add(`${recordType}:${raw.recordId}`);

    const validated = validatePersistedRecord<unknown>(recordType, raw);
    if (!validated.ok) {
      issues.push({
        recordType,
        recordId: raw.recordId,
        code: 'INVALID_RECORD',
        message: `A "${recordType}" record could not be imported: ${validated.errors[0]?.message ?? 'unknown validation error'}`,
      });
      continue;
    }

    valid.push(validated.data);
  }

  return valid;
}

export function validateImportFile(rawText: string): MappingResult<ImportFileValidationResult> {
  const parsed = parseJson(rawText);
  if (!parsed.ok) return parsed;

  const shapeResult = importFileSchema.safeParse(parsed.data);
  if (!shapeResult.success) {
    return fileLevelFailure(
      'This file does not match a recognized ProfitPilot export format and cannot be imported.',
    );
  }

  const file = shapeResult.data as ExportFile;
  if (file.app !== APP_NAME) {
    return fileLevelFailure(
      `This file was exported from "${file.app}", not ProfitPilot, and cannot be imported.`,
    );
  }

  const issues: ImportValidationIssue[] = [];
  const seenIds = new Set<string>();
  const validRecordsByType: Partial<Record<PersistedRecordType, StorageEnvelope<unknown>[]>> = {};

  const recordMaps: Partial<Record<PersistedRecordType, StorageEnvelope<unknown>[]>>[] =
    file.kind === 'full-backup'
      ? [file.records]
      : [{ [file.recordType]: [file.record] }, file.dependencies];

  for (const recordMap of recordMaps) {
    for (const [recordType, envelopes] of Object.entries(recordMap) as [
      PersistedRecordType,
      StorageEnvelope<unknown>[],
    ][]) {
      const valid = validateRecordArray(recordType, envelopes, seenIds, issues);
      if (valid.length === 0) continue;
      validRecordsByType[recordType] = [...(validRecordsByType[recordType] ?? []), ...valid];
    }
  }

  return { ok: true, data: { file, validRecordsByType, issues } };
}

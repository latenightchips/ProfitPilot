/**
 * Import Preview — 06_TASKS.md M8-042 ("Implement Import Preview"). DoD:
 * "Users understand what will change before confirming import." Pure
 * functions only — no persistence read/write here, so a preview can be
 * (re)computed cheaply as the user changes the merge mode or selection,
 * before anything is actually written (`apply.ts`'s own job).
 */
import type { PersistedRecordType, StorageEnvelope } from '../persistence';
import type { ImportValidationIssue } from './ImportValidator';
import type { ImportPreview, ImportRecordPlan, MergeMode, ProposedAction } from './types';

export function planRecordAction(
  recordType: PersistedRecordType,
  recordId: string,
  existingIds: ReadonlySet<string>,
  mergeMode: MergeMode,
  selectedRecordIds?: ReadonlySet<string>,
): ImportRecordPlan {
  const conflict = existingIds.has(recordId);
  let action: ProposedAction;

  switch (mergeMode) {
    case 'addAsNew':
      action = 'addAsNew';
      break;
    case 'mergeNonConflicting':
      action = conflict ? 'skip' : 'add';
      break;
    case 'replaceSelected':
      action = conflict && (selectedRecordIds?.has(recordId) ?? false) ? 'replace' : 'skip';
      break;
    case 'replaceAll':
      action = 'replace';
      break;
  }

  return { recordType, recordId, conflict, action };
}

export function buildImportPreview(
  fileVersion: string,
  exportedAt: string,
  validRecordsByType: Partial<Record<PersistedRecordType, StorageEnvelope<unknown>[]>>,
  existingIdsByType: Partial<Record<PersistedRecordType, ReadonlySet<string>>>,
  issues: ImportValidationIssue[],
  mergeMode: MergeMode,
  selectedRecordIds?: ReadonlySet<string>,
): ImportPreview {
  const counts: Partial<Record<PersistedRecordType, number>> = {};
  const plan: ImportRecordPlan[] = [];

  for (const [recordType, envelopes] of Object.entries(validRecordsByType) as [
    PersistedRecordType,
    StorageEnvelope<unknown>[],
  ][]) {
    counts[recordType] = envelopes.length;
    const existingIds = existingIdsByType[recordType] ?? new Set<string>();
    for (const envelope of envelopes) {
      plan.push(
        planRecordAction(recordType, envelope.recordId, existingIds, mergeMode, selectedRecordIds),
      );
    }
  }

  const conflicts = plan.filter((entry) => entry.conflict);

  const warnings = issues
    .filter((issue) => issue.code === 'DUPLICATE_RECORD_ID')
    .map((issue) => issue.message);
  const unsupportedRecords = issues
    .filter((issue) => issue.code !== 'DUPLICATE_RECORD_ID')
    .map((issue) => issue.message);

  return {
    fileVersion,
    exportedAt,
    counts,
    mergeMode,
    plan,
    conflicts,
    warnings,
    unsupportedRecords,
  };
}

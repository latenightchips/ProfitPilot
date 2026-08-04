/**
 * Import Service types — shared between `preview.ts` (M8-042, "Implement
 * Import Preview") and `apply.ts` (M8-043, "Implement Import Merge
 * Strategies" / M8-044, "Implement Import Replace Strategy").
 */
import type { PersistedRecordType } from '../persistence';

/**
 * M8-042/M8-043's own "modes" list, verbatim:
 * - `addAsNew` — always adds the record under a freshly generated id,
 *   never touching an existing record even if the id collides.
 * - `mergeNonConflicting` — adds records whose id has no local match;
 *   skips (does not touch) any record whose id already exists locally.
 * - `replaceSelected` — replaces only the ids the caller explicitly
 *   selected (`ApplyImportOptions.selectedRecordIds`); every other
 *   imported record is skipped.
 * - `replaceAll` — clears the entire local dataset and writes only the
 *   file's own contents. M8-044's own DoD ("Replacement requires
 *   explicit confirmation") is enforced in `apply.ts` itself via
 *   `confirmedReplaceAll`, not just gated in the UI.
 */
export type MergeMode = 'addAsNew' | 'mergeNonConflicting' | 'replaceSelected' | 'replaceAll';

export type ProposedAction = 'add' | 'addAsNew' | 'replace' | 'skip';

export interface ImportRecordPlan {
  recordType: PersistedRecordType;
  recordId: string;
  conflict: boolean;
  action: ProposedAction;
}

/**
 * M8-042's own DoD: "Users understand what will change before confirming
 * import." `counts`/`conflicts`/`plan` together describe exactly that;
 * `warnings`/`unsupportedRecords` surface `ImportValidator.ts`'s
 * per-record issues without failing the whole preview.
 */
export interface ImportPreview {
  fileVersion: string;
  exportedAt: string;
  counts: Partial<Record<PersistedRecordType, number>>;
  mergeMode: MergeMode;
  plan: ImportRecordPlan[];
  conflicts: ImportRecordPlan[];
  warnings: string[];
  unsupportedRecords: string[];
}

export interface ImportApplyResult {
  written: ImportRecordPlan[];
  skipped: ImportRecordPlan[];
  warnings: string[];
  unsupportedRecords: string[];
}

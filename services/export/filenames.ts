/**
 * Export File Naming — 06_TASKS.md M8-045 ("Implement Export File
 * Naming"). Dependencies: M8-037. Description: "Create readable export
 * filenames." Include: "ProfitPilot, Record type, Portfolio or strategy
 * name where appropriate, Date, Schema version." DoD: "Export files are
 * identifiable without opening them."
 *
 * The 4 existing feature exporters (each feature's own `utils/export*.ts`)
 * predate this task and use their own fixed names (e.g.
 * `loop-strategy-export.json`) — left untouched per this batch's own
 * "keep the 4 existing feature exporters intact" instruction. This
 * builder is for the new centralized Export Service only; callers pass
 * an already-kebab-case `kind` label (e.g. `'full-backup'`,
 * `'loop-strategy'`, `'loop-steps'`) rather than a `PersistedRecordType`,
 * since some export kinds (the collection-level CSVs, M8-039) have no
 * single corresponding record type.
 */

/** `YYYY-MM-DD`, not a full ISO timestamp — readable in a file listing, still unambiguous. */
function formatDateForFilename(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Strips characters that are unsafe or awkward in a downloaded filename across common OSes. */
function sanitizeNameSegment(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9-_ ]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 60);
}

export interface BuildExportFilenameOptions {
  kind: string;
  /** The portfolio or strategy name, when exporting a single named record. */
  name?: string;
  schemaVersion: string;
  extension: 'json' | 'csv';
  now?: () => Date;
}

export function buildExportFilename(options: BuildExportFilenameOptions): string {
  const now = (options.now ?? (() => new Date()))();

  const segments = ['ProfitPilot', options.kind];
  if (options.name !== undefined && options.name.trim().length > 0) {
    segments.push(sanitizeNameSegment(options.name));
  }
  segments.push(formatDateForFilename(now));
  segments.push(`v${options.schemaVersion}`);

  return `${segments.join('_')}.${options.extension}`;
}

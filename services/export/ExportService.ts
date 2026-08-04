/**
 * Export Service — 06_TASKS.md M8-036 ("Create Export Service"). Support
 * export of: "All application data, Single portfolio, Simulation, Loop
 * strategy, Exit plan, User preferences where appropriate." DoD:
 * "Feature components do not create export files directly."
 *
 * The single entry point `app/settings/page.tsx` (this batch's own
 * minimal UI) calls — no feature component builds a `Blob`, an export
 * filename, or a payload shape itself. `triggerDownload` is the one
 * function in this whole Service that touches the DOM (`document`,
 * `URL.createObjectURL`), mirroring the same Blob + temporary-anchor
 * pattern the 4 existing feature exporters already use — not a new
 * download mechanism invented for this batch.
 *
 * CSV exports read through `persistenceService.list()` (unwrapped
 * payloads — a CSV has no use for the envelope's own
 * `checksum`/`storageSchemaVersion`, unlike the JSON exports), so the
 * `unknown[]` handed to `CsvExporter.ts` is already validated,
 * already-current-version data — the same "Do not bypass
 * PersistenceService" guarantee `JsonExporter.ts` provides for JSON.
 */
import type { MappingResult } from '@/services/shared';
import type { Portfolio } from '@/types/portfolio';

import type { PersistedRecordType, PersistenceService } from '../persistence';
import { persistenceService, STORAGE_SCHEMA_VERSION } from '../persistence';
import {
  buildExitPlanBreakdownsCsv,
  buildLoopStepsCsv,
  buildPortfolioPositionsCsv,
  buildScenarioComparisonsCsv,
} from './CsvExporter';
import { buildExportFilename } from './filenames';
import {
  buildFullBackupFile,
  buildSingleRecordExportFile,
  serializeExportFile,
} from './JsonExporter';
import type { ExportResult } from './types';

export type CsvExportKind =
  'portfolio-positions' | 'scenario-comparisons' | 'loop-steps' | 'exit-plan-breakdowns';

export interface ExportServiceOptions {
  service?: PersistenceService;
  now?: () => Date;
}

function nowIso(now: (() => Date) | undefined): (() => string) | undefined {
  return now === undefined ? undefined : () => now().toISOString();
}

export async function exportFullBackup(
  options: ExportServiceOptions = {},
): Promise<MappingResult<ExportResult>> {
  const built = await buildFullBackupFile({ service: options.service, now: nowIso(options.now) });
  if (!built.ok) return built;

  return {
    ok: true,
    data: {
      filename: buildExportFilename({
        kind: 'full-backup',
        schemaVersion: built.data.storageSchemaVersion,
        extension: 'json',
        now: options.now,
      }),
      content: serializeExportFile(built.data),
      mimeType: 'application/json',
    },
  };
}

export async function exportSingleRecord(
  recordType: PersistedRecordType,
  recordId: string,
  name: string | undefined,
  options: ExportServiceOptions = {},
): Promise<MappingResult<ExportResult>> {
  const built = await buildSingleRecordExportFile(recordType, recordId, {
    service: options.service,
    now: nowIso(options.now),
  });
  if (!built.ok) return built;

  return {
    ok: true,
    data: {
      filename: buildExportFilename({
        kind: recordType,
        name,
        schemaVersion: built.data.storageSchemaVersion,
        extension: 'json',
        now: options.now,
      }),
      content: serializeExportFile(built.data),
      mimeType: 'application/json',
    },
  };
}

async function buildCsvExportResult(
  kind: CsvExportKind,
  content: string,
  now: (() => Date) | undefined,
): Promise<ExportResult> {
  return {
    filename: buildExportFilename({
      kind,
      schemaVersion: STORAGE_SCHEMA_VERSION,
      extension: 'csv',
      now,
    }),
    content,
    mimeType: 'text/csv',
  };
}

export async function exportCsv(
  kind: CsvExportKind,
  options: ExportServiceOptions = {},
): Promise<MappingResult<ExportResult>> {
  const service = options.service ?? persistenceService;

  switch (kind) {
    case 'portfolio-positions': {
      const listed = await service.list<Portfolio>('portfolio');
      if (!listed.ok) return listed;
      return {
        ok: true,
        data: await buildCsvExportResult(
          kind,
          buildPortfolioPositionsCsv(listed.data),
          options.now,
        ),
      };
    }
    case 'scenario-comparisons': {
      const listed = await service.list<unknown>('simulation');
      if (!listed.ok) return listed;
      return {
        ok: true,
        data: await buildCsvExportResult(
          kind,
          buildScenarioComparisonsCsv(listed.data),
          options.now,
        ),
      };
    }
    case 'loop-steps': {
      const listed = await service.list<unknown>('loopStrategy');
      if (!listed.ok) return listed;
      return {
        ok: true,
        data: await buildCsvExportResult(kind, buildLoopStepsCsv(listed.data), options.now),
      };
    }
    case 'exit-plan-breakdowns': {
      const listed = await service.list<unknown>('exitPlan');
      if (!listed.ok) return listed;
      return {
        ok: true,
        data: await buildCsvExportResult(
          kind,
          buildExitPlanBreakdownsCsv(listed.data),
          options.now,
        ),
      };
    }
  }
}

/** The one function in this Service that touches the DOM. Browser-only. */
export function triggerDownload(result: ExportResult): void {
  const blob = new Blob([result.content], { type: result.mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = result.filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

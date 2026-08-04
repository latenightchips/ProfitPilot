'use client';

import { useState } from 'react';

import type { CsvExportKind } from '@/services/export';
import { exportCsv, exportFullBackup, triggerDownload } from '@/services/export';
import type { ImportFileValidationResult, ImportPreviewBundle } from '@/services/import';
import type { ImportApplyResult, MergeMode } from '@/services/import';
import { applyValidatedImport, previewImport } from '@/services/import';
import { useExitPlannerStore } from '@/stores/exitPlannerStore';
import { useLoopBuilderStore } from '@/stores/loopBuilderStore';
import { usePortfolioStore } from '@/stores/portfolioStore';
import { useRecommendationCenterStore } from '@/stores/recommendationCenterStore';
import { useSimulationStore } from '@/stores/simulationStore';

/**
 * Settings — 06_TASKS.md M8-042/M8-043/M8-044 ("Import & Export"). The
 * one UI entry point every centralized Export/Import Service function
 * this batch adds is actually called from — no feature component builds
 * an export file or applies an import directly (M8-036's own DoD).
 *
 * **A deliberate, documented resolution of a real conflict between two
 * source documents.** 03_UI.md's own "SETTINGS" page section lists
 * "Backup" only under "Future Versions," not "Version 1" — read alone,
 * that would mean no UI at all for this batch. But 06_TASKS.md's own
 * M8-042/M8-043/M8-044 assign this exact batch real, user-facing
 * Definitions of Done that only a real UI can satisfy: "Users understand
 * what will change before confirming import" (M8-042) and "Replacement
 * requires explicit confirmation" (M8-044) are both statements about
 * what a *user* sees and does, not about the Service layer alone. This
 * page is the minimal, functional resolution: it implements exactly the
 * workflows those DoDs require (export buttons, an import preview,
 * merge-mode selection, a required confirmation step before a
 * destructive replace) and nothing beyond that — not the fuller,
 * polished "Backup" page 03_UI.md's own "Future Versions" section
 * envisions (scheduled backups, cloud sync status, etc.), which stays
 * out of scope for this batch. This is the same "genuine documented
 * conflict, resolved narrowly in favor of whichever document has a real,
 * testable DoD for *this* batch" precedent already established earlier
 * in this engagement.
 */

const CSV_EXPORTS: { kind: CsvExportKind; label: string }[] = [
  { kind: 'portfolio-positions', label: 'Portfolio Positions (CSV)' },
  { kind: 'scenario-comparisons', label: 'Scenario Comparisons (CSV)' },
  { kind: 'loop-steps', label: 'Loop Steps (CSV)' },
  { kind: 'exit-plan-breakdowns', label: 'Exit Plan Breakdowns (CSV)' },
];

const MERGE_MODE_OPTIONS: { mode: MergeMode; label: string; description: string }[] = [
  {
    mode: 'addAsNew',
    label: 'Add as new',
    description: 'Every imported record is added under a new id, even if it conflicts.',
  },
  {
    mode: 'mergeNonConflicting',
    label: 'Merge non-conflicting',
    description: 'Records with no local match are added; conflicting records are skipped.',
  },
  {
    mode: 'replaceSelected',
    label: 'Replace selected',
    description: 'Only the conflicting records you select below are replaced.',
  },
  {
    mode: 'replaceAll',
    label: 'Replace all local data',
    description:
      'Clears everything currently stored and replaces it with only this file’s contents.',
  },
];

export default function SettingsPage() {
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  const [rawFileText, setRawFileText] = useState<string | null>(null);
  const [mergeMode, setMergeMode] = useState<MergeMode>('mergeNonConflicting');
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(new Set());
  const [confirmReplaceAll, setConfirmReplaceAll] = useState(false);
  const [previewBundle, setPreviewBundle] = useState<ImportPreviewBundle | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [applyResult, setApplyResult] = useState<ImportApplyResult | null>(null);

  const loadPortfolios = usePortfolioStore((state) => state.load);
  const loadSavedStrategies = useLoopBuilderStore((state) => state.loadSavedStrategies);
  const loadSavedPlans = useExitPlannerStore((state) => state.loadSavedPlans);
  const loadSavedScenarios = useSimulationStore((state) => state.loadSavedScenarios);
  const loadAcknowledgements = useRecommendationCenterStore((state) => state.loadAcknowledgements);

  async function reloadAllStores(): Promise<void> {
    await Promise.all([
      loadPortfolios(),
      loadSavedStrategies(),
      loadSavedPlans(),
      loadSavedScenarios(),
      loadAcknowledgements(),
    ]);
  }

  async function handleFullBackup(): Promise<void> {
    setExportError(null);
    const result = await exportFullBackup();
    if (!result.ok) {
      setExportError(result.errors[0]?.message ?? 'Export failed.');
      return;
    }
    triggerDownload(result.data);
    setExportStatus(`Exported ${result.data.filename}.`);
  }

  async function handleCsvExport(kind: CsvExportKind): Promise<void> {
    setExportError(null);
    const result = await exportCsv(kind);
    if (!result.ok) {
      setExportError(result.errors[0]?.message ?? 'Export failed.');
      return;
    }
    triggerDownload(result.data);
    setExportStatus(`Exported ${result.data.filename}.`);
  }

  async function runPreview(text: string, mode: MergeMode): Promise<void> {
    setImportError(null);
    setApplyResult(null);
    const result = await previewImport(text, mode);
    if (!result.ok) {
      setPreviewBundle(null);
      setImportError(result.errors[0]?.message ?? 'This file could not be read.');
      return;
    }
    setPreviewBundle(result.data);
    setConfirmReplaceAll(false);
    setSelectedRecordIds(new Set());
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (file === undefined) return;
    const text = await file.text();
    setRawFileText(text);
    await runPreview(text, mergeMode);
  }

  async function handleMergeModeChange(mode: MergeMode): Promise<void> {
    setMergeMode(mode);
    if (rawFileText !== null) await runPreview(rawFileText, mode);
  }

  function toggleSelectedRecord(recordId: string): void {
    setSelectedRecordIds((prev) => {
      const next = new Set(prev);
      if (next.has(recordId)) next.delete(recordId);
      else next.add(recordId);
      return next;
    });
  }

  async function handleConfirmImport(): Promise<void> {
    if (previewBundle === null) return;
    setImportError(null);

    const validation: ImportFileValidationResult = previewBundle.validation;
    const result = await applyValidatedImport(validation, mergeMode, {
      selectedRecordIds,
      confirmedReplaceAll: mergeMode === 'replaceAll' ? confirmReplaceAll : undefined,
    });

    if (!result.ok) {
      setImportError(result.errors[0]?.message ?? 'Import failed.');
      return;
    }

    setApplyResult(result.data);
    setPreviewBundle(null);
    setRawFileText(null);
    await reloadAllStores();
  }

  const confirmDisabled =
    previewBundle === null || (mergeMode === 'replaceAll' && !confirmReplaceAll);

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <h1 className="text-xl font-semibold text-foreground">Settings</h1>

      <section className="space-y-3 rounded-lg border border-border p-4">
        <h2 className="text-sm font-semibold text-foreground">Export</h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleFullBackup()}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/40"
          >
            Full Backup (JSON)
          </button>
          {CSV_EXPORTS.map(({ kind, label }) => (
            <button
              key={kind}
              type="button"
              onClick={() => void handleCsvExport(kind)}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/40"
            >
              {label}
            </button>
          ))}
        </div>
        {exportStatus !== null && (
          <p className="text-xs text-muted-foreground" role="status">
            {exportStatus}
          </p>
        )}
        {exportError !== null && (
          <p className="text-xs text-destructive" role="alert">
            {exportError}
          </p>
        )}
      </section>

      <section className="space-y-3 rounded-lg border border-border p-4">
        <h2 className="text-sm font-semibold text-foreground">Import</h2>
        <input
          type="file"
          accept="application/json"
          aria-label="Import file"
          onChange={(event) => void handleFileChange(event)}
          className="text-xs text-foreground"
        />

        {importError !== null && (
          <p className="text-xs text-destructive" role="alert">
            {importError}
          </p>
        )}

        {previewBundle !== null && (
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">
              <p>File schema version: {previewBundle.preview.fileVersion}</p>
              <p>Exported at: {previewBundle.preview.exportedAt}</p>
              <p>Portfolios in file: {previewBundle.preview.counts.portfolio ?? 0}</p>
              <p>Loop strategies in file: {previewBundle.preview.counts.loopStrategy ?? 0}</p>
              <p>Exit plans in file: {previewBundle.preview.counts.exitPlan ?? 0}</p>
              <p>Simulations in file: {previewBundle.preview.counts.simulation ?? 0}</p>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold text-foreground">Merge mode</legend>
              {MERGE_MODE_OPTIONS.map(({ mode, label, description }) => (
                <label key={mode} className="flex items-start gap-2 text-xs text-foreground">
                  <input
                    type="radio"
                    name="merge-mode"
                    checked={mergeMode === mode}
                    onChange={() => void handleMergeModeChange(mode)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="font-medium">{label}</span>
                    <span className="block text-muted-foreground">{description}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            {previewBundle.preview.conflicts.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-foreground">
                  Conflicting records ({previewBundle.preview.conflicts.length})
                </p>
                {mergeMode === 'replaceSelected' && (
                  <ul className="space-y-1">
                    {previewBundle.preview.conflicts.map((conflict) => (
                      <li key={`${conflict.recordType}:${conflict.recordId}`}>
                        <label className="flex items-center gap-2 text-xs text-foreground">
                          <input
                            type="checkbox"
                            checked={selectedRecordIds.has(conflict.recordId)}
                            onChange={() => toggleSelectedRecord(conflict.recordId)}
                          />
                          {conflict.recordType}: {conflict.recordId}
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {previewBundle.preview.warnings.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-foreground">Warnings</p>
                <ul className="list-inside list-disc text-xs text-muted-foreground">
                  {previewBundle.preview.warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}

            {previewBundle.preview.unsupportedRecords.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-foreground">Unsupported records</p>
                <ul className="list-inside list-disc text-xs text-muted-foreground">
                  {previewBundle.preview.unsupportedRecords.map((message, index) => (
                    <li key={index}>{message}</li>
                  ))}
                </ul>
              </div>
            )}

            {mergeMode === 'replaceAll' && (
              <label className="flex items-center gap-2 text-xs font-medium text-destructive">
                <input
                  type="checkbox"
                  checked={confirmReplaceAll}
                  onChange={(event) => setConfirmReplaceAll(event.target.checked)}
                />
                I understand this will permanently replace all local data.
              </label>
            )}

            <button
              type="button"
              disabled={confirmDisabled}
              onClick={() => void handleConfirmImport()}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Confirm Import
            </button>
          </div>
        )}

        {applyResult !== null && (
          <p className="text-xs text-muted-foreground" role="status">
            Imported {applyResult.written.length} record(s); skipped {applyResult.skipped.length}.
          </p>
        )}
      </section>
    </div>
  );
}

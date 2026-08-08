'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import type { CsvExportKind } from '@/services/export';
import { exportCsv, exportFullBackup, triggerDownload } from '@/services/export';
import type { ImportFileValidationResult, ImportPreviewBundle } from '@/services/import';
import type { ImportApplyResult, MergeMode } from '@/services/import';
import { applyValidatedImport, previewImport } from '@/services/import';
import {
  clearLocalData,
  listRecoverySnapshots,
  type PersistedRecoverySnapshot,
  restoreRecoverySnapshot,
  type StorageEnvelope,
} from '@/services/persistence';
import { useAuthStore } from '@/stores/authStore';
import { useExitPlannerStore } from '@/stores/exitPlannerStore';
import { useLoopBuilderStore } from '@/stores/loopBuilderStore';
import { usePortfolioStore } from '@/stores/portfolioStore';
import { useRecommendationCenterStore } from '@/stores/recommendationCenterStore';
import { useSimulationStore } from '@/stores/simulationStore';

/**
 * Settings — 06_TASKS.md M8-042/M8-043/M8-044 ("Import & Export") and
 * M8-046/M8-047/M8-048 ("Backup and Recovery"). The one UI entry point
 * every centralized Export/Import/Recovery Service function these two
 * batches add is actually called from — no feature component builds an
 * export file, applies an import, or clears storage directly (M8-036's
 * own DoD).
 *
 * **A deliberate, documented resolution of a real conflict between two
 * source documents.** 03_UI.md's own "SETTINGS" page section lists
 * "Backup" only under "Future Versions," not "Version 1" — read alone,
 * that would mean no UI at all for either batch. But 06_TASKS.md's own
 * M8-042/M8-043/M8-044/M8-047/M8-048 assign these two batches real,
 * user-facing Definitions of Done that only a real UI can satisfy:
 * "Users understand what will change before confirming import" (M8-042),
 * "Replacement requires explicit confirmation" (M8-044), "Users can
 * manage their data without developer tools" (M8-047), "Users can safely
 * reset the local application" (M8-048) are all statements about what a
 * *user* sees and does, not about the Service layer alone. This page is
 * the minimal, functional resolution: it implements exactly the
 * workflows those DoDs require and nothing beyond that — not the fuller,
 * polished "Backup" page 03_UI.md's own "Future Versions" section
 * envisions (scheduled backups, cloud sync status, etc.), which stays
 * out of scope for these batches. This is the same "genuine documented
 * conflict, resolved narrowly in favor of whichever document has a real,
 * testable DoD for *this* batch" precedent already established earlier
 * in this engagement.
 *
 * **"View sync state" (M8-047) and "Explain what cloud data will
 * remain" (M8-048) are both satisfied with honest, static copy, not a
 * real sync status widget or cloud-deletion behavior.** No cloud sync
 * exists anywhere in this application yet — Cloud Database/Cloud Sync
 * stay out of scope through this batch per this engagement's own
 * standing instruction. Saying so plainly ("ProfitPilot does not yet
 * sync to the cloud") is the accurate statement of the current state,
 * not a placeholder pretending a real feature exists.
 *
 * **Account section (Milestone 8 Batch 5, M8-020/M8-021)**: sign-in
 * status plus two sign-out paths — a plain "Sign Out" that never touches
 * local data (the header's own quick action does the same, see
 * `AppHeader.tsx`'s own comment), and a separate, explicitly confirmed
 * "Sign Out and Clear Local Data" that reuses M8-048's `clearLocalData`.
 * This is the real "user choice" M8-020's "Retain or remove local cached
 * data according to user choice" asks for, without making the common
 * case destructive.
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

export function SettingsPageClient() {
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  const [rawFileText, setRawFileText] = useState<string | null>(null);
  const [mergeMode, setMergeMode] = useState<MergeMode>('mergeNonConflicting');
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(new Set());
  const [confirmReplaceAll, setConfirmReplaceAll] = useState(false);
  const [previewBundle, setPreviewBundle] = useState<ImportPreviewBundle | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [applyResult, setApplyResult] = useState<ImportApplyResult | null>(null);

  const [snapshots, setSnapshots] = useState<StorageEnvelope<PersistedRecoverySnapshot>[]>([]);
  const [snapshotsError, setSnapshotsError] = useState<string | null>(null);
  const [restoreTargetId, setRestoreTargetId] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [restoreStatus, setRestoreStatus] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const [confirmClear, setConfirmClear] = useState(false);
  const [clearStatus, setClearStatus] = useState<string | null>(null);
  const [clearError, setClearError] = useState<string | null>(null);

  const authUser = useAuthStore((state) => state.user);
  const authErrors = useAuthStore((state) => state.errors);
  const authSignOut = useAuthStore((state) => state.signOut);
  const [confirmSignOutClear, setConfirmSignOutClear] = useState(false);
  const [signOutStatus, setSignOutStatus] = useState<string | null>(null);

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

  async function reloadSnapshots(): Promise<void> {
    const result = await listRecoverySnapshots();
    if (!result.ok) {
      setSnapshotsError(result.errors[0]?.message ?? 'Recovery snapshots could not be loaded.');
      return;
    }
    setSnapshotsError(null);
    setSnapshots(result.data);
  }

  useEffect(() => {
    void reloadSnapshots();
    // Only on mount — `reloadSnapshots` closes over module-level imports only.
  }, []);

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
    await reloadSnapshots();
  }

  async function handleRestoreSnapshot(): Promise<void> {
    if (restoreTargetId === null) return;
    setRestoreError(null);

    const result = await restoreRecoverySnapshot(restoreTargetId);
    if (!result.ok) {
      setRestoreError(result.errors[0]?.message ?? 'Restore failed.');
      return;
    }

    setRestoreStatus('Recovery snapshot restored.');
    setRestoreTargetId(null);
    setConfirmRestore(false);
    await reloadAllStores();
    await reloadSnapshots();
  }

  async function handleClearLocalData(): Promise<void> {
    setClearError(null);

    const result = await clearLocalData();
    if (!result.ok) {
      setClearError(result.errors[0]?.message ?? 'Clearing local data failed.');
      return;
    }

    setClearStatus('Local data cleared. A recovery snapshot was saved beforehand.');
    setConfirmClear(false);
    await reloadAllStores();
    await reloadSnapshots();
  }

  async function handleSignOut(): Promise<void> {
    setSignOutStatus(null);
    const ok = await authSignOut();
    if (ok) setSignOutStatus('Signed out. Your local data was not changed.');
  }

  async function handleSignOutAndClear(): Promise<void> {
    setSignOutStatus(null);
    const signedOut = await authSignOut();
    if (!signedOut) return;

    const cleared = await clearLocalData();
    if (!cleared.ok) {
      setSignOutStatus(cleared.errors[0]?.message ?? 'Signed out, but clearing local data failed.');
      return;
    }

    setSignOutStatus(
      'Signed out and local data cleared. A recovery snapshot was saved beforehand.',
    );
    setConfirmSignOutClear(false);
    await reloadAllStores();
    await reloadSnapshots();
  }

  const confirmDisabled =
    previewBundle === null || (mergeMode === 'replaceAll' && !confirmReplaceAll);
  const restoreDisabled = restoreTargetId === null || !confirmRestore;

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

      <section className="space-y-3 rounded-lg border border-border p-4">
        <h2 className="text-sm font-semibold text-foreground">Account</h2>
        <p className="text-xs text-muted-foreground">
          Accounts are optional. ProfitPilot works fully without one — your data stays on this
          device either way. Signing in will let you sync your data across devices once cloud
          synchronization is available in a future update.
        </p>

        {authUser !== null ? (
          <>
            <p className="text-xs text-foreground">Signed in as {authUser.email}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/40"
              >
                Sign Out
              </button>
            </div>

            <label className="flex items-center gap-2 text-xs font-medium text-destructive">
              <input
                type="checkbox"
                checked={confirmSignOutClear}
                onChange={(event) => setConfirmSignOutClear(event.target.checked)}
              />
              Also permanently delete all local ProfitPilot data on this device.
            </label>
            <button
              type="button"
              disabled={!confirmSignOutClear}
              onClick={() => void handleSignOutAndClear()}
              className="rounded-md border border-destructive px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Sign Out and Clear Local Data
            </button>
          </>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Link
              href="/sign-in"
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/40"
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/40"
            >
              Create Account
            </Link>
          </div>
        )}

        {signOutStatus !== null && (
          <p className="text-xs text-muted-foreground" role="status">
            {signOutStatus}
          </p>
        )}
        {authErrors.length > 0 && (
          <p className="text-xs text-destructive" role="alert">
            {authErrors[0]?.message}
          </p>
        )}
      </section>

      <section className="space-y-3 rounded-lg border border-border p-4">
        <h2 className="text-sm font-semibold text-foreground">Storage &amp; Sync</h2>
        <div className="text-xs text-muted-foreground">
          <p>Storage mode: Local storage (browser)</p>
          <p>Sync state: Local only — ProfitPilot does not yet sync to the cloud.</p>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-border p-4">
        <h2 className="text-sm font-semibold text-foreground">Recovery Snapshots</h2>
        <p className="text-xs text-muted-foreground">
          ProfitPilot automatically saves a recovery snapshot before large imports, replacements,
          and other high-risk changes. Restoring a snapshot replaces your current local data with
          that snapshot&apos;s contents.
        </p>

        {snapshotsError !== null && (
          <p className="text-xs text-destructive" role="alert">
            {snapshotsError}
          </p>
        )}

        {snapshots.length === 0 ? (
          <p className="text-xs text-muted-foreground">No recovery snapshots yet.</p>
        ) : (
          <ul className="space-y-1">
            {snapshots.map((snapshot) => (
              <li key={snapshot.recordId}>
                <label className="flex items-center gap-2 text-xs text-foreground">
                  <input
                    type="radio"
                    name="restore-target"
                    checked={restoreTargetId === snapshot.recordId}
                    onChange={() => {
                      setRestoreTargetId(snapshot.recordId);
                      setConfirmRestore(false);
                      setRestoreStatus(null);
                    }}
                  />
                  {snapshot.payload.reason} — {snapshot.payload.createdAt}
                </label>
              </li>
            ))}
          </ul>
        )}

        {restoreTargetId !== null && (
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-medium text-destructive">
              <input
                type="checkbox"
                checked={confirmRestore}
                onChange={(event) => setConfirmRestore(event.target.checked)}
              />
              I understand this will replace all current local data with this snapshot.
            </label>
            <button
              type="button"
              disabled={restoreDisabled}
              onClick={() => void handleRestoreSnapshot()}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Restore Selected Snapshot
            </button>
          </div>
        )}

        {restoreStatus !== null && (
          <p className="text-xs text-muted-foreground" role="status">
            {restoreStatus}
          </p>
        )}
        {restoreError !== null && (
          <p className="text-xs text-destructive" role="alert">
            {restoreError}
          </p>
        )}
      </section>

      <section className="space-y-3 rounded-lg border border-border p-4">
        <h2 className="text-sm font-semibold text-foreground">Clear Local Data</h2>
        <p className="text-xs text-muted-foreground">
          This permanently deletes all portfolios, saved strategies, exit plans, simulations, and
          preferences stored in this browser. ProfitPilot does not yet sync to the cloud, so nothing
          else holds a copy of this data unless you export it first. A recovery snapshot is saved
          automatically before clearing, but exporting a full backup is the safer option if you want
          to keep this data long-term.
        </p>

        <button
          type="button"
          onClick={() => void handleFullBackup()}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/40"
        >
          Export Everything First
        </button>

        <label className="flex items-center gap-2 text-xs font-medium text-destructive">
          <input
            type="checkbox"
            checked={confirmClear}
            onChange={(event) => setConfirmClear(event.target.checked)}
          />
          I understand this will permanently delete all local ProfitPilot data.
        </label>

        <button
          type="button"
          disabled={!confirmClear}
          onClick={() => void handleClearLocalData()}
          className="rounded-md border border-destructive px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Clear Local Data
        </button>

        {clearStatus !== null && (
          <p className="text-xs text-muted-foreground" role="status">
            {clearStatus}
          </p>
        )}
        {clearError !== null && (
          <p className="text-xs text-destructive" role="alert">
            {clearError}
          </p>
        )}
      </section>
    </div>
  );
}

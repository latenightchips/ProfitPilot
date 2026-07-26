'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { type PortfolioRecord, usePortfolioStore } from '@/stores/portfolioStore';
import type { Portfolio } from '@/types/portfolio';

/**
 * Portfolio List Page — 06_TASKS.md M4-004 ("Implement Portfolio List
 * Page"). DoD: "Users can identify and open any saved portfolio."
 *
 * **Route, not a sidebar item**: 03_UI.md's own "APPLICATION STRUCTURE"
 * names exactly six primary pages (Dashboard, Portfolio, Simulation,
 * Loop Builder, Exit Planner, Settings) with no seventh "Portfolio List"
 * page — a genuine gap between that fixed inventory and Milestone 4's
 * multi-portfolio requirement (documented as conflict #23). Resolved
 * conservatively: this page lives at `/portfolios` (plural, distinct
 * from the existing single-portfolio `/portfolio` detail route) but is
 * **not** added to `constants/navigation.ts`/the sidebar, reached
 * instead from the portfolio switcher in `AppHeader` (M4-010) — the Top
 * Navigation location 03_UI.md already names for "Current Portfolio
 * Name."
 *
 * **"Create action"**: links to `/portfolios/new`, a minimal scaffold
 * placeholder (the same pattern Milestone 1 used for every not-yet-built
 * page) — the full guided flow is M4-005's own, later, dedicated task.
 * This batch only needs the entry point to exist and navigate correctly
 * ("Users can identify and open any saved portfolio" is this task's own
 * DoD; it says nothing about creation completing end-to-end).
 *
 * **"Select action"**: calls `select(id)` then navigates to `/portfolio`
 * — the existing single-portfolio detail route (still Milestone 1's
 * placeholder; filling in its real content is a different, unassigned
 * task, out of this batch's scope).
 *
 * **M4-016 empty states, folded into this same page** (M4-016 depends
 * only on M4-004): "No portfolios" is this page's own real empty state.
 * "No collateral"/"No debt" are genuine, reachable per-row conditions
 * under Conflict A's single-position model (`quantity`/`balance` can be
 * exactly zero — M4-008 explicitly requires supporting zero-debt
 * portfolios) and are shown as inline badges. "Missing prices"/"Missing
 * protocol parameters" are **not reachable** under the current data
 * model: `market`/`protocol` are required, Zod-validated fields
 * (M4-002) with no code path that produces a portfolio missing either —
 * documented as part of conflict #23 rather than built as dead UI for
 * an unreachable state. The one genuinely reachable per-row problem
 * state is a failed cached summary (`record.summary.ok === false`),
 * shown generically rather than guessing which specific field caused it.
 *
 * **"Storage status"**: the store tracks one *global* `saveStatus`
 * (Batch 1), not a per-portfolio value — there is no real per-record
 * persistence to differentiate yet (Conflict B). Every row shows the
 * same global value, honestly labeled.
 *
 * **M4-011 ("Implement Portfolio Duplication") — added this batch**:
 * every row gets a "Duplicate" action calling the Store's `duplicate`
 * (already implemented, M4-003 — see `stores/portfolioStore.ts`'s own
 * header comment for why it pre-existed this batch). No confirmation is
 * shown: duplication is non-destructive and immediately reversible via
 * Delete, matching 03_UI.md's "Every action is reversible whenever
 * possible" principle. `MappingResult<Portfolio>` failures (structurally
 * possible but unreachable in practice — see the Store's own comment)
 * fall through to the page's existing `errors` panel rather than a
 * second error-rendering path.
 *
 * **M4-012 ("Implement Portfolio Archive and Delete") — added this
 * batch**:
 * - **Archive/Unarchive**: the main list now shows only non-archived
 *   portfolios ("Hide from active lists"); a "Show archived" disclosure
 *   reveals archived ones with an "Unarchive" action in place of
 *   "Archive". Archive itself needs no confirmation (same reversibility
 *   reasoning as Duplicate — M4-012 only requires confirmation for
 *   Delete, and Archive is documented as retaining/recoverable data, not
 *   destructive). Archived rows render their name/summary as plain text,
 *   not a clickable "select" control — selecting (making active) an
 *   archived portfolio would itself contradict "hide from active lists,"
 *   so an archived portfolio must be unarchived before it can become the
 *   active portfolio again. This is a conservative resolution of a real
 *   specification gap (documented as conflict #27 in PROJECT_STATUS.md):
 *   M4-012's text never says whether an archived portfolio remains
 *   independently selectable.
 * - **Delete**: clicking "Delete" opens an inline, per-row confirmation
 *   panel (no new global Dialog/Modal component — none is defined
 *   anywhere in 03_UI.md's design system, and 03_UI.md's only "no modal"
 *   rule is scoped to the Dashboard's page-load behavior, not a
 *   blanket ban — an inline expand-to-confirm panel satisfies "Require
 *   confirmation. Explain consequences." without inventing a component
 *   this codebase has no other use for yet) stating the action is
 *   permanent. If the portfolio being deleted is the active one, the
 *   panel additionally requires selecting a replacement from the other
 *   *active* (non-archived) portfolios before "Confirm Delete" is
 *   enabled — the literal text of "Prevent accidental deletion of the
 *   active portfolio without selecting a replacement." When no other
 *   active portfolio exists, no replacement can be offered; the panel
 *   says so and allows the delete to proceed directly (the Store's
 *   `delete` already nulls `activePortfolioId` in that case, and
 *   `app/portfolio/page.tsx` already renders a graceful "No portfolio is
 *   currently selected" state for it).
 */
function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function formatHealthFactor(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}

interface PortfolioRowProps {
  record: PortfolioRecord;
  saveStatus: string;
  archived: boolean;
  isActive: boolean;
  replacementOptions: Portfolio[];
  isConfirmingDelete: boolean;
  replacementId: string;
  onSelect: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
  onReplacementChange: (id: string) => void;
}

function PortfolioRow({
  record,
  saveStatus,
  archived,
  isActive,
  replacementOptions,
  isConfirmingDelete,
  replacementId,
  onSelect,
  onDuplicate,
  onArchive,
  onUnarchive,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
  onReplacementChange,
}: PortfolioRowProps) {
  const { portfolio, summary } = record;
  const needsReplacement = isActive && replacementOptions.length > 0;
  const confirmDisabled = needsReplacement && replacementId === '';

  const rowContent = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">
          {portfolio.name}
          {archived && (
            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
              Archived
            </span>
          )}
        </span>
        <span className="text-xs text-muted-foreground">
          Updated {formatDate(portfolio.updatedAt)}
        </span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
        {summary.ok ? (
          <>
            <span>Net Equity: {formatCurrency(summary.data.netEquity)}</span>
            <span>Health Factor: {formatHealthFactor(summary.data.healthFactor)}</span>
            <span>Debt: {formatCurrency(summary.data.debtValue)}</span>
          </>
        ) : (
          <span className="text-destructive">
            Unable to calculate this portfolio&rsquo;s summary.
          </span>
        )}
        <span>Storage: {saveStatus}</span>
      </div>
      {(portfolio.collateral.quantity === 0 || portfolio.debt.balance === 0) && (
        <div className="flex gap-2 text-xs text-muted-foreground">
          {portfolio.collateral.quantity === 0 && (
            <span className="rounded-full bg-muted px-2 py-0.5">No collateral</span>
          )}
          {portfolio.debt.balance === 0 && (
            <span className="rounded-full bg-muted px-2 py-0.5">No debt</span>
          )}
        </div>
      )}
    </>
  );

  return (
    <li className="rounded-md border border-border p-4">
      {archived ? (
        <div className="flex w-full flex-col gap-1 text-left">{rowContent}</div>
      ) : (
        <button
          type="button"
          onClick={onSelect}
          className="flex w-full flex-col gap-1 rounded-md text-left transition-colors hover:bg-accent/40"
        >
          {rowContent}
        </button>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onDuplicate}
          className="rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-accent/40"
        >
          Duplicate
        </button>
        {archived ? (
          <button
            type="button"
            onClick={onUnarchive}
            className="rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-accent/40"
          >
            Unarchive
          </button>
        ) : (
          <button
            type="button"
            onClick={onArchive}
            className="rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-accent/40"
          >
            Archive
          </button>
        )}
        <button
          type="button"
          onClick={onRequestDelete}
          className="rounded-md border border-destructive/40 px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10"
        >
          Delete
        </button>
      </div>

      {isConfirmingDelete && (
        <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <p className="font-medium text-foreground">Delete &ldquo;{portfolio.name}&rdquo;?</p>
          <p className="mt-1 text-muted-foreground">
            This permanently removes the portfolio and all its data. This cannot be undone.
          </p>
          {isActive &&
            (replacementOptions.length > 0 ? (
              <label className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
                This is your active portfolio. Select a replacement to continue:
                <select
                  aria-label="Replacement portfolio"
                  value={replacementId}
                  onChange={(event) => onReplacementChange(event.target.value)}
                  className="rounded-md border border-border bg-transparent px-2 py-1 text-sm text-foreground"
                >
                  <option value="" disabled>
                    Select a portfolio
                  </option>
                  {replacementOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                This is your active portfolio and no other active portfolio is available to replace
                it. Deleting it will leave no portfolio selected.
              </p>
            ))}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={onConfirmDelete}
              disabled={confirmDisabled}
              className="rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Confirm Delete
            </button>
            <button
              type="button"
              onClick={onCancelDelete}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/40"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

export default function PortfoliosPage() {
  const portfolios = usePortfolioStore((state) => state.portfolios);
  const activePortfolioId = usePortfolioStore((state) => state.activePortfolioId);
  const loadStatus = usePortfolioStore((state) => state.loadStatus);
  const saveStatus = usePortfolioStore((state) => state.saveStatus);
  const errors = usePortfolioStore((state) => state.errors);
  const load = usePortfolioStore((state) => state.load);
  const select = usePortfolioStore((state) => state.select);
  const duplicate = usePortfolioStore((state) => state.duplicate);
  const archive = usePortfolioStore((state) => state.archive);
  const unarchive = usePortfolioStore((state) => state.unarchive);
  const deletePortfolio = usePortfolioStore((state) => state.delete);
  const router = useRouter();

  const [showArchived, setShowArchived] = useState(false);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [replacementId, setReplacementId] = useState('');

  useEffect(() => {
    load();
    // Only on mount — `load` is a stable store action reference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const entries = Object.values(portfolios).sort(
    (a, b) => new Date(b.portfolio.updatedAt).getTime() - new Date(a.portfolio.updatedAt).getTime(),
  );
  const activeEntries = entries.filter((entry) => entry.portfolio.archivedAt === null);
  const archivedEntries = entries.filter((entry) => entry.portfolio.archivedAt !== null);

  function requestDelete(id: string) {
    setConfirmingDeleteId(id);
    setReplacementId('');
  }

  function cancelDelete() {
    setConfirmingDeleteId(null);
    setReplacementId('');
  }

  function confirmDelete(id: string) {
    if (id === activePortfolioId && replacementId !== '') {
      select(replacementId);
    }
    deletePortfolio(id);
    setConfirmingDeleteId(null);
    setReplacementId('');
  }

  function renderRow(record: PortfolioRecord, archived: boolean) {
    const { portfolio } = record;
    return (
      <PortfolioRow
        key={portfolio.id}
        record={record}
        saveStatus={saveStatus}
        archived={archived}
        isActive={portfolio.id === activePortfolioId}
        replacementOptions={activeEntries
          .filter((entry) => entry.portfolio.id !== portfolio.id)
          .map((entry) => entry.portfolio)}
        isConfirmingDelete={confirmingDeleteId === portfolio.id}
        replacementId={replacementId}
        onSelect={() => {
          select(portfolio.id);
          router.push('/portfolio');
        }}
        onDuplicate={() => duplicate(portfolio.id)}
        onArchive={() => archive(portfolio.id)}
        onUnarchive={() => unarchive(portfolio.id)}
        onRequestDelete={() => requestDelete(portfolio.id)}
        onCancelDelete={cancelDelete}
        onConfirmDelete={() => confirmDelete(portfolio.id)}
        onReplacementChange={setReplacementId}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Portfolios</h1>
          <p className="text-sm text-muted-foreground">Select a saved portfolio, or create one.</p>
        </div>
        <Link
          href="/portfolios/new"
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Create Portfolio
        </Link>
      </div>

      {loadStatus === 'loading' && (
        <p className="text-sm text-muted-foreground" role="status">
          Loading portfolios…
        </p>
      )}

      {errors.length > 0 && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {errors.map((error) => (
            <p key={error.code}>{error.message}</p>
          ))}
        </div>
      )}

      {entries.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border p-8 text-center">
          <p className="text-sm font-medium text-foreground">No portfolios yet</p>
          <p className="text-sm text-muted-foreground">
            Create your first portfolio to start tracking your leveraged Bitcoin position.
          </p>
          <Link
            href="/portfolios/new"
            className="mt-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Create Portfolio
          </Link>
        </div>
      ) : (
        <>
          {activeEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              All portfolios are archived. Expand &ldquo;Show archived&rdquo; below to view or
              restore one.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {activeEntries.map((record) => renderRow(record, false))}
            </ul>
          )}

          {archivedEntries.length > 0 && (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setShowArchived((previous) => !previous)}
                className="self-start text-xs font-medium text-muted-foreground underline"
              >
                {showArchived ? 'Hide' : 'Show'} archived ({archivedEntries.length})
              </button>
              {showArchived && (
                <ul className="flex flex-col gap-2">
                  {archivedEntries.map((record) => renderRow(record, true))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

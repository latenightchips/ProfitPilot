'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { calculatePortfolioSummary, type PortfolioSummary, type ServiceResult } from '@/services';
import { usePortfolioStore } from '@/stores/portfolioStore';
import type { Portfolio } from '@/types/portfolio';
import {
  type CollateralManagementInput,
  collateralManagementSchema,
  type DebtManagementInput,
  debtManagementSchema,
  type PortfolioDetailsInput,
  portfolioDetailsSchema,
} from '@/types/portfolio.schema';

/**
 * Portfolio Details Form — 06_TASKS.md M4-006 ("Implement Portfolio
 * Details Form"): "Create a form for editing general portfolio
 * information." Fields: "Name, Description, Base currency, Default
 * display settings, Safety target settings." Requirements: "Use React
 * Hook Form. Use Zod validation. Support automatic saving." DoD:
 * "Changes persist and do not alter position balances unexpectedly."
 *
 * Replaces the `/portfolio` route's Milestone 1 `PlaceholderPage` —
 * this task's own Dependencies chain (M4-005 → M4-003 → M3-005) names
 * no other UI task that would build this route first, and 03_UI.md's
 * own "PORTFOLIO PAGE" section already names this exact route for
 * exactly this purpose ("What do I own?"). The read-only calculated
 * metrics that same 03_UI.md section also describes (Position Metrics,
 * Milestones, Interest, Performance) are **not** built here — no task in
 * this batch covers them; only the editable identity/settings/position
 * fields M4-006/M4-007/M4-008 themselves name.
 *
 * **"Default display settings" is not rendered** — conflict #22
 * (`types/portfolio.ts`): no field list for it exists anywhere in the
 * documentation, so `PortfolioSettings` never modeled it. Only "Safety
 * target settings" (`settings.safetyTargets`) is editable here.
 *
 * **"Support automatic saving" — auto-save to the in-memory Store, not
 * to disk.** Conflict B (Milestone 4 plan): no persistence
 * infrastructure exists before Milestone 8. "Saving" here means
 * debounced calls to `store.update()`, which commits to the Store's
 * in-memory state — the same "saved = in the Store" framing already
 * established for M4-003/M4-005. No manual save button, matching
 * 04_BUILD_GUIDE.md's own "No manual save button is required" principle
 * for auto-save UX.
 *
 * **DoD "do not alter position balances unexpectedly" — enforced
 * structurally, not just by care**: `portfolioDetailsSchema`
 * (`types/portfolio.schema.ts`) is `portfolioInputSchema.pick({name,
 * description, baseCurrency, settings})` — the update payload this form
 * can ever produce is *type-incapable* of containing
 * `collateral`/`debt`/`market`/`protocol`, so there is no code path
 * here that could touch position balances even by mistake.
 *
 * **Remounted (`key={activePortfolioId}`) on portfolio switch**: forces
 * React Hook Form's internal state to fully reset to the newly active
 * portfolio's own values rather than carrying over stale field state —
 * the concrete mechanism behind M4-010's own DoD ("Switching portfolios
 * never mixes state between portfolios") as it applies to this form.
 *
 * ---
 *
 * **Collateral/Debt Position Management — 06_TASKS.md M4-007/M4-008.**
 * Both allow "add, edit, and remove" a position; under Conflict A
 * (approved, single-position model) that means the one collateral slot
 * and the one debt slot's lifecycle (set from zero, change, clear back
 * to zero) — not an array. "Prevent duplicate invalid positions" is
 * structurally satisfied by the same single-slot model (nothing to
 * de-duplicate).
 *
 * **Preview mechanism — deliberately not `previewPortfolioAction`
 * (M3-006)**: that Service's `PortfolioAction` union changes exactly one
 * field per call (`addCollateral`, `changeProtocolParameters`, etc.).
 * These forms let a user edit a position field *and* its related
 * protocol field(s) together in one preview (e.g., quantity and
 * Liquidation threshold at once) — no single `PortfolioAction` variant
 * represents that combination. Rather than force an artificial
 * one-field-at-a-time flow the task text doesn't ask for, both forms
 * compose the same "snapshot, apply change, snapshot again" pattern
 * `previewPortfolioAction` itself uses, directly via
 * `calculatePortfolioSummary` (M3-005) — still Service-delegated
 * calculation, just without the single-action constraint.
 *
 * **Preview is a hard gate, not just a display**: `watch()` clears any
 * existing preview the instant a field changes, and "Apply" is disabled
 * whenever no preview exists — so a stale preview can never be applied
 * silently. This is the concrete mechanism behind "Preview effects
 * before destructive changes" (M4-007) / "Preview Health Factor impact"
 * (M4-008): every change, not only ones a later task might classify as
 * risk-increasing, is previewed before it can be applied. Classifying
 * *which* changes are "risk-increasing" specifically is M4-009's own
 * task (Portfolio Action Preview), not built here.
 *
 * **"Price source" (M4-007) / "Price" (M4-008) — read-only, not
 * editable inputs.** No live price/rate source exists anywhere in this
 * codebase (the `PriceProvider`/`AaveV3Provider` infrastructure layer
 * was never built — see PROJECT_STATUS.md's Milestone 3 findings), so
 * "Price source" can only ever read "Manual" today; rendered as
 * informational text, not a selector with no second option. "Price" for
 * a debt position has no Engine-level counterpart at all —
 * `calculateDebtValue` (F-003)'s own equation is "Debt Value = Borrowed
 * Stablecoins," a hard 1:1 USD peg with no price parameter accepted —
 * shown as informational text stating that assumption (conflict #25),
 * not a fabricated editable field with nothing to actually affect.
 *
 * **"Rate type" (M4-008) — not rendered, documented gap (conflict
 * #25).** No value domain (Fixed/Variable, or anything else) is defined
 * anywhere in the documentation, and the Engine work that would
 * naturally house a fixed-vs-variable distinction (M2-013/M2-014,
 * "Variable Rate Projection") was formally blocked and never
 * implemented (conflict #7) — there is nothing for this field to
 * control even if a UI control were built.
 *
 * **"Manual price" (M4-007) writes to `portfolio.market.btcPriceUsd`**,
 * the same field M4-005's Creation Flow calls "Manual BTC price" — this
 * batch gives it a basic editable input; the fuller manual-price UX
 * (timestamp, reset action, stale-data warning) is M4-014's own,
 * later, dedicated task.
 *
 * **"Maximum LTV"/"Liquidation threshold" (M4-007) and "Borrow rate"
 * (M4-008) write to `portfolio.protocol`** (a portfolio-level field, not
 * per-position in this data model) — each form edits only the 1–2
 * fields it names, carrying the other, untouched protocol fields
 * through unedited via hidden inputs so the full, valid
 * `ProtocolParameters` object is always submitted together. The fuller
 * "preset selection"/"freshness status" UX is M4-015's own, later,
 * dedicated task.
 */
const AUTOSAVE_DEBOUNCE_MS = 600;

function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function formatHealthFactor(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}

function formatPercent(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 2 }).format(
    value,
  );
}

type PortfolioDetailsFormValues = z.input<typeof portfolioDetailsSchema>;

function PortfolioDetailsForm({
  portfolioId,
  portfolio,
}: {
  portfolioId: string;
  portfolio: Portfolio;
}) {
  const update = usePortfolioStore((state) => state.update);

  const {
    register,
    watch,
    formState: { errors },
  } = useForm<PortfolioDetailsFormValues, unknown, PortfolioDetailsInput>({
    resolver: zodResolver(portfolioDetailsSchema),
    mode: 'onChange',
    defaultValues: {
      name: portfolio.name,
      description: portfolio.description,
      baseCurrency: portfolio.baseCurrency,
      settings: portfolio.settings,
    },
  });

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const subscription = watch((values) => {
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        const parsed = portfolioDetailsSchema.safeParse(values);
        if (parsed.success) update(portfolioId, parsed.data);
      }, AUTOSAVE_DEBOUNCE_MS);
    });
    return () => {
      subscription.unsubscribe();
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    };
  }, [watch, portfolioId, update]);

  return (
    <form className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <p className="text-xs text-muted-foreground">Changes save automatically.</p>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold text-foreground">General</legend>
        <label className="flex flex-col gap-1 text-sm">
          <span>Portfolio name</span>
          <input
            {...register('name')}
            className="rounded-md border border-border bg-transparent px-3 py-2"
          />
        </label>
        {errors.name && <span className="text-xs text-destructive">{errors.name.message}</span>}
        <label className="flex flex-col gap-1 text-sm">
          <span>Description</span>
          <textarea
            {...register('description')}
            className="rounded-md border border-border bg-transparent px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>Base currency</span>
          <input
            {...register('baseCurrency')}
            className="rounded-md border border-border bg-transparent px-3 py-2"
          />
        </label>
        {errors.baseCurrency && (
          <span className="text-xs text-destructive">{errors.baseCurrency.message}</span>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold text-foreground">Safety target settings</legend>
        <label className="flex flex-col gap-1 text-sm">
          <span>Target Health Factor</span>
          <input
            type="number"
            step="any"
            {...register('settings.safetyTargets.targetHealthFactor', {
              setValueAs: (value) => (value === '' ? undefined : Number(value)),
            })}
            className="rounded-md border border-border bg-transparent px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>Holding period (days)</span>
          <input
            type="number"
            step="any"
            {...register('settings.safetyTargets.holdingPeriodDays', {
              setValueAs: (value) => (value === '' ? undefined : Number(value)),
            })}
            className="rounded-md border border-border bg-transparent px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>Target BTC price (USD)</span>
          <input
            type="number"
            step="any"
            {...register('settings.safetyTargets.targetBtcPriceUsd', {
              setValueAs: (value) => (value === '' ? undefined : Number(value)),
            })}
            className="rounded-md border border-border bg-transparent px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>Safety buffer (%)</span>
          <input
            type="number"
            step="any"
            {...register('settings.safetyTargets.safetyBufferPercent', {
              setValueAs: (value) => (value === '' ? undefined : Number(value)),
            })}
            className="rounded-md border border-border bg-transparent px-3 py-2"
          />
        </label>
      </fieldset>
    </form>
  );
}

function PreviewDiff({
  before,
  after,
}: {
  before: ServiceResult<PortfolioSummary>;
  after: ServiceResult<PortfolioSummary>;
}) {
  if (!after.ok) {
    return (
      <p className="text-sm text-destructive">
        {after.errors[0]?.message ?? 'This change would make the portfolio invalid.'}
      </p>
    );
  }
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
      <dt className="text-muted-foreground">Net Equity</dt>
      <dd>
        {before.ok ? formatCurrency(before.data.netEquity) : '—'} →{' '}
        {formatCurrency(after.data.netEquity)}
      </dd>
      <dt className="text-muted-foreground">Health Factor</dt>
      <dd>
        {before.ok ? formatHealthFactor(before.data.healthFactor) : '—'} →{' '}
        {formatHealthFactor(after.data.healthFactor)}
      </dd>
      <dt className="text-muted-foreground">Loan-to-Value</dt>
      <dd>
        {before.ok ? formatPercent(before.data.loanToValue) : '—'} →{' '}
        {formatPercent(after.data.loanToValue)}
      </dd>
    </dl>
  );
}

type CollateralManagementFormValues = z.input<typeof collateralManagementSchema>;

function CollateralPositionForm({
  portfolioId,
  portfolio,
  beforeSummary,
}: {
  portfolioId: string;
  portfolio: Portfolio;
  beforeSummary: ServiceResult<PortfolioSummary>;
}) {
  const update = usePortfolioStore((state) => state.update);
  const [preview, setPreview] = useState<ServiceResult<PortfolioSummary> | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<CollateralManagementFormValues, unknown, CollateralManagementInput>({
    resolver: zodResolver(collateralManagementSchema),
    mode: 'onChange',
    defaultValues: {
      collateral: portfolio.collateral,
      market: portfolio.market,
      protocol: portfolio.protocol,
    },
  });

  useEffect(() => {
    const subscription = watch(() => setPreview(null));
    return () => subscription.unsubscribe();
  }, [watch]);

  const onPreview = handleSubmit((data) => {
    setPreview(calculatePortfolioSummary({ ...portfolio, ...data }, 'manual'));
  });

  const onApply = handleSubmit((data) => {
    if (preview === null) return;
    const result = update(portfolioId, data);
    if (result.ok) {
      setPreview(null);
      reset({ collateral: data.collateral, market: data.market, protocol: data.protocol });
    }
  });

  return (
    <form className="mx-auto flex w-full max-w-2xl flex-col gap-3">
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold text-foreground">Collateral</legend>
        <input type="hidden" {...register('collateral.asset')} value="BTC" />
        <p className="text-xs text-muted-foreground">Asset: BTC</p>
        <label className="flex flex-col gap-1 text-sm">
          <span>Quantity</span>
          <input
            type="number"
            step="any"
            {...register('collateral.quantity', { valueAsNumber: true })}
            className="rounded-md border border-border bg-transparent px-3 py-2"
          />
        </label>
        {errors.collateral?.quantity && (
          <span className="text-xs text-destructive">{errors.collateral.quantity.message}</span>
        )}
        <p className="text-xs text-muted-foreground">Price source: Manual</p>
        <label className="flex flex-col gap-1 text-sm">
          <span>Manual price (USD)</span>
          <input
            type="number"
            step="any"
            {...register('market.btcPriceUsd', { valueAsNumber: true })}
            className="rounded-md border border-border bg-transparent px-3 py-2"
          />
        </label>
        {errors.market?.btcPriceUsd && (
          <span className="text-xs text-destructive">{errors.market.btcPriceUsd.message}</span>
        )}
        <label className="flex flex-col gap-1 text-sm">
          <span>Maximum LTV (0–1)</span>
          <input
            type="number"
            step="any"
            {...register('protocol.maxLoanToValue', { valueAsNumber: true })}
            className="rounded-md border border-border bg-transparent px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>Liquidation threshold (0–1)</span>
          <input
            type="number"
            step="any"
            {...register('protocol.liquidationThreshold', { valueAsNumber: true })}
            className="rounded-md border border-border bg-transparent px-3 py-2"
          />
        </label>
        {errors.protocol?.maxLoanToValue && (
          <span className="text-xs text-destructive">{errors.protocol.maxLoanToValue.message}</span>
        )}
        <input
          type="hidden"
          {...register('protocol.borrowApr', { valueAsNumber: true })}
          value={portfolio.protocol.borrowApr}
        />
        <input
          type="hidden"
          {...register('protocol.supplyApr', { valueAsNumber: true })}
          value={portfolio.protocol.supplyApr}
        />
      </fieldset>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onPreview}
          className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-accent/40"
        >
          Preview Changes
        </button>
        <button
          type="button"
          onClick={onApply}
          disabled={preview === null}
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          Apply Changes
        </button>
      </div>

      {preview && <PreviewDiff before={beforeSummary} after={preview} />}
    </form>
  );
}

type DebtManagementFormValues = z.input<typeof debtManagementSchema>;

function DebtPositionForm({
  portfolioId,
  portfolio,
  beforeSummary,
}: {
  portfolioId: string;
  portfolio: Portfolio;
  beforeSummary: ServiceResult<PortfolioSummary>;
}) {
  const update = usePortfolioStore((state) => state.update);
  const [preview, setPreview] = useState<ServiceResult<PortfolioSummary> | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<DebtManagementFormValues, unknown, DebtManagementInput>({
    resolver: zodResolver(debtManagementSchema),
    mode: 'onChange',
    defaultValues: {
      debt: portfolio.debt,
      protocol: portfolio.protocol,
    },
  });

  useEffect(() => {
    const subscription = watch(() => setPreview(null));
    return () => subscription.unsubscribe();
  }, [watch]);

  const onPreview = handleSubmit((data) => {
    setPreview(calculatePortfolioSummary({ ...portfolio, ...data }, 'manual'));
  });

  const onApply = handleSubmit((data) => {
    if (preview === null) return;
    const result = update(portfolioId, data);
    if (result.ok) {
      setPreview(null);
      reset({ debt: data.debt, protocol: data.protocol });
    }
  });

  return (
    <form className="mx-auto flex w-full max-w-2xl flex-col gap-3">
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold text-foreground">Debt</legend>
        <label className="flex flex-col gap-1 text-sm">
          <span>Asset</span>
          <select
            {...register('debt.asset')}
            className="rounded-md border border-border bg-transparent px-3 py-2"
          >
            <option value="USDC">USDC</option>
            <option value="USDT">USDT</option>
            <option value="DAI">DAI</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>Debt amount</span>
          <input
            type="number"
            step="any"
            {...register('debt.balance', { valueAsNumber: true })}
            className="rounded-md border border-border bg-transparent px-3 py-2"
          />
        </label>
        {errors.debt?.balance && (
          <span className="text-xs text-destructive">{errors.debt.balance.message}</span>
        )}
        <p className="text-xs text-muted-foreground">
          Price: $1.00 (assumed 1:1 stablecoin peg — see conflict #25, no editable price exists at
          the Engine layer)
        </p>
        <label className="flex flex-col gap-1 text-sm">
          <span>Borrow rate (0–1)</span>
          <input
            type="number"
            step="any"
            {...register('protocol.borrowApr', { valueAsNumber: true })}
            className="rounded-md border border-border bg-transparent px-3 py-2"
          />
        </label>
        <input
          type="hidden"
          {...register('protocol.maxLoanToValue', { valueAsNumber: true })}
          value={portfolio.protocol.maxLoanToValue}
        />
        <input
          type="hidden"
          {...register('protocol.liquidationThreshold', { valueAsNumber: true })}
          value={portfolio.protocol.liquidationThreshold}
        />
        <input
          type="hidden"
          {...register('protocol.supplyApr', { valueAsNumber: true })}
          value={portfolio.protocol.supplyApr}
        />
      </fieldset>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onPreview}
          className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-accent/40"
        >
          Preview Changes
        </button>
        <button
          type="button"
          onClick={onApply}
          disabled={preview === null}
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          Apply Changes
        </button>
      </div>

      {preview && <PreviewDiff before={beforeSummary} after={preview} />}
    </form>
  );
}

export default function PortfolioPage() {
  const activePortfolioId = usePortfolioStore((state) => state.activePortfolioId);
  const record = usePortfolioStore((state) =>
    state.activePortfolioId !== null ? state.portfolios[state.activePortfolioId] : undefined,
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Portfolio</h1>
        <p className="text-sm text-muted-foreground">&ldquo;What do I own?&rdquo;</p>
      </div>

      {activePortfolioId === null || record === undefined ? (
        <p className="text-sm text-muted-foreground">
          No portfolio is currently selected.{' '}
          <Link href="/portfolios" className="underline">
            Select or create one
          </Link>
          .
        </p>
      ) : (
        <div key={activePortfolioId} className="flex flex-col gap-8">
          <PortfolioDetailsForm portfolioId={activePortfolioId} portfolio={record.portfolio} />
          <CollateralPositionForm
            portfolioId={activePortfolioId}
            portfolio={record.portfolio}
            beforeSummary={record.summary}
          />
          <DebtPositionForm
            portfolioId={activePortfolioId}
            portfolio={record.portfolio}
            beforeSummary={record.summary}
          />
        </div>
      )}
    </div>
  );
}

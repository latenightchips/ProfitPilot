'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { usePortfolioStore } from '@/stores/portfolioStore';
import type { Portfolio } from '@/types/portfolio';
import { type PortfolioDetailsInput, portfolioDetailsSchema } from '@/types/portfolio.schema';

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
 * this batch covers them; only the editable identity/settings fields
 * M4-006 itself names.
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
 */
const AUTOSAVE_DEBOUNCE_MS = 600;

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
    <form className="mx-auto flex max-w-2xl flex-col gap-6">
      <p className="text-xs text-muted-foreground">Changes save automatically.</p>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold text-foreground">General</legend>
        <label className="flex flex-col gap-1 text-sm">
          <span>Portfolio name</span>
          <input
            {...register('name')}
            className="rounded-md border border-border bg-transparent px-3 py-2"
          />
          {errors.name && <span className="text-xs text-destructive">{errors.name.message}</span>}
        </label>
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
          {errors.baseCurrency && (
            <span className="text-xs text-destructive">{errors.baseCurrency.message}</span>
          )}
        </label>
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
        <PortfolioDetailsForm
          key={activePortfolioId}
          portfolioId={activePortfolioId}
          portfolio={record.portfolio}
        />
      )}
    </div>
  );
}

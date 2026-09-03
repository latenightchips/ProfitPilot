import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LoopStrategyControls } from '@/features/loop-builder';
import type { ApplicationPortfolio } from '@/services';
import { useLoopBuilderStore } from '@/stores/loopBuilderStore';

/**
 * Loop Strategy Controls — 06_TASKS.md M7-008. Requirements: "Use
 * React Hook Form and Zod. Show validation before calculation." DoD:
 * "Only valid strategy inputs reach the Loop Strategy Service."
 *
 * **External Store mutations are wrapped in `act()`.** A direct
 * `useLoopBuilderStore.getState().setSettings(...)` call (simulating
 * what `LoopPresets.tsx` does from its own click handler) happens
 * outside any React event, so without `act()` React may defer flushing
 * the resulting re-render to an unspecified later tick — an assertion
 * checked immediately afterward could then observe a DOM that hasn't
 * caught up yet, independent of whether the component's own
 * synchronization logic is correct. Wrapping the mutation in `act()`
 * (synchronous — the resync effect itself does no async work) makes
 * these tests assert against the render React has actually committed,
 * the same guarantee a real click handler gets for free from React's
 * own event-batching.
 */
const INITIAL_STATE = {
  settings: null,
  currentResult: null,
  status: 'idle' as const,
  errors: [],
  warnings: [],
  lastMetadata: null,
  savedStrategies: [],
  selectedStrategyId: null,
};

function validPortfolio(): ApplicationPortfolio {
  return {
    collateral: { asset: 'BTC', quantity: 1 },
    debt: { asset: 'USDC', balance: 0 },
    market: { btcPriceUsd: 50000 },
    protocol: {
      maxLoanToValue: 0.5,
      liquidationThreshold: 0.8,
      borrowApr: 0.05,
      supplyApr: 0.02,
    },
  };
}

beforeEach(() => {
  useLoopBuilderStore.setState(INITIAL_STATE);
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('LoopStrategyControls — pre-filled defaults', () => {
  it('pre-fills Maximum LTV and Borrow interest rate assumption from the real portfolio protocol values, displayed as percentages (UX-06)', () => {
    render(<LoopStrategyControls portfolio={validPortfolio()} portfolioId="portfolio-1" />);
    expect(screen.getByLabelText('Maximum LTV (%)', { exact: false })).toHaveValue(50);
    expect(
      screen.getByLabelText('Borrow interest rate assumption (%)', { exact: false }),
    ).toHaveValue(5);
  });

  it('pre-fills How much to borrow each loop as a percentage, not a raw fraction', () => {
    render(<LoopStrategyControls portfolio={validPortfolio()} portfolioId="portfolio-1" />);
    expect(screen.getByLabelText('How much to borrow each loop (%)', { exact: false })).toHaveValue(
      50,
    );
  });

  it('V4 semantic audit, Batch 2 (A1) — never labels the field "Collateral Factor" for a V3 (or unset) portfolio', () => {
    render(<LoopStrategyControls portfolio={validPortfolio()} portfolioId="portfolio-1" />);
    expect(
      screen.queryByLabelText('Collateral Factor (%)', { exact: false }),
    ).not.toBeInTheDocument();
  });
});

describe('LoopStrategyControls — live, debounced, validated updates (M7-010 Requirement)', () => {
  it('does not call the Service before the debounce window elapses', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<LoopStrategyControls portfolio={validPortfolio()} portfolioId="portfolio-1" />);

    const maxLoopsInput = screen.getByLabelText('Maximum Number of Loops');
    await user.clear(maxLoopsInput);
    await user.type(maxLoopsInput, '2');

    expect(useLoopBuilderStore.getState().currentResult).toBeNull();
  });

  it('reaches the real Loop Strategy Service with valid inputs after the debounce window', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<LoopStrategyControls portfolio={validPortfolio()} portfolioId="portfolio-1" />);

    const maxLoopsInput = screen.getByLabelText('Maximum Number of Loops');
    await user.clear(maxLoopsInput);
    await user.type(maxLoopsInput, '2');
    await vi.advanceTimersByTimeAsync(500);

    const state = useLoopBuilderStore.getState();
    expect(state.settings?.maxLoops).toBe(2);
    expect(state.currentResult).not.toBeNull();
  });

  it('never reaches the Service while a field is invalid (DoD: only valid inputs reach the Service)', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<LoopStrategyControls portfolio={validPortfolio()} portfolioId="portfolio-1" />);

    const ltvInput = screen.getByLabelText('Maximum LTV (%)', { exact: false });
    await user.clear(ltvInput);
    await user.type(ltvInput, '150');
    await vi.advanceTimersByTimeAsync(500);

    expect(screen.getByText('Maximum LTV must be between 0% and 100%.')).toBeInTheDocument();
    expect(useLoopBuilderStore.getState().settings).toBeNull();
  });

  it('shows a validation error for an out-of-range "How much to borrow each loop" percentage', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<LoopStrategyControls portfolio={validPortfolio()} portfolioId="portfolio-1" />);

    const input = screen.getByLabelText('How much to borrow each loop (%)', { exact: false });
    await user.clear(input);
    await user.type(input, '150');
    await vi.advanceTimersByTimeAsync(500);

    expect(input.closest('label')?.nextElementSibling?.textContent).toBe(
      'Borrow percentage per step must be between 0% and 100%.',
    );
  });

  it('shows a validation error for a non-positive Minimum Health Factor', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<LoopStrategyControls portfolio={validPortfolio()} portfolioId="portfolio-1" />);

    const input = screen.getByLabelText('Minimum Health Factor', { exact: false });
    await user.clear(input);
    await user.type(input, '0');
    await vi.advanceTimersByTimeAsync(500);

    expect(input.closest('label')?.nextElementSibling?.textContent).toMatch(
      /Too small|Number must be|greater than/i,
    );
  });

  it('shows a validation error for a negative Borrow interest rate assumption', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<LoopStrategyControls portfolio={validPortfolio()} portfolioId="portfolio-1" />);

    const input = screen.getByLabelText('Borrow interest rate assumption (%)', { exact: false });
    await user.clear(input);
    await user.type(input, '-1');
    await vi.advanceTimersByTimeAsync(500);

    expect(input.closest('label')?.nextElementSibling?.textContent).toBe(
      'Borrow interest rate assumption cannot be negative.',
    );
  });
});

describe('LoopStrategyControls — resyncs when settings change externally (real bug found during manual browser verification)', () => {
  it('updates its own displayed field values when another component (e.g. LoopPresets) calls setSettings directly', () => {
    render(<LoopStrategyControls portfolio={validPortfolio()} portfolioId="portfolio-1" />);
    expect(screen.getByLabelText('Maximum Number of Loops')).toHaveValue(3);

    // Simulates exactly what LoopPresets.tsx does — calls setSettings
    // directly, bypassing this form's own onChange-driven debounce.
    act(() => {
      useLoopBuilderStore.getState().setSettings({
        targetBorrowPercentage: 0.7,
        maxLoops: 5,
        minHealthFactor: 1.5,
        maxLoanToValueOverride: 0.5,
        borrowAprOverride: 0.05,
      });
    });

    expect(screen.getByLabelText('Maximum Number of Loops')).toHaveValue(5);
    expect(screen.getByLabelText('How much to borrow each loop (%)', { exact: false })).toHaveValue(
      70,
    );
  });

  it('does not fight its own debounced update — typing still works normally right after an external change', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<LoopStrategyControls portfolio={validPortfolio()} portfolioId="portfolio-1" />);

    act(() => {
      useLoopBuilderStore.getState().setSettings({
        targetBorrowPercentage: 0.7,
        maxLoops: 5,
        minHealthFactor: 1.5,
        maxLoanToValueOverride: 0.5,
        borrowAprOverride: 0.05,
      });
    });
    expect(screen.getByLabelText('Maximum Number of Loops')).toHaveValue(5);

    const maxLoopsInput = screen.getByLabelText('Maximum Number of Loops');
    await user.clear(maxLoopsInput);
    await user.type(maxLoopsInput, '2');
    await vi.advanceTimersByTimeAsync(500);

    expect(useLoopBuilderStore.getState().settings?.maxLoops).toBe(2);
    expect(screen.getByLabelText('Maximum Number of Loops')).toHaveValue(2);
  });

  it('a pending debounced edit is cancelled by an external settings change and cannot overwrite it later (regression)', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<LoopStrategyControls portfolio={validPortfolio()} portfolioId="portfolio-1" />);

    // Start typing a real edit but do NOT let its debounce fire yet —
    // this leaves a pending setTimeout scheduled to push maxLoops: 2.
    const maxLoopsInput = screen.getByLabelText('Maximum Number of Loops');
    await user.clear(maxLoopsInput);
    await user.type(maxLoopsInput, '2');
    expect(useLoopBuilderStore.getState().settings).toBeNull();

    // Before that debounce fires, an external settings change arrives
    // (e.g. a LoopPresets click) — this must cancel the pending push.
    act(() => {
      useLoopBuilderStore.getState().setSettings({
        targetBorrowPercentage: 0.7,
        maxLoops: 5,
        minHealthFactor: 1.5,
        maxLoanToValueOverride: 0.5,
        borrowAprOverride: 0.05,
      });
    });
    expect(screen.getByLabelText('Maximum Number of Loops')).toHaveValue(5);

    // Advance well past the original debounce window. If the stale
    // pending push were not cancelled, it would fire here and silently
    // overwrite the preset's maxLoops: 5 back down to the typed 2.
    await vi.advanceTimersByTimeAsync(1000);

    const state = useLoopBuilderStore.getState();
    expect(state.settings?.maxLoops).toBe(5);
    expect(screen.getByLabelText('Maximum Number of Loops')).toHaveValue(5);
  });
});

describe('LoopStrategyControls — reset', () => {
  it('resets both the form and the Store back to their initial state', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<LoopStrategyControls portfolio={validPortfolio()} portfolioId="portfolio-1" />);

    const maxLoopsInput = screen.getByLabelText('Maximum Number of Loops');
    await user.clear(maxLoopsInput);
    await user.type(maxLoopsInput, '2');
    await vi.advanceTimersByTimeAsync(500);
    expect(useLoopBuilderStore.getState().currentResult).not.toBeNull();

    await user.click(screen.getByRole('button', { name: 'Reset Strategy' }));

    expect(useLoopBuilderStore.getState().currentResult).toBeNull();
    expect(useLoopBuilderStore.getState().settings).toBeNull();
    expect(screen.getByLabelText('Maximum Number of Loops')).toHaveValue(3);
  });

  it('a pending debounced edit is cancelled by Reset Strategy and cannot resurrect settings afterward (regression)', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<LoopStrategyControls portfolio={validPortfolio()} portfolioId="portfolio-1" />);

    const maxLoopsInput = screen.getByLabelText('Maximum Number of Loops');
    await user.clear(maxLoopsInput);
    await user.type(maxLoopsInput, '2');

    await user.click(screen.getByRole('button', { name: 'Reset Strategy' }));
    expect(useLoopBuilderStore.getState().settings).toBeNull();

    // If the pending debounce from the typed '2' were not cancelled, it
    // would fire here and resurrect settings right after the reset.
    await vi.advanceTimersByTimeAsync(1000);

    expect(useLoopBuilderStore.getState().settings).toBeNull();
    expect(useLoopBuilderStore.getState().currentResult).toBeNull();
  });
});

/**
 * UX punch-list UX-06 regression tests — percentage-scale UI boundary
 * conversion for `borrowPercentagePerStep`/`maxLoanToValue`/
 * `borrowRateAssumption`. The regression risk is the same as UX-01's:
 * double conversion, or a conversion that only applies in one direction.
 * `maxLoops`/`minHealthFactor` are deliberately not percentages and are
 * asserted unaffected.
 */
describe('LoopStrategyControls — UX-06 percentage-scale round-trip (no double conversion)', () => {
  it('typing a percentage commits the correct 0–1 decimal to the Store (LoopStrategySettings unchanged)', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<LoopStrategyControls portfolio={validPortfolio()} portfolioId="portfolio-1" />);

    const stepInput = screen.getByLabelText('How much to borrow each loop (%)', { exact: false });
    await user.clear(stepInput);
    await user.type(stepInput, '40');
    const ltvInput = screen.getByLabelText('Maximum LTV (%)', { exact: false });
    await user.clear(ltvInput);
    await user.type(ltvInput, '60');
    const rateInput = screen.getByLabelText('Borrow interest rate assumption (%)', {
      exact: false,
    });
    await user.clear(rateInput);
    await user.type(rateInput, '4');
    await vi.advanceTimersByTimeAsync(500);

    const settings = useLoopBuilderStore.getState().settings;
    expect(settings?.targetBorrowPercentage).toBe(0.4);
    expect(settings?.maxLoanToValueOverride).toBe(0.6);
    expect(settings?.borrowAprOverride).toBe(0.04);
    // maxLoops/minHealthFactor are not percentages — unaffected by this conversion.
    expect(settings?.maxLoops).toBe(3);
    expect(settings?.minHealthFactor).toBe(1.5);
  });

  it('a preset applied via setSettings (decimal) displays correctly as a percentage, and re-typing the same percentage round-trips to the identical decimal (preset/manual equivalence)', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<LoopStrategyControls portfolio={validPortfolio()} portfolioId="portfolio-1" />);

    // Simulates LoopPresets.tsx's "Aggressive" preset (0.7 internally).
    act(() => {
      useLoopBuilderStore.getState().setSettings({
        targetBorrowPercentage: 0.7,
        maxLoops: 5,
        minHealthFactor: 1.5,
        maxLoanToValueOverride: 0.5,
        borrowAprOverride: 0.05,
      });
    });
    expect(screen.getByLabelText('How much to borrow each loop (%)', { exact: false })).toHaveValue(
      70,
    );

    // Manually re-typing "70" must commit the identical 0.7 decimal a
    // preset click would — not 0.007 (double-divided) or 70 (never
    // divided at all).
    const stepInput = screen.getByLabelText('How much to borrow each loop (%)', { exact: false });
    await user.clear(stepInput);
    await user.type(stepInput, '70');
    await vi.advanceTimersByTimeAsync(500);

    expect(useLoopBuilderStore.getState().settings?.targetBorrowPercentage).toBe(0.7);
  });

  it('does not expose raw "(0–1)" labels or developer/specification references anywhere in the rendered form', () => {
    render(<LoopStrategyControls portfolio={validPortfolio()} portfolioId="portfolio-1" />);
    const bodyText = document.body.textContent ?? '';
    expect(bodyText).not.toContain('(0–1)');
    expect(bodyText).not.toMatch(/F-0\d\d\d/);
    expect(bodyText).not.toContain('02_Formulas.md');
    expect(bodyText).not.toMatch(/Conflict #\d+/);
  });

  it('explains Minimum Health Factor in plain language without altering its numeric semantics', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<LoopStrategyControls portfolio={validPortfolio()} portfolioId="portfolio-1" />);

    expect(
      screen.getByText(/Health Factor measures how close your position is/),
    ).toBeInTheDocument();

    const input = screen.getByLabelText('Minimum Health Factor', { exact: false });
    await user.clear(input);
    await user.type(input, '2');
    await vi.advanceTimersByTimeAsync(500);

    // The explanation is presentation-only — the raw number still flows
    // through to the Store unchanged.
    expect(useLoopBuilderStore.getState().settings?.minHealthFactor).toBe(2);
  });
});

/**
 * V4 canonical borrow-rate default and override discipline — V4
 * Readiness Audit §12 Stage 17 (Part 1). Before this stage,
 * `defaultFormValues` seeded this field from the raw legacy
 * `portfolio.protocol.borrowApr`, and `handleFieldChange` always
 * submitted whatever the field currently displayed as a permanent
 * `borrowAprOverride` — so editing e.g. Maximum Number of Loops on a V4
 * portfolio silently froze the wrong V3-shaped rate into
 * `LoopStrategySettings`, permanently defeating `services/loop/strategy.ts`'s
 * own Stage 15 fallback (`settings.borrowAprOverride === undefined`).
 */
describe('LoopStrategyControls — V4 canonical borrow rate default and override discipline (Stage 17)', () => {
  function v4Portfolio(): ApplicationPortfolio {
    return {
      ...validPortfolio(),
      collateral: { asset: 'BTC', quantity: 2 },
      protocolVersion: 'v4',
      v4Position: { userAddress: '0x1234567890123456789012345678901234567890' },
      v4DebtState: { drawnDebt: 20000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.1 },
    };
  }

  it('defaults the rate field to the canonical V4 effective borrow rate, not the raw legacy protocol.borrowApr', () => {
    render(<LoopStrategyControls portfolio={v4Portfolio()} portfolioId="portfolio-1" />);
    const input = screen.getByLabelText('Borrow interest rate assumption (%)', {
      exact: false,
    }) as HTMLInputElement;
    // Same Stage 10/15/16 regression vector reused by CsvExporter.test.ts
    // and recommendations.test.ts: annualCost 1100 / totalDebt 20500 ≈
    // 5.365853658536585%, never the legacy protocol.borrowApr (5%).
    expect(Number(input.value)).toBeCloseTo(5.365853658536585, 6);
  });

  it('editing an unrelated field (Maximum Number of Loops) does not inject a legacy V3 rate override into settings', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<LoopStrategyControls portfolio={v4Portfolio()} portfolioId="portfolio-1" />);

    const maxLoopsInput = screen.getByLabelText('Maximum Number of Loops');
    await user.clear(maxLoopsInput);
    await user.type(maxLoopsInput, '2');
    await vi.advanceTimersByTimeAsync(500);

    const state = useLoopBuilderStore.getState();
    expect(state.settings?.maxLoops).toBe(2);
    expect(state.settings?.borrowAprOverride).toBeUndefined();
  });

  it('an explicit user edit to the rate field still produces a real borrowAprOverride', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<LoopStrategyControls portfolio={v4Portfolio()} portfolioId="portfolio-1" />);

    const rateInput = screen.getByLabelText('Borrow interest rate assumption (%)', {
      exact: false,
    });
    await user.clear(rateInput);
    await user.type(rateInput, '8');
    await vi.advanceTimersByTimeAsync(500);

    expect(useLoopBuilderStore.getState().settings?.borrowAprOverride).toBe(0.08);
  });

  it('once established, a later unrelated-field edit preserves the explicit rate override rather than dropping it', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<LoopStrategyControls portfolio={v4Portfolio()} portfolioId="portfolio-1" />);

    const rateInput = screen.getByLabelText('Borrow interest rate assumption (%)', {
      exact: false,
    });
    await user.clear(rateInput);
    await user.type(rateInput, '8');
    await vi.advanceTimersByTimeAsync(500);
    expect(useLoopBuilderStore.getState().settings?.borrowAprOverride).toBe(0.08);

    const maxLoopsInput = screen.getByLabelText('Maximum Number of Loops');
    await user.clear(maxLoopsInput);
    await user.type(maxLoopsInput, '4');
    await vi.advanceTimersByTimeAsync(500);

    const state = useLoopBuilderStore.getState();
    expect(state.settings?.maxLoops).toBe(4);
    expect(state.settings?.borrowAprOverride).toBe(0.08);
  });

  it('a preset-style push (setSettings with a concrete borrowAprOverride) establishes the rate, so a later unrelated edit preserves it too', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<LoopStrategyControls portfolio={v4Portfolio()} portfolioId="portfolio-1" />);

    act(() => {
      useLoopBuilderStore.getState().setSettings({
        targetBorrowPercentage: 0.7,
        maxLoops: 5,
        minHealthFactor: 1.5,
        maxLoanToValueOverride: 0.5,
        borrowAprOverride: 0.09,
      });
    });
    expect(
      screen.getByLabelText('Borrow interest rate assumption (%)', { exact: false }),
    ).toHaveValue(9);

    const maxLoopsInput = screen.getByLabelText('Maximum Number of Loops');
    await user.clear(maxLoopsInput);
    await user.type(maxLoopsInput, '2');
    await vi.advanceTimersByTimeAsync(500);

    expect(useLoopBuilderStore.getState().settings?.borrowAprOverride).toBe(0.09);
  });

  it('Reset Strategy re-derives the canonical V4 rate again (clears the established-override flag)', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<LoopStrategyControls portfolio={v4Portfolio()} portfolioId="portfolio-1" />);

    const rateInput = screen.getByLabelText('Borrow interest rate assumption (%)', {
      exact: false,
    });
    await user.clear(rateInput);
    await user.type(rateInput, '8');
    await vi.advanceTimersByTimeAsync(500);
    expect(useLoopBuilderStore.getState().settings?.borrowAprOverride).toBe(0.08);

    await user.click(screen.getByRole('button', { name: 'Reset Strategy' }));
    expect(useLoopBuilderStore.getState().settings).toBeNull();

    const maxLoopsInput = screen.getByLabelText('Maximum Number of Loops');
    await user.clear(maxLoopsInput);
    await user.type(maxLoopsInput, '2');
    await vi.advanceTimersByTimeAsync(500);

    expect(useLoopBuilderStore.getState().settings?.borrowAprOverride).toBeUndefined();
  });
});

/**
 * V3 unaffected — V4 Readiness Audit §12 Stage 17. Same "editing an
 * unrelated field" scenario as the V4 describe block above, proving the
 * `rateEstablishedRef` gate change has no observable effect on a V3 (or
 * unset) portfolio's own already-correct behavior: `borrowAprOverride`
 * comes back `undefined` either way, and `services/loop/strategy.ts`'s
 * own `engineInput.protocol.borrowApr` already falls back to the real
 * portfolio rate when it is, so the calculated result is unchanged.
 */
describe('LoopStrategyControls — V3 unaffected by the V4 rate-override discipline change (Stage 17)', () => {
  it('editing an unrelated field on a V3 portfolio still reaches the Service with the same result as before', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<LoopStrategyControls portfolio={validPortfolio()} portfolioId="portfolio-1" />);

    const maxLoopsInput = screen.getByLabelText('Maximum Number of Loops');
    await user.clear(maxLoopsInput);
    await user.type(maxLoopsInput, '2');
    await vi.advanceTimersByTimeAsync(500);

    const state = useLoopBuilderStore.getState();
    expect(state.settings?.maxLoops).toBe(2);
    expect(state.settings?.borrowAprOverride).toBeUndefined();
    expect(state.currentResult).not.toBeNull();
  });
});

/**
 * V4 canonical risk-capacity (collateralFactor) default and override
 * discipline — BLOCKER #2 fix, same shape and same root-cause class as
 * the V4 rate discipline block above (Stage 17), applied here to
 * "Maximum LTV." Before this fix, `defaultFormValues` seeded this field
 * from the raw legacy `portfolio.protocol.maxLoanToValue` for a V4
 * portfolio too, and `handleFieldChange` always submitted whatever the
 * field currently displayed as a permanent `maxLoanToValueOverride` — so
 * editing e.g. Maximum Number of Loops on a V4 portfolio silently froze
 * the wrong V3-shaped LTV into `LoopStrategySettings`, permanently
 * defeating `services/loop/strategy.ts`'s own V4 dispatch
 * (`settings.maxLoanToValueOverride ?? riskCapacityFraction`), which
 * always lets a supplied override win.
 *
 * `validPortfolio()`'s own `protocol.maxLoanToValue` is `0.5` (50%) —
 * `v4CollateralRisk.collateralFactor` below is deliberately `0.65` (65%),
 * a different value, so any leakage between the two is numerically
 * obvious rather than coincidentally matching.
 */
describe('LoopStrategyControls — V4 canonical risk-capacity (collateralFactor) default and override discipline (BLOCKER #2 fix)', () => {
  function v4Portfolio(): ApplicationPortfolio {
    return {
      ...validPortfolio(),
      collateral: { asset: 'BTC', quantity: 2 },
      protocolVersion: 'v4',
      v4Position: { userAddress: '0x1234567890123456789012345678901234567890' },
      v4DebtState: { drawnDebt: 20000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.1 },
      v4CollateralRisk: { collateralFactor: 0.65, dynamicConfigKey: 1 },
    };
  }

  it('labels the field "Collateral Factor (%)" for a V4 portfolio, never "Maximum LTV", and defaults it to the canonical V4 collateralFactor (65%), not the legacy protocol.maxLoanToValue (50%)', () => {
    render(<LoopStrategyControls portfolio={v4Portfolio()} portfolioId="portfolio-1" />);
    expect(screen.queryByLabelText('Maximum LTV (%)', { exact: false })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Collateral Factor (%)', { exact: false })).toHaveValue(65);
  });

  it('editing an unrelated field (Maximum Number of Loops) does not inject a legacy V3 maxLoanToValueOverride into settings', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<LoopStrategyControls portfolio={v4Portfolio()} portfolioId="portfolio-1" />);

    const maxLoopsInput = screen.getByLabelText('Maximum Number of Loops');
    await user.clear(maxLoopsInput);
    await user.type(maxLoopsInput, '2');
    await vi.advanceTimersByTimeAsync(500);

    const state = useLoopBuilderStore.getState();
    expect(state.settings?.maxLoops).toBe(2);
    expect(state.settings?.maxLoanToValueOverride).toBeUndefined();
  });

  it('an explicit user edit to the Collateral Factor field still produces a real maxLoanToValueOverride (field name/semantics unchanged — label only)', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<LoopStrategyControls portfolio={v4Portfolio()} portfolioId="portfolio-1" />);

    const ltvInput = screen.getByLabelText('Collateral Factor (%)', { exact: false });
    await user.clear(ltvInput);
    await user.type(ltvInput, '70');
    await vi.advanceTimersByTimeAsync(500);

    expect(useLoopBuilderStore.getState().settings?.maxLoanToValueOverride).toBe(0.7);
  });

  it('once established, a later unrelated-field edit preserves the explicit Collateral Factor override rather than dropping it', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<LoopStrategyControls portfolio={v4Portfolio()} portfolioId="portfolio-1" />);

    const ltvInput = screen.getByLabelText('Collateral Factor (%)', { exact: false });
    await user.clear(ltvInput);
    await user.type(ltvInput, '70');
    await vi.advanceTimersByTimeAsync(500);
    expect(useLoopBuilderStore.getState().settings?.maxLoanToValueOverride).toBe(0.7);

    const maxLoopsInput = screen.getByLabelText('Maximum Number of Loops');
    await user.clear(maxLoopsInput);
    await user.type(maxLoopsInput, '4');
    await vi.advanceTimersByTimeAsync(500);

    const state = useLoopBuilderStore.getState();
    expect(state.settings?.maxLoops).toBe(4);
    expect(state.settings?.maxLoanToValueOverride).toBe(0.7);
  });

  it('a preset-style push (setSettings with a concrete maxLoanToValueOverride) establishes the Collateral Factor, so a later unrelated edit preserves it too', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<LoopStrategyControls portfolio={v4Portfolio()} portfolioId="portfolio-1" />);

    act(() => {
      useLoopBuilderStore.getState().setSettings({
        targetBorrowPercentage: 0.7,
        maxLoops: 5,
        minHealthFactor: 1.5,
        maxLoanToValueOverride: 0.65,
        borrowAprOverride: 0.09,
      });
    });
    expect(screen.getByLabelText('Collateral Factor (%)', { exact: false })).toHaveValue(65);

    const maxLoopsInput = screen.getByLabelText('Maximum Number of Loops');
    await user.clear(maxLoopsInput);
    await user.type(maxLoopsInput, '2');
    await vi.advanceTimersByTimeAsync(500);

    expect(useLoopBuilderStore.getState().settings?.maxLoanToValueOverride).toBe(0.65);
  });

  it('Reset Strategy re-derives the canonical V4 collateralFactor again (clears the established-override flag)', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<LoopStrategyControls portfolio={v4Portfolio()} portfolioId="portfolio-1" />);

    const ltvInput = screen.getByLabelText('Collateral Factor (%)', { exact: false });
    await user.clear(ltvInput);
    await user.type(ltvInput, '70');
    await vi.advanceTimersByTimeAsync(500);
    expect(useLoopBuilderStore.getState().settings?.maxLoanToValueOverride).toBe(0.7);

    await user.click(screen.getByRole('button', { name: 'Reset Strategy' }));
    expect(useLoopBuilderStore.getState().settings).toBeNull();

    const maxLoopsInput = screen.getByLabelText('Maximum Number of Loops');
    await user.clear(maxLoopsInput);
    await user.type(maxLoopsInput, '2');
    await vi.advanceTimersByTimeAsync(500);

    expect(useLoopBuilderStore.getState().settings?.maxLoanToValueOverride).toBeUndefined();
  });

  it('shows a Collateral Factor validation error (never "Maximum LTV") for an out-of-range value on a V4 portfolio', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<LoopStrategyControls portfolio={v4Portfolio()} portfolioId="portfolio-1" />);

    const ltvInput = screen.getByLabelText('Collateral Factor (%)', { exact: false });
    await user.clear(ltvInput);
    await user.type(ltvInput, '150');
    await vi.advanceTimersByTimeAsync(500);

    expect(screen.getByText('Collateral Factor must be between 0% and 100%.')).toBeInTheDocument();
    expect(screen.queryByText(/Maximum LTV/)).not.toBeInTheDocument();
  });
});

/**
 * V3 unaffected — BLOCKER #2 fix. Same "editing an unrelated field"
 * scenario as the V4 describe block above, proving the
 * `maxLoanToValueEstablishedRef` gate change has no observable effect on
 * a V3 (or unset) portfolio's own already-correct behavior:
 * `maxLoanToValueOverride` comes back `undefined` either way, and
 * `services/loop/strategy.ts`'s own `mappedInput.protocol.maxLoanToValue`
 * already falls back to the real portfolio value when it is, so the
 * calculated result is unchanged.
 */
describe('LoopStrategyControls — V3 unaffected by the V4 LTV-override discipline change (BLOCKER #2 fix)', () => {
  it('editing an unrelated field on a V3 portfolio does not inject a maxLoanToValueOverride, and the field still shows the real protocol.maxLoanToValue (50%)', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<LoopStrategyControls portfolio={validPortfolio()} portfolioId="portfolio-1" />);
    expect(screen.getByLabelText('Maximum LTV (%)', { exact: false })).toHaveValue(50);

    const maxLoopsInput = screen.getByLabelText('Maximum Number of Loops');
    await user.clear(maxLoopsInput);
    await user.type(maxLoopsInput, '2');
    await vi.advanceTimersByTimeAsync(500);

    const state = useLoopBuilderStore.getState();
    expect(state.settings?.maxLoops).toBe(2);
    expect(state.settings?.maxLoanToValueOverride).toBeUndefined();
    expect(state.currentResult).not.toBeNull();
  });
});

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
  it('pre-fills Maximum LTV and Borrow-Rate Assumption from the real portfolio protocol values', () => {
    render(<LoopStrategyControls portfolio={validPortfolio()} />);
    expect(screen.getByLabelText('Maximum LTV (0–1)')).toHaveValue(0.5);
    expect(screen.getByLabelText('Borrow-Rate Assumption (0–1)')).toHaveValue(0.05);
  });
});

describe('LoopStrategyControls — live, debounced, validated updates (M7-010 Requirement)', () => {
  it('does not call the Service before the debounce window elapses', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<LoopStrategyControls portfolio={validPortfolio()} />);

    const maxLoopsInput = screen.getByLabelText('Maximum Number of Loops');
    await user.clear(maxLoopsInput);
    await user.type(maxLoopsInput, '2');

    expect(useLoopBuilderStore.getState().currentResult).toBeNull();
  });

  it('reaches the real Loop Strategy Service with valid inputs after the debounce window', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<LoopStrategyControls portfolio={validPortfolio()} />);

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
    render(<LoopStrategyControls portfolio={validPortfolio()} />);

    const ltvInput = screen.getByLabelText('Maximum LTV (0–1)');
    await user.clear(ltvInput);
    await user.type(ltvInput, '5');
    await vi.advanceTimersByTimeAsync(500);

    expect(screen.getByText(/Too big|Number must be|less than/i)).toBeInTheDocument();
    expect(useLoopBuilderStore.getState().settings).toBeNull();
  });

  it('shows a validation error for an out-of-range Borrow Percentage Per Step', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<LoopStrategyControls portfolio={validPortfolio()} />);

    const input = screen.getByLabelText('Borrow Percentage Per Step (0–1)');
    await user.clear(input);
    await user.type(input, '5');
    await vi.advanceTimersByTimeAsync(500);

    expect(input.closest('label')?.nextElementSibling?.textContent).toMatch(
      /Too big|Number must be|less than/i,
    );
  });

  it('shows a validation error for a non-positive Minimum Health Factor', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<LoopStrategyControls portfolio={validPortfolio()} />);

    const input = screen.getByLabelText('Minimum Health Factor');
    await user.clear(input);
    await user.type(input, '0');
    await vi.advanceTimersByTimeAsync(500);

    expect(input.closest('label')?.nextElementSibling?.textContent).toMatch(
      /Too small|Number must be|greater than/i,
    );
  });

  it('shows a validation error for a negative Borrow-Rate Assumption', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<LoopStrategyControls portfolio={validPortfolio()} />);

    const input = screen.getByLabelText('Borrow-Rate Assumption (0–1)');
    await user.clear(input);
    await user.type(input, '-1');
    await vi.advanceTimersByTimeAsync(500);

    expect(input.closest('label')?.nextElementSibling?.textContent).toMatch(
      /Too small|Number must be|greater than/i,
    );
  });
});

describe('LoopStrategyControls — resyncs when settings change externally (real bug found during manual browser verification)', () => {
  it('updates its own displayed field values when another component (e.g. LoopPresets) calls setSettings directly', () => {
    render(<LoopStrategyControls portfolio={validPortfolio()} />);
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
    expect(screen.getByLabelText('Borrow Percentage Per Step (0–1)')).toHaveValue(0.7);
  });

  it('does not fight its own debounced update — typing still works normally right after an external change', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<LoopStrategyControls portfolio={validPortfolio()} />);

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
    render(<LoopStrategyControls portfolio={validPortfolio()} />);

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
    render(<LoopStrategyControls portfolio={validPortfolio()} />);

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
    render(<LoopStrategyControls portfolio={validPortfolio()} />);

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

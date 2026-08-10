import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { formatCurrency } from '@/components/strategy/format';
import { LoopStepTable } from '@/features/loop-builder';
import type { ApplicationPortfolio } from '@/services';
import { useLoopBuilderStore } from '@/stores/loopBuilderStore';

/**
 * Loop Step Table — 06_TASKS.md M7-012. DoD: "Every final strategy value
 * can be traced through its individual steps."
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
});

describe('LoopStepTable — empty state', () => {
  it('prompts for a viable strategy before any calculation has run', () => {
    render(<LoopStepTable />);
    expect(screen.getByText(/Configure a viable strategy/i)).toBeInTheDocument();
  });
});

describe('LoopStepTable — real step rows traceable to final values (DoD)', () => {
  it('renders one row per real computed step, and the last row matches the final strategy values', () => {
    useLoopBuilderStore.getState().setSettings({
      targetBorrowPercentage: 0.5,
      maxLoops: 3,
      minHealthFactor: 1.1,
    });
    useLoopBuilderStore.getState().runLoopStrategy(validPortfolio());

    render(<LoopStepTable />);
    const { strategy } = useLoopBuilderStore.getState().currentResult!;
    const rows = screen.getAllByRole('row');
    // header row + one row per step
    expect(rows.length).toBe(strategy!.steps.length + 1);

    const lastStep = strategy!.steps[strategy!.steps.length - 1];
    const lastRow = rows[rows.length - 1];
    expect(lastRow.textContent).toContain(formatCurrency(lastStep.debtAfter));
    expect(lastStep.debtAfter).toBe(strategy!.finalDebt);
  });

  it('itemizes Cumulative Cost as unavailable rather than fabricating a running total', () => {
    useLoopBuilderStore.getState().setSettings({
      targetBorrowPercentage: 0.5,
      maxLoops: 3,
      minHealthFactor: 1.1,
    });
    useLoopBuilderStore.getState().runLoopStrategy(validPortfolio());

    render(<LoopStepTable />);
    const cells = screen.getAllByText('Fees, slippage, and gas not included');
    const { strategy } = useLoopBuilderStore.getState().currentResult!;
    expect(cells.length).toBe(strategy!.steps.length);
    const bodyText = document.body.textContent ?? '';
    expect(bodyText).not.toContain('02_Formulas.md');
  });
});

describe('LoopStepTable — expandable details (Include)', () => {
  it('starts each row collapsed and expands to reveal Available Borrow, Loop Capital, and Collateral Value After on click', async () => {
    const user = userEvent.setup();
    useLoopBuilderStore.getState().setSettings({
      targetBorrowPercentage: 0.5,
      maxLoops: 3,
      minHealthFactor: 1.1,
    });
    useLoopBuilderStore.getState().runLoopStrategy(validPortfolio());

    render(<LoopStepTable />);
    const disclosures = document.querySelectorAll('details');
    expect(disclosures.length).toBeGreaterThan(0);
    expect(disclosures[0].open).toBe(false);

    await user.click(screen.getAllByText('1')[0]);
    expect(disclosures[0].open).toBe(true);
    expect(disclosures[0].textContent).toContain('Available Borrow:');
    expect(disclosures[0].textContent).toContain('Loop Capital:');
    expect(disclosures[0].textContent).toContain('Collateral Value After:');
  });
});

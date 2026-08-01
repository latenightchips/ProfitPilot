import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { ExitTypeSelector } from '@/features/exit-planner';
import { useExitPlannerStore } from '@/stores/exitPlannerStore';

/**
 * Exit Type Selector — 06_TASKS.md M7-021. DoD: "Each documented exit
 * approach has a clear, validated input flow."
 */
const INITIAL_STATE = {
  exitType: null,
  targetInputs: null,
  currentResult: null,
  status: 'idle' as const,
  errors: [],
  warnings: [],
  lastMetadata: null,
  savedPlans: [],
};

beforeEach(() => {
  useExitPlannerStore.setState(INITIAL_STATE);
});

describe('ExitTypeSelector', () => {
  it('renders all 5 real, selectable exit types', () => {
    render(<ExitTypeSelector />);
    expect(screen.getByRole('button', { name: 'Full Exit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Partial Debt Repayment' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Target Health Factor' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Target Retained BTC' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Target Debt Balance' })).toBeInTheDocument();
  });

  it('renders Target Cash Proceeds as an explicit, labeled unavailable option citing Conflict #10, not a button', () => {
    render(<ExitTypeSelector />);
    expect(screen.queryByRole('button', { name: 'Target Cash Proceeds' })).not.toBeInTheDocument();
    expect(screen.getByText('Target Cash Proceeds')).toBeInTheDocument();
    expect(screen.getByText(/Not available[\s\S]*Conflict #10/)).toBeInTheDocument();
  });

  it('clicking a type calls setExitType and marks it selected', async () => {
    const user = userEvent.setup();
    render(<ExitTypeSelector />);

    await user.click(screen.getByRole('button', { name: 'Target Health Factor' }));

    expect(useExitPlannerStore.getState().exitType).toBe('targetHealthFactor');
    expect(screen.getByRole('button', { name: 'Target Health Factor' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Full Exit' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});

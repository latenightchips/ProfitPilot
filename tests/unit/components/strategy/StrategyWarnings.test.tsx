import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StrategyWarnings } from '@/components/strategy/StrategyWarnings';
import type { StrategyWarning } from '@/types/strategy';

/** Shared Strategy Warning System — 06_TASKS.md M7-005. */
describe('StrategyWarnings — empty state', () => {
  it('shows positive confirmation text rather than rendering nothing', () => {
    render(<StrategyWarnings warnings={[]} />);
    expect(screen.getByText('No warnings for this strategy.')).toBeInTheDocument();
  });
});

describe('StrategyWarnings — populated list', () => {
  it('renders category, cause, and suggested response for every warning', () => {
    const warnings: StrategyWarning[] = [
      {
        category: 'liquidation',
        severity: 'error',
        cause: 'Health Factor falls below 1.0 in this strategy.',
        suggestedResponse: 'Reduce the borrow percentage or loop count.',
      },
      {
        category: 'staleData',
        severity: 'warning',
        cause: 'Market price was last updated more than 5 minutes ago.',
        suggestedResponse: 'Refresh the portfolio before relying on this result.',
      },
    ];
    render(<StrategyWarnings warnings={warnings} />);

    expect(screen.getByText('Liquidation')).toBeInTheDocument();
    expect(screen.getByText('Health Factor falls below 1.0 in this strategy.')).toBeInTheDocument();
    expect(screen.getByText('Reduce the borrow percentage or loop count.')).toBeInTheDocument();
    expect(screen.getByText('Stale Data')).toBeInTheDocument();
  });

  it('gives error-severity warnings role="alert" and warning-severity warnings role="status"', () => {
    const warnings: StrategyWarning[] = [
      {
        category: 'infeasibleStrategy',
        severity: 'error',
        cause: 'No viable strategy exists for these inputs.',
        suggestedResponse: 'Adjust the strategy targets.',
      },
      {
        category: 'interestBurden',
        severity: 'warning',
        cause: 'Annual interest cost is high relative to the position.',
        suggestedResponse: 'Consider a smaller loop count.',
      },
    ];
    render(<StrategyWarnings warnings={warnings} />);

    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });

  it('keys two warnings sharing the same category as two distinct rows', () => {
    const warnings: StrategyWarning[] = [
      {
        category: 'safety',
        severity: 'warning',
        cause: 'First safety concern.',
        suggestedResponse: 'First suggested response.',
      },
      {
        category: 'safety',
        severity: 'warning',
        cause: 'Second safety concern.',
        suggestedResponse: 'Second suggested response.',
      },
    ];
    render(<StrategyWarnings warnings={warnings} />);
    expect(screen.getByText('First safety concern.')).toBeInTheDocument();
    expect(screen.getByText('Second safety concern.')).toBeInTheDocument();
  });
});

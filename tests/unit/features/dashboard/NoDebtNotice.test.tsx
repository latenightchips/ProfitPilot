import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { NoDebtNotice } from '@/features/dashboard';

/**
 * No-Debt Notice — 06_TASKS.md M5-020, "Portfolio without debt" Include item.
 */
describe('NoDebtNotice — hasDebt true', () => {
  it('renders nothing', () => {
    const { container } = render(<NoDebtNotice hasDebt />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('NoDebtNotice — hasDebt false', () => {
  it('explains the missing debt position and links to add one', () => {
    render(<NoDebtNotice hasDebt={false} />);

    expect(screen.getByText(/This portfolio has no debt position/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add a debt position' })).toHaveAttribute(
      'href',
      '/portfolio',
    );
  });

  it('announces itself as a polite status region (M5-024, Batch 13)', () => {
    render(<NoDebtNotice hasDebt={false} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});

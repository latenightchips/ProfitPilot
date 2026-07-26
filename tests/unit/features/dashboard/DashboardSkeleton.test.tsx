import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DashboardSkeleton } from '@/features/dashboard';

/**
 * Dashboard Skeleton — 06_TASKS.md M5-019.
 */
describe('DashboardSkeleton', () => {
  it('renders a single labeled loading region with no fabricated values', () => {
    render(<DashboardSkeleton />);

    const region = screen.getByRole('status', { name: 'Loading Dashboard' });
    expect(region).toBeInTheDocument();
    // No currency symbols, portfolio names, or numeric values should ever appear in a skeleton.
    expect(region.textContent).toBe('');
  });
});

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AppSidebar } from '@/components/layout/AppSidebar';

/**
 * V1.1 Batch 7, Section 3 — "active route remains understandable."
 * Before this batch, `AppSidebar` had no `usePathname()` call and no
 * conditional styling at all (confirmed by reading the file).
 */
let mockPathname = '/';
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

describe('AppSidebar — active route (V1.1 Batch 7)', () => {
  it('marks the current route with aria-current="page"', () => {
    mockPathname = '/portfolio';
    render(<AppSidebar />);
    expect(screen.getByRole('link', { name: 'Portfolio' })).toHaveAttribute('aria-current', 'page');
  });

  it('does not mark other routes as current', () => {
    mockPathname = '/portfolio';
    render(<AppSidebar />);
    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Simulation' })).not.toHaveAttribute('aria-current');
  });

  it('marks no route as current on an unrelated path', () => {
    mockPathname = '/settings/unknown';
    render(<AppSidebar />);
    for (const name of ['Dashboard', 'Portfolio', 'Simulation', 'Settings']) {
      expect(screen.getByRole('link', { name })).not.toHaveAttribute('aria-current');
    }
  });
});

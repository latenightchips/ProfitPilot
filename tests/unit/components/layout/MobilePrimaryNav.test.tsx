import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { MobilePrimaryNav } from '@/components/layout/MobilePrimaryNav';

/**
 * V1.1 Batch 7, Section 3 — closes the previously accepted "mobile
 * navigation gap noted, not built" (Milestone 5). Renders nothing when
 * closed; renders the full `NAV_ITEMS` list, with the active route
 * marked, when open; calls `onNavigate` when a link is clicked (used by
 * `AppShell` to close the panel after navigating).
 */
let mockPathname = '/';
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

describe('MobilePrimaryNav (V1.1 Batch 7)', () => {
  it('renders nothing when closed', () => {
    mockPathname = '/';
    render(<MobilePrimaryNav open={false} onNavigate={() => {}} />);
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument();
  });

  it('renders every primary nav item when open', () => {
    mockPathname = '/';
    render(<MobilePrimaryNav open={true} onNavigate={() => {}} />);
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    for (const name of [
      'Dashboard',
      'Portfolio',
      'Simulation',
      'Loop Builder',
      'Exit Planner',
      'Recommendations',
      'Settings',
    ]) {
      expect(nav.querySelector(`a[href]`)).toBeTruthy();
      expect(screen.getByRole('link', { name })).toBeInTheDocument();
    }
  });

  it('marks the active route with aria-current="page"', () => {
    mockPathname = '/simulation';
    render(<MobilePrimaryNav open={true} onNavigate={() => {}} />);
    expect(screen.getByRole('link', { name: 'Simulation' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
  });

  it('calls onNavigate when a link is clicked', async () => {
    mockPathname = '/';
    const onNavigate = vi.fn();
    render(<MobilePrimaryNav open={true} onNavigate={onNavigate} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('link', { name: 'Portfolio' }));
    expect(onNavigate).toHaveBeenCalledOnce();
  });
});

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import NewPortfolioPage from '@/app/portfolios/new/page';

/**
 * Scaffold-only route (see `app/portfolios/new/page.tsx`'s own header
 * comment) — the real guided flow is M4-005, a later task. This just
 * confirms the "Create action" link from `app/portfolios/page.tsx`
 * (M4-004) lands somewhere real rather than a broken route.
 */
describe('NewPortfolioPage (scaffold, M4-005 not yet implemented)', () => {
  it('renders and links back to the portfolio list', () => {
    render(<NewPortfolioPage />);
    expect(screen.getByText('Create Portfolio')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Portfolios' })).toHaveAttribute(
      'href',
      '/portfolios',
    );
  });
});

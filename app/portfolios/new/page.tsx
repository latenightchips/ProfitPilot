import type { Metadata } from 'next';

import { NewPortfolioPageClient } from './NewPortfolioPageClient';

/**
 * Thin Server Component wrapper — see `app/page.tsx`'s own header
 * comment for the full M9-024 reasoning. The Client Component's entire
 * existing implementation moved to `NewPortfolioPageClient.tsx`
 * unchanged; the default export keeps the same name every existing unit
 * test already imports from this exact path.
 */
export const metadata: Metadata = {
  title: 'Create Portfolio — ProfitPilot',
};

export default function NewPortfolioPage() {
  return <NewPortfolioPageClient />;
}

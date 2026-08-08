import type { Metadata } from 'next';

import { SimulationPageClient } from './SimulationPageClient';

/**
 * Thin Server Component wrapper — see `app/page.tsx`'s own header
 * comment for the full M9-024 reasoning. The Client Component's entire
 * existing implementation moved to `SimulationPageClient.tsx` unchanged;
 * the default export keeps the same name every existing unit test
 * already imports from this exact path.
 */
export const metadata: Metadata = {
  title: 'Simulation — ProfitPilot',
};

export default function SimulationPage() {
  return <SimulationPageClient />;
}

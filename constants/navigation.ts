/**
 * Primary navigation, per 03_UI.md page 2 ("Application Structure" / "Left Sidebar").
 * Each entry answers exactly one question — see 03_UI.md "CORE UX PRINCIPLES".
 */
export interface NavItem {
  label: string;
  href: string;
  question: string;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/', question: 'Am I safe?' },
  { label: 'Portfolio', href: '/portfolio', question: 'What do I own?' },
  { label: 'Simulation', href: '/simulation', question: 'What happens if...?' },
  { label: 'Loop Builder', href: '/loop-builder', question: 'How much leverage should I use?' },
  { label: 'Exit Planner', href: '/exit-planner', question: 'What should I do now?' },
  { label: 'Recommendations', href: '/recommendations', question: 'What actions are suggested?' },
  { label: 'Settings', href: '/settings', question: 'How do I customize the application?' },
];

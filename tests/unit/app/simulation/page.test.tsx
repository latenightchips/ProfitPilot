import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import SimulationPage from '@/app/simulation/page';

/**
 * Simulation Workspace Route — 06_TASKS.md M6-001 ("Create Simulation
 * Workspace"). DoD: "Users can access the Simulation Workspace from the
 * Dashboard." This batch is structural only — no Store or calculation
 * exists yet (M6-003/M6-004, later tasks) — so these tests cover the
 * layout this task's own "Include" list names, not any business logic.
 */
describe('SimulationPage — structural layout (M6-001)', () => {
  it('renders the page heading and its own question', () => {
    render(<SimulationPage />);
    expect(screen.getByRole('heading', { name: 'Simulation', level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/What happens if/)).toBeInTheDocument();
  });

  it('renders the three named regions from this task’s own Include list', () => {
    render(<SimulationPage />);
    expect(screen.getByRole('heading', { name: 'Scenario Controls' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Simulation Results' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Portfolio Comparison' })).toBeInTheDocument();
  });

  it('exposes the Scenario Controls region as a landmark for assistive technology', () => {
    render(<SimulationPage />);
    expect(screen.getByRole('complementary', { name: 'Scenario Controls' })).toBeInTheDocument();
  });

  it('does not render the Milestone 1 placeholder text anymore', () => {
    render(<SimulationPage />);
    expect(screen.queryByText(/scaffolded in Milestone 1/)).not.toBeInTheDocument();
  });
});

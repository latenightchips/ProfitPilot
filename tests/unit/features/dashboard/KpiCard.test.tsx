import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { KpiCard } from '@/features/dashboard';

/**
 * Shared KPI Card — 06_TASKS.md M5-005. Covers every "Support" item the
 * task names; each prop is exercised independently since this component
 * has no data source of its own to drive them together.
 */
describe('KpiCard — title and primary value', () => {
  it('renders the title and formatted primary value', () => {
    render(<KpiCard title="Health Factor" primaryValue="4" />);
    expect(screen.getByText('Health Factor')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });
});

describe('KpiCard — secondary value', () => {
  it('renders an optional secondary value', () => {
    render(<KpiCard title="Total Debt" primaryValue="$20,000.00" secondaryValue="USDC" />);
    expect(screen.getByText('USDC')).toBeInTheDocument();
  });

  it('omits the secondary value line when not provided', () => {
    render(<KpiCard title="Total Debt" primaryValue="$20,000.00" />);
    expect(screen.queryByText('USDC')).not.toBeInTheDocument();
  });
});

describe('KpiCard — status', () => {
  it('renders a visible "Unavailable" label, not color alone', () => {
    render(<KpiCard title="Liquidation Price" primaryValue="N/A (no debt)" status="unavailable" />);
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
  });

  it('renders a visible "Warning" label when set', () => {
    render(<KpiCard title="Health Factor" primaryValue="1.1" status="warning" />);
    expect(screen.getByText('Warning')).toBeInTheDocument();
  });

  it('renders no status label for "ok" or when omitted', () => {
    render(<KpiCard title="Health Factor" primaryValue="4" status="ok" />);
    expect(screen.queryByText('Warning')).not.toBeInTheDocument();
    expect(screen.queryByText('Unavailable')).not.toBeInTheDocument();
  });
});

describe('KpiCard — tooltip', () => {
  it('exposes the tooltip via the native title attribute', () => {
    render(
      <KpiCard title="Health Factor" primaryValue="4" tooltip="F-022 — see docs/02_Formulas.md" />,
    );
    expect(screen.getByText('Health Factor').closest('[title]')).toHaveAttribute(
      'title',
      'F-022 — see docs/02_Formulas.md',
    );
  });

  it('is keyboard-focusable when a tooltip is present, so it is reachable without a mouse (M5-024, Batch 13)', () => {
    render(
      <KpiCard title="Health Factor" primaryValue="4" tooltip="F-022 — see docs/02_Formulas.md" />,
    );
    expect(screen.getByText('Health Factor').closest('[title]')).toHaveAttribute('tabIndex', '0');
  });

  it('is not an extra tab stop when no tooltip is provided', () => {
    render(<KpiCard title="Health Factor" primaryValue="4" />);
    expect(screen.getByText('Health Factor').closest('div')).not.toHaveAttribute('tabIndex');
  });
});

describe('KpiCard — trend', () => {
  it('renders optional trend/comparison text when provided', () => {
    render(<KpiCard title="Net Portfolio Value" primaryValue="$80,000.00" trend="+2.8%" />);
    expect(screen.getByText('+2.8%')).toBeInTheDocument();
  });
});

describe('KpiCard — loading state', () => {
  it('hides the primary value and shows a loading placeholder instead', () => {
    render(<KpiCard title="Health Factor" primaryValue="4" loading />);
    expect(screen.queryByText('4')).not.toBeInTheDocument();
  });

  it('marks the card aria-busy while loading', () => {
    render(<KpiCard title="Health Factor" primaryValue="4" loading />);
    expect(screen.getByText('Health Factor').closest('[aria-busy]')).toHaveAttribute(
      'aria-busy',
      'true',
    );
  });
});

describe('KpiCard — Developer Mode details', () => {
  it('renders the slot only when a caller supplies content (no Developer Mode toggle exists yet)', () => {
    render(<KpiCard title="Health Factor" primaryValue="4" />);
    expect(screen.queryByText('engineVersion: 1.0')).not.toBeInTheDocument();
  });

  it('renders supplied Developer Mode details', () => {
    render(
      <KpiCard title="Health Factor" primaryValue="4" developerModeDetails="engineVersion: 1.0" />,
    );
    expect(screen.getByText('engineVersion: 1.0')).toBeInTheDocument();
  });
});

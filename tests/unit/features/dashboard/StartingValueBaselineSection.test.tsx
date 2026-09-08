import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StartingValueBaselineSection } from '@/features/dashboard';
import type { StartingValueBaselineSummary } from '@/features/dashboard/types/startingValueBaselineSummary';

/**
 * Starting-Value Baseline Section — v1.20.0 Batch 1 (Dashboard
 * Starting-Value Baseline Visibility). Hand-built fixtures, per this
 * batch's own instruction to test UI rendering, not the underlying
 * comparison formulas (already covered by
 * `tests/unit/features/dashboard/buildStartingValueBaselineSummary.test.ts`
 * and `tests/unit/services/portfolio/startingValueBaseline.test.ts`).
 */
const NO_BASELINE: StartingValueBaselineSummary = {
  hasBaseline: false,
  establishedAtFormatted: null,
  baselineValueFormatted: null,
  currentValueFormatted: null,
  changeFormatted: null,
  compositionChanged: false,
};

const WITH_BASELINE: StartingValueBaselineSummary = {
  hasBaseline: true,
  establishedAtFormatted: 'Jan 1, 2026, 12:00 AM',
  baselineValueFormatted: '$100,000.00',
  currentValueFormatted: '$120,000.00',
  changeFormatted: '+$20,000.00 (+20%)',
  compositionChanged: false,
};

const COMPOSITION_CHANGED: StartingValueBaselineSummary = {
  ...WITH_BASELINE,
  compositionChanged: true,
};

describe('StartingValueBaselineSection — no-baseline empty state', () => {
  it('explains that no baseline is set and links to the Portfolio page', () => {
    render(<StartingValueBaselineSection summary={NO_BASELINE} />);

    expect(screen.getByText(/No starting-value baseline is set/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Set a baseline' })).toHaveAttribute(
      'href',
      '/portfolio',
    );
  });

  it('renders no Set Baseline / Reset Baseline control of its own', () => {
    render(<StartingValueBaselineSection summary={NO_BASELINE} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /baseline/i })).not.toBeInTheDocument();
  });
});

describe('StartingValueBaselineSection — established baseline', () => {
  it('shows the baseline establishment context, and the authoritative baseline/current/change values', () => {
    render(<StartingValueBaselineSection summary={WITH_BASELINE} />);

    expect(
      screen.getByRole('heading', { level: 3, name: 'Performance since Jan 1, 2026, 12:00 AM' }),
    ).toBeInTheDocument();

    const dtNodes = screen.getAllByRole('term');
    const ddNodes = screen.getAllByRole('definition');
    expect(dtNodes.map((node) => node.textContent)).toEqual([
      'Baseline value',
      'Current value',
      'Change since baseline',
    ]);
    expect(ddNodes[0].textContent).toBe('$100,000.00');
    expect(ddNodes[1].textContent).toBe('$120,000.00');
    expect(ddNodes[2].textContent).toBe('+$20,000.00 (+20%)');
  });

  it('renders no composition-changed note and no mutation control', () => {
    render(<StartingValueBaselineSection summary={WITH_BASELINE} />);
    expect(screen.queryByText(/composition changed/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

describe('StartingValueBaselineSection — composition changed', () => {
  it('shows the composition-changed status, programmatically associated with the figures, without suppressing them', () => {
    render(<StartingValueBaselineSection summary={COMPOSITION_CHANGED} />);

    const statusText = screen.getByText(/composition changed since baseline/i);
    expect(statusText.tagName).toBe('P');
    const dl = document.querySelector('dl');
    expect(dl).not.toBeNull();
    expect(dl?.getAttribute('aria-describedby')).toBe(statusText.id);

    const ddNodes = screen.getAllByRole('definition');
    expect(ddNodes[0].textContent).toBe('$100,000.00');
    expect(ddNodes[1].textContent).toBe('$120,000.00');
  });
});

describe('StartingValueBaselineSection — accessibility', () => {
  it('the heading is a real <h3>, matching this Dashboard section family (RecommendationSummarySection precedent)', () => {
    render(<StartingValueBaselineSection summary={WITH_BASELINE} />);
    expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();
  });

  it('the no-baseline empty state is understandable from text alone, not color', () => {
    render(<StartingValueBaselineSection summary={NO_BASELINE} />);
    expect(
      screen.getByText(/No starting-value baseline is set for this portfolio/),
    ).toBeInTheDocument();
  });
});

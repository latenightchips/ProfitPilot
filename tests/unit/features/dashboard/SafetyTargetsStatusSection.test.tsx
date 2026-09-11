import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SafetyTargetsStatusSection } from '@/features/dashboard';
import type { SafetyTargetsStatusSummary } from '@/features/dashboard/types/safetyTargetsStatusSummary';

/**
 * Safety Targets Status Section — v1.23.0 Batch 2 (Dashboard Safety
 * Targets Status Integration). Hand-built fixtures, per this batch's
 * own instruction to test UI rendering, not the underlying comparison
 * (already covered by
 * `tests/unit/features/dashboard/buildSafetyTargetsStatusSummary.test.ts`
 * and `tests/unit/services/portfolio/safetyTargetsStatus.test.ts`).
 */
const ALL_CONFIGURED: SafetyTargetsStatusSummary = {
  rows: [
    {
      key: 'targetHealthFactor',
      label: 'Target Health Factor',
      status: 'met',
      detailFormatted: 'Target: 2 · Current: 4',
      statusLabel: 'Met',
    },
    {
      key: 'holdingPeriodDays',
      label: 'Holding Period',
      status: 'not_met',
      detailFormatted: 'Target: 365 days · Current: 30 days elapsed',
      statusLabel: 'In progress',
    },
    {
      key: 'targetBtcPriceUsd',
      label: 'Target BTC Price',
      status: 'met',
      detailFormatted: 'Target: $40,000.00 · Current: $50,000.00',
      statusLabel: 'Target reached',
    },
    {
      key: 'safetyBufferPercent',
      label: 'Safety Buffer',
      status: 'unavailable',
      detailFormatted: 'Target: 50% · Current: —',
      statusLabel: 'No liquidation risk to compare against',
    },
  ],
};

const ALL_NOT_CONFIGURED: SafetyTargetsStatusSummary = {
  rows: [
    {
      key: 'targetHealthFactor',
      label: 'Target Health Factor',
      status: 'not_configured',
      detailFormatted: 'Target: — · Current: 4',
      statusLabel: 'Not configured',
    },
    {
      key: 'holdingPeriodDays',
      label: 'Holding Period',
      status: 'not_configured',
      detailFormatted: 'Target: — · Current: 30 days elapsed',
      statusLabel: 'Not configured',
    },
    {
      key: 'targetBtcPriceUsd',
      label: 'Target BTC Price',
      status: 'not_configured',
      detailFormatted: 'Target: — · Current: $50,000.00',
      statusLabel: 'Not configured',
    },
    {
      key: 'safetyBufferPercent',
      label: 'Safety Buffer',
      status: 'not_configured',
      detailFormatted: 'Target: — · Current: 75%',
      statusLabel: 'Not configured',
    },
  ],
};

describe('SafetyTargetsStatusSection — heading and structure', () => {
  it('renders a heading and a link back to the Portfolio page, no editing control', () => {
    render(<SafetyTargetsStatusSection summary={ALL_CONFIGURED} />);

    expect(screen.getByRole('heading', { level: 3, name: 'Safety Targets' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /portfolio/i })).toHaveAttribute('href', '/portfolio');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('always renders all four rows', () => {
    render(<SafetyTargetsStatusSection summary={ALL_CONFIGURED} />);

    expect(screen.getByText('Target Health Factor')).toBeInTheDocument();
    expect(screen.getByText('Holding Period')).toBeInTheDocument();
    expect(screen.getByText('Target BTC Price')).toBeInTheDocument();
    expect(screen.getByText('Safety Buffer')).toBeInTheDocument();
  });
});

describe('SafetyTargetsStatusSection — target-specific status text, Not configured / Not available distinction', () => {
  it('renders "Met" only for Target Health Factor — the one target with an associated Recommendation', () => {
    render(<SafetyTargetsStatusSection summary={ALL_CONFIGURED} />);

    expect(screen.getAllByText('Met')).toHaveLength(1); // Target Health Factor only
  });

  it('renders "Target reached" for Target BTC Price, never "Met" (informational milestone)', () => {
    render(<SafetyTargetsStatusSection summary={ALL_CONFIGURED} />);

    expect(screen.getByText('Target reached')).toBeInTheDocument();
  });

  it('renders "In progress" for an unmet Holding Period, never "Not met" (informational milestone)', () => {
    render(<SafetyTargetsStatusSection summary={ALL_CONFIGURED} />);

    expect(screen.getByText('In progress')).toBeInTheDocument();
    expect(screen.queryByText('Not met')).not.toBeInTheDocument();
  });

  it('renders "Not configured" for every field when nothing is configured', () => {
    render(<SafetyTargetsStatusSection summary={ALL_NOT_CONFIGURED} />);

    expect(screen.getAllByText('Not configured')).toHaveLength(4);
  });

  it('renders the explicit zero-debt "No liquidation risk" text, never a fabricated 0%', () => {
    render(<SafetyTargetsStatusSection summary={ALL_CONFIGURED} />);

    expect(screen.getByText('No liquidation risk to compare against')).toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
  });

  it('no CTA/button exists for any target', () => {
    render(<SafetyTargetsStatusSection summary={ALL_CONFIGURED} />);

    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});

describe('SafetyTargetsStatusSection — detail formatting', () => {
  it('shows both the configured target and the current value for each row', () => {
    render(<SafetyTargetsStatusSection summary={ALL_CONFIGURED} />);

    expect(screen.getByText('Target: 2 · Current: 4')).toBeInTheDocument();
    expect(screen.getByText('Target: $40,000.00 · Current: $50,000.00')).toBeInTheDocument();
  });
});

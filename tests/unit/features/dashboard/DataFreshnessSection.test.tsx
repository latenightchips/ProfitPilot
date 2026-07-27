import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { DataFreshnessIndicators } from '@/features/dashboard';
import { DataFreshnessSection } from '@/features/dashboard';

/**
 * Data Freshness Indicators section — 06_TASKS.md M5-017.
 */
const INDICATORS: DataFreshnessIndicators = {
  market: {
    label: 'BTC Price',
    source: 'manual',
    isManual: true,
    formattedUpdatedAt: 'Jul 26, 2026, 12:00 AM',
    freshnessLabel: 'Fresh',
  },
  protocol: {
    label: 'Protocol Parameters',
    source: 'manual',
    isManual: true,
    formattedUpdatedAt: 'Jul 26, 2026, 12:00 AM',
    freshnessLabel: null,
  },
  refreshNote: 'Manual Mode note.',
};

describe('DataFreshnessSection — both sources available', () => {
  it('renders both rows and the refresh note', () => {
    render(<DataFreshnessSection indicators={INDICATORS} />);

    expect(screen.getByText('Data Freshness')).toBeInTheDocument();
    expect(screen.getByText('BTC Price:')).toBeInTheDocument();
    expect(screen.getByText('Protocol Parameters:')).toBeInTheDocument();
    expect(screen.getByText('Manual Mode note.')).toBeInTheDocument();
  });
});

describe('DataFreshnessSection — nothing available', () => {
  it('renders nothing when both market and protocol are null', () => {
    const { container } = render(
      <DataFreshnessSection indicators={{ market: null, protocol: null, refreshNote: 'note' }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe('DataFreshnessSection — stale market data (M5-025, Batch 15)', () => {
  it('renders the "Stale" classification for the BTC Price row', () => {
    render(
      <DataFreshnessSection
        indicators={{
          ...INDICATORS,
          market: { ...INDICATORS.market!, freshnessLabel: 'Stale' },
        }}
      />,
    );
    expect(screen.getByText(/Stale/)).toBeInTheDocument();
  });
});

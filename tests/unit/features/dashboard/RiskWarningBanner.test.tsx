import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RiskWarningBanner } from '@/features/dashboard';

describe('RiskWarningBanner — no active warnings', () => {
  it('renders nothing — an empty banner would block valid analysis unnecessarily', () => {
    const { container } = render(<RiskWarningBanner warnings={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('RiskWarningBanner — active warnings (M5-010 DoD)', () => {
  it('renders each warning’s reason and recommended action', () => {
    render(
      <RiskWarningBanner
        warnings={[
          {
            code: 'HEALTH_FACTOR_BELOW_TARGET',
            reason: 'Health Factor (4) is below your configured target (5).',
            recommendedAction: 'See the Health Factor Status section.',
          },
        ]}
      />,
    );
    expect(
      screen.getByText('Health Factor (4) is below your configured target (5).'),
    ).toBeInTheDocument();
    expect(screen.getByText('See the Health Factor Status section.')).toBeInTheDocument();
  });

  it('uses role="alert" for accessibility', () => {
    render(
      <RiskWarningBanner
        warnings={[
          {
            code: 'PRICE_DATA_MISSING',
            reason: 'BTC price data is missing.',
            recommendedAction: 'Set a price.',
          },
        ]}
      />,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renders multiple simultaneous warnings', () => {
    render(
      <RiskWarningBanner
        warnings={[
          { code: 'A', reason: 'Reason A', recommendedAction: 'Action A' },
          { code: 'B', reason: 'Reason B', recommendedAction: 'Action B' },
        ]}
      />,
    );
    expect(screen.getByText('Reason A')).toBeInTheDocument();
    expect(screen.getByText('Reason B')).toBeInTheDocument();
  });
});

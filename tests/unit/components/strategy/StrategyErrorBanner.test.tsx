import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { StrategyErrorBanner } from '@/components/strategy/StrategyErrorBanner';
import type { ApplicationError } from '@/services';
import type { Portfolio } from '@/types/portfolio';

/**
 * Shared Strategy Error Banner — 06_TASKS.md M7-038 ("Implement
 * Strategy Error Recovery"). Include: "Retry, Restore last valid
 * result, Return to portfolio, Edit assumptions, Export recovery copy
 * where applicable."
 */
const PORTFOLIO: Portfolio = {
  id: 'portfolio-1',
  name: 'Test Portfolio',
  baseCurrency: 'USD',
  collateral: { asset: 'BTC', quantity: 2 },
  debt: { asset: 'USDC', balance: 20000 },
  market: { btcPriceUsd: 50000 },
  protocol: { maxLoanToValue: 0.75, liquidationThreshold: 0.8, borrowApr: 0.05, supplyApr: 0.02 },
  settings: {},
  archivedAt: null,
  marketUpdatedAt: '2026-01-01T00:00:00.000Z',
  protocolUpdatedAt: '2026-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const ERRORS: ApplicationError[] = [
  {
    category: 'calculation',
    code: 'ZERO_COLLATERAL',
    message: 'Debt exists with zero effective collateral.',
  },
];

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('StrategyErrorBanner', () => {
  it('announces the failure as a real, live-region alert', () => {
    render(
      <StrategyErrorBanner errors={ERRORS} portfolio={PORTFOLIO} retryHint="Adjust your inputs." />,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('shows every real error message and code, not a generic string', () => {
    render(
      <StrategyErrorBanner errors={ERRORS} portfolio={PORTFOLIO} retryHint="Adjust your inputs." />,
    );
    expect(screen.getByText('Debt exists with zero effective collateral.')).toBeInTheDocument();
    expect(screen.getByText(/ZERO_COLLATERAL/)).toBeInTheDocument();
  });

  it('shows the caller-supplied retry hint — no generic "Retry" button, matching the live-recalculation design', () => {
    render(
      <StrategyErrorBanner
        errors={ERRORS}
        portfolio={PORTFOLIO}
        retryHint="Adjust your exit target to try again."
      />,
    );
    expect(screen.getByText(/Adjust your exit target to try again\./)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  it('links back to the Portfolio page', () => {
    render(
      <StrategyErrorBanner errors={ERRORS} portfolio={PORTFOLIO} retryHint="Adjust your inputs." />,
    );
    expect(screen.getByRole('link', { name: /Return to Portfolio/ })).toHaveAttribute(
      'href',
      '/portfolio',
    );
  });

  it('downloads a real portfolio recovery copy when clicked', async () => {
    const user = userEvent.setup();
    render(
      <StrategyErrorBanner errors={ERRORS} portfolio={PORTFOLIO} retryHint="Adjust your inputs." />,
    );

    const click = vi.fn();
    const realCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = realCreateElement(tagName);
      if (tagName === 'a') element.click = click;
      return element;
    });
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:mock-url');
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL: vi.fn() });

    await user.click(screen.getByRole('button', { name: 'Download recovery copy' }));

    expect(click).toHaveBeenCalledTimes(1);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    const text = await blob.text();
    const parsed = JSON.parse(text);
    expect(parsed.portfolio.id).toBe('portfolio-1');
  });

  it('renders every error when more than one is present', () => {
    const multipleErrors: ApplicationError[] = [
      ...ERRORS,
      { category: 'validation', code: 'OTHER', message: 'A second, distinct error.' },
    ];
    render(
      <StrategyErrorBanner
        errors={multipleErrors}
        portfolio={PORTFOLIO}
        retryHint="Adjust your inputs."
      />,
    );
    expect(screen.getByText('Debt exists with zero effective collateral.')).toBeInTheDocument();
    expect(screen.getByText('A second, distinct error.')).toBeInTheDocument();
  });
});

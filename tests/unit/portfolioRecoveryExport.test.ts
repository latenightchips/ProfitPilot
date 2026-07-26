import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Portfolio } from '@/types/portfolio';
import {
  buildPortfolioRecoveryCopy,
  downloadPortfolioRecoveryCopy,
  PORTFOLIO_RECOVERY_SCHEMA_VERSION,
} from '@/utils/portfolioRecoveryExport';

/**
 * Portfolio recovery copy export — 06_TASKS.md M4-017 ("Export recovery
 * copy where possible").
 */
function samplePortfolio(): Portfolio {
  return {
    id: 'portfolio-1',
    name: 'My Portfolio',
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
}

describe('buildPortfolioRecoveryCopy', () => {
  it('includes the schema version, a valid export timestamp, and the portfolio itself unchanged', () => {
    const portfolio = samplePortfolio();
    const copy = buildPortfolioRecoveryCopy(portfolio);

    expect(copy.schemaVersion).toBe(PORTFOLIO_RECOVERY_SCHEMA_VERSION);
    expect(copy.portfolio).toEqual(portfolio);
    expect(Number.isNaN(Date.parse(copy.exportedAt))).toBe(false);
  });
});

describe('downloadPortfolioRecoveryCopy', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('creates a Blob URL, clicks a temporary anchor named after the portfolio id, and revokes the URL', () => {
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:mock-url');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });

    const click = vi.fn();
    const realCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = realCreateElement(tagName);
      if (tagName === 'a') element.click = click;
      return element;
    });

    downloadPortfolioRecoveryCopy(samplePortfolio());

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const [blobArg] = createObjectURL.mock.calls[0];
    expect(blobArg.type).toBe('application/json');
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('names the downloaded file after the portfolio id', () => {
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:mock-url'),
      revokeObjectURL: vi.fn(),
    });
    const realCreateElement = document.createElement.bind(document);
    let anchor: HTMLAnchorElement | undefined;
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = realCreateElement(tagName);
      if (tagName === 'a') {
        element.click = vi.fn();
        anchor = element as HTMLAnchorElement;
      }
      return element;
    });

    downloadPortfolioRecoveryCopy(samplePortfolio());

    expect(anchor?.download).toBe('portfolio-portfolio-1-recovery.json');
  });
});

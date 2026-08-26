import { describe, expect, it } from 'vitest';

import type { ApplicationPortfolio } from '@/services/portfolio/models';
import { resolveExportProvenance } from '@/services/shared/exportProvenance';

const NOW = '2026-08-25T12:00:00.000Z';

const BASE_PORTFOLIO: ApplicationPortfolio = {
  collateral: { asset: 'BTC', quantity: 1 },
  debt: { asset: 'USDC', balance: 10000 },
  market: { btcPriceUsd: 60000 },
  protocol: {
    maxLoanToValue: 0.7,
    liquidationThreshold: 0.8,
    borrowApr: 0.05,
    supplyApr: 0.02,
  },
};

/**
 * `resolveExportProvenance` — V4 Readiness Audit §12 P2-1. The single
 * shared provenance resolver every exporter calls; see its own header
 * comment in `services/shared/exportProvenance.ts` for the full reasoning.
 */
describe('resolveExportProvenance (P2-1)', () => {
  it('reports v3 provenance with every V4 field null, for a portfolio with no protocolVersion set', () => {
    const provenance = resolveExportProvenance(BASE_PORTFOLIO, NOW);
    expect(provenance).toEqual({
      protocolVersion: 'v3',
      v4DebtStateSource: null,
      v4CollateralRiskSource: null,
      v4DebtStateUpdatedAt: null,
      v4CollateralRiskUpdatedAt: null,
      v4DataStaleAtExport: null,
    });
  });

  it('reports v3 provenance explicitly, ignoring stray V4 fields, when protocolVersion is "v3"', () => {
    const provenance = resolveExportProvenance({ ...BASE_PORTFOLIO, protocolVersion: 'v3' }, NOW);
    expect(provenance.protocolVersion).toBe('v3');
    expect(provenance.v4DataStaleAtExport).toBeNull();
  });

  it('identifies manual V4 provenance for a manually-entered dimension', () => {
    const provenance = resolveExportProvenance(
      {
        ...BASE_PORTFOLIO,
        protocolVersion: 'v4',
        v4DebtStateSource: 'manual',
        v4DebtStateUpdatedAt: '2026-08-25T11:00:00.000Z',
      },
      NOW,
    );
    expect(provenance.protocolVersion).toBe('v4');
    expect(provenance.v4DebtStateSource).toBe('manual');
    expect(provenance.v4DebtStateUpdatedAt).toBe('2026-08-25T11:00:00.000Z');
  });

  it('identifies live V4 provenance for a live-synced dimension', () => {
    const provenance = resolveExportProvenance(
      {
        ...BASE_PORTFOLIO,
        protocolVersion: 'v4',
        v4DebtStateSource: 'live',
        v4DebtStateUpdatedAt: '2026-08-25T11:59:00.000Z',
      },
      NOW,
    );
    expect(provenance.v4DebtStateSource).toBe('live');
  });

  it('exports the freshness timestamp when known', () => {
    const provenance = resolveExportProvenance(
      {
        ...BASE_PORTFOLIO,
        protocolVersion: 'v4',
        v4DebtStateSource: 'live',
        v4DebtStateUpdatedAt: '2026-08-25T11:59:00.000Z',
      },
      NOW,
    );
    expect(provenance.v4DebtStateUpdatedAt).toBe('2026-08-25T11:59:00.000Z');
  });

  it('exports unknown freshness honestly as null when no V4 dimension is live-sourced', () => {
    const provenance = resolveExportProvenance({ ...BASE_PORTFOLIO, protocolVersion: 'v4' }, NOW);
    expect(provenance.v4DebtStateUpdatedAt).toBeNull();
    expect(provenance.v4DataStaleAtExport).toBeNull();
  });

  it('reports v4DataStaleAtExport = false for a live dimension updated well within the freshness threshold', () => {
    const provenance = resolveExportProvenance(
      {
        ...BASE_PORTFOLIO,
        protocolVersion: 'v4',
        v4DebtStateSource: 'live',
        v4DebtStateUpdatedAt: '2026-08-25T11:59:30.000Z',
        v4CollateralRiskSource: 'live',
        v4CollateralRiskUpdatedAt: '2026-08-25T11:59:30.000Z',
      },
      NOW,
    );
    expect(provenance.v4DataStaleAtExport).toBe(false);
  });

  it('reports v4DataStaleAtExport = true for a live dimension updated well past the freshness threshold', () => {
    const provenance = resolveExportProvenance(
      {
        ...BASE_PORTFOLIO,
        protocolVersion: 'v4',
        v4DebtStateSource: 'live',
        v4DebtStateUpdatedAt: '2026-08-25T00:00:00.000Z',
      },
      NOW,
    );
    expect(provenance.v4DataStaleAtExport).toBe(true);
  });

  it('does not misrepresent a stale/error state as fresh — worse-of-two across both live dimensions', () => {
    const provenance = resolveExportProvenance(
      {
        ...BASE_PORTFOLIO,
        protocolVersion: 'v4',
        v4DebtStateSource: 'live',
        v4DebtStateUpdatedAt: '2026-08-25T11:59:30.000Z',
        v4CollateralRiskSource: 'live',
        v4CollateralRiskUpdatedAt: '2026-08-25T00:00:00.000Z',
      },
      NOW,
    );
    expect(provenance.v4DataStaleAtExport).toBe(true);
  });

  it('excludes a manual dimension from staleness even when its timestamp is old', () => {
    const provenance = resolveExportProvenance(
      {
        ...BASE_PORTFOLIO,
        protocolVersion: 'v4',
        v4DebtStateSource: 'manual',
        v4DebtStateUpdatedAt: '2020-01-01T00:00:00.000Z',
      },
      NOW,
    );
    expect(provenance.v4DataStaleAtExport).toBeNull();
  });
});

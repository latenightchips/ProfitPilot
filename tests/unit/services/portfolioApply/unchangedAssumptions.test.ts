import { describe, expect, it } from 'vitest';

import { unchangedAssumptionsFor } from '@/services/portfolioApply/unchangedAssumptions';

/**
 * `unchangedAssumptionsFor` — Supply APR Semantic-Boundary Fix follow-up
 * (batch A2). Before this fix, the V4 branch inherited the V3-oriented
 * "Protocol interest rates (borrow/supply APR)" line verbatim, even
 * though `protocol.supplyApr` is never a genuine V4 concept (see
 * `resolveSupplyAprDisplay`'s own doc comment, `services/portfolio/mapping.ts`).
 * These tests pin the corrected behavior directly against the real
 * function, rather than only indirectly through the two proposal
 * builders' own tests.
 */
describe('unchangedAssumptionsFor — V3', () => {
  it('keeps the existing "Protocol interest rates (borrow/supply APR)" wording, byte-for-byte', () => {
    expect(unchangedAssumptionsFor('v3')).toEqual([
      'Market price',
      'Protocol interest rates (borrow/supply APR)',
      'Loan-to-value and liquidation-threshold parameters',
    ]);
  });
});

describe('unchangedAssumptionsFor — V4 (Supply APR Semantic-Boundary Fix follow-up, batch A2)', () => {
  it('never mentions "supply APR" or "Supply APR"', () => {
    const assumptions = unchangedAssumptionsFor('v4');
    const joined = assumptions.join(' ');
    expect(joined).not.toMatch(/supply APR/i);
  });

  it('names the real V4 borrow-rate assumption instead — base drawn APR and risk premium', () => {
    expect(unchangedAssumptionsFor('v4')).toContain('Aave V4 base drawn APR and risk premium');
  });

  it('leaves the other two V4-specific unchanged assumptions untouched', () => {
    const assumptions = unchangedAssumptionsFor('v4');
    expect(assumptions).toContain('Aave V4 collateral-risk configuration');
    expect(assumptions).toContain('Aave V4 on-chain position identity');
  });

  it('leaves "Market price" as the first item, matching V3', () => {
    expect(unchangedAssumptionsFor('v4')[0]).toBe('Market price');
  });

  it('returns exactly the 4 expected items, in order, for V4', () => {
    expect(unchangedAssumptionsFor('v4')).toEqual([
      'Market price',
      'Aave V4 base drawn APR and risk premium',
      'Aave V4 collateral-risk configuration',
      'Aave V4 on-chain position identity',
    ]);
  });
});

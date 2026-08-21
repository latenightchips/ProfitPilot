import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { ManualAaveV4StateForm } from '@/app/portfolio/ManualAaveV4StateForm';
import { usePortfolioStore } from '@/stores/portfolioStore';

/**
 * Manual/Hypothetical Aave V4 entry — BLOCKER #4 fix (stale external-state
 * synchronization). See `ManualAaveV4StateForm.tsx`'s own header comment
 * for the full reproduced root cause and the `lastSynced`/`reset(...)`
 * pattern reused here, mirrored verbatim from `PortfolioPageClient.tsx`'s
 * own `DebtPositionForm` (Stage 25A).
 *
 * This component reads `portfolio` from a prop, not reactively from
 * `usePortfolioStore` itself — an "external update" is therefore
 * simulated the same way the real page produces one: the Store record is
 * mutated directly (via the same actions a sibling form would call), then
 * this component is re-rendered with the fresh `portfolio` object, never
 * remounted (no `key` change) — exactly mirroring how `AaveProtocolVersionForm`/
 * `PortfolioPageClient` pass the reactively-updated record down in the
 * real app.
 */
const INITIAL_STATE = {
  portfolios: {},
  activePortfolioId: null,
  loadStatus: 'idle' as const,
  saveStatus: 'idle' as const,
  errors: [],
  lastSynchronizedAt: null,
};

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    name: 'My Portfolio',
    baseCurrency: 'USD',
    collateral: { asset: 'BTC', quantity: 2 },
    debt: { asset: 'USDC', balance: 20000 },
    market: { btcPriceUsd: 50000 },
    protocol: {
      maxLoanToValue: 0.75,
      liquidationThreshold: 0.8,
      borrowApr: 0.05,
      supplyApr: 0.02,
    },
    settings: {},
    ...overrides,
  };
}

function createManualV4Portfolio(): string {
  const created = usePortfolioStore.getState().create(validInput());
  if (!created.ok) throw new Error('setup failed');
  usePortfolioStore.getState().select(created.data.id);
  usePortfolioStore.getState().setProtocolVersion(created.data.id, 'v4');
  return created.data.id;
}

function currentPortfolio(id: string) {
  return usePortfolioStore.getState().portfolios[id].portfolio;
}

beforeEach(() => {
  usePortfolioStore.setState(INITIAL_STATE);
});

describe('ManualDebtStateForm — resyncs to a canonical v4DebtState change (BLOCKER #4 fix)', () => {
  it('reflects an external v4DebtState update in the displayed fields, with no remount', () => {
    const id = createManualV4Portfolio();
    usePortfolioStore
      .getState()
      .setAaveV4DebtState(
        id,
        { drawnDebt: 15000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.01 },
        'manual',
      );
    const { rerender } = render(
      <ManualAaveV4StateForm portfolioId={id} portfolio={currentPortfolio(id)} />,
    );
    expect(screen.getByLabelText('Drawn debt', { exact: false })).toHaveValue(15000);

    // Simulates DebtPositionForm (or any other sibling form) applying a
    // change on this same page — not a save made through THIS form.
    act(() => {
      usePortfolioStore
        .getState()
        .setAaveV4DebtState(
          id,
          { drawnDebt: 8000, premiumDebt: 200, baseDrawnApr: 0.07, riskPremium: 0.03 },
          'manual',
        );
    });
    rerender(<ManualAaveV4StateForm portfolioId={id} portfolio={currentPortfolio(id)} />);

    expect(screen.getByLabelText('Drawn debt', { exact: false })).toHaveValue(8000);
    expect(screen.getByLabelText('Premium debt', { exact: false })).toHaveValue(200);
    expect(
      Number(
        (screen.getByLabelText('Base drawn APR (%)', { exact: false }) as HTMLInputElement).value,
      ),
    ).toBeCloseTo(7, 6);
    expect(
      Number(
        (screen.getByLabelText('Risk premium (%)', { exact: false }) as HTMLInputElement).value,
      ),
    ).toBeCloseTo(3, 6);
  });

  it('editing and saving only an unrelated field after an external update does not revert the externally-updated drawn/premium debt (reported failure mode)', async () => {
    const id = createManualV4Portfolio();
    usePortfolioStore
      .getState()
      .setAaveV4DebtState(
        id,
        { drawnDebt: 15000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.01 },
        'manual',
      );
    const user = userEvent.setup();
    const { rerender } = render(
      <ManualAaveV4StateForm portfolioId={id} portfolio={currentPortfolio(id)} />,
    );

    act(() => {
      usePortfolioStore
        .getState()
        .setAaveV4DebtState(
          id,
          { drawnDebt: 8000, premiumDebt: 200, baseDrawnApr: 0.07, riskPremium: 0.03 },
          'manual',
        );
    });
    rerender(<ManualAaveV4StateForm portfolioId={id} portfolio={currentPortfolio(id)} />);

    // The user only ever edits Risk premium — an unrelated field relative
    // to Drawn debt/Premium debt/Base drawn APR.
    const riskPremiumInput = screen.getByLabelText('Risk premium (%)', { exact: false });
    await user.clear(riskPremiumInput);
    await user.type(riskPremiumInput, '9');
    await user.click(screen.getByRole('button', { name: 'Save debt assumptions' }));

    const saved = currentPortfolio(id).v4DebtState;
    // Without the fix, Drawn debt/Premium debt/Base drawn APR would be
    // silently resubmitted from the STALE 15000/500/0.05 seeded at mount,
    // reverting the external update the moment this save button is
    // clicked.
    expect(saved?.drawnDebt).toBe(8000);
    expect(saved?.premiumDebt).toBe(200);
    expect(saved?.baseDrawnApr).toBeCloseTo(0.07, 10);
    expect(saved?.riskPremium).toBeCloseTo(0.09, 10);
  });

  it('a successful save clears dirty state so a LATER external update can still resync (not permanently stuck dirty after the first save)', async () => {
    const id = createManualV4Portfolio();
    usePortfolioStore
      .getState()
      .setAaveV4DebtState(
        id,
        { drawnDebt: 15000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.01 },
        'manual',
      );
    const user = userEvent.setup();
    const { rerender } = render(
      <ManualAaveV4StateForm portfolioId={id} portfolio={currentPortfolio(id)} />,
    );

    // A real user edit, submitted successfully — this dirties, then
    // (via the fix's own reset()) un-dirties the form.
    const riskPremiumInput = screen.getByLabelText('Risk premium (%)', { exact: false });
    await user.clear(riskPremiumInput);
    await user.type(riskPremiumInput, '2');
    await user.click(screen.getByRole('button', { name: 'Save debt assumptions' }));
    rerender(<ManualAaveV4StateForm portfolioId={id} portfolio={currentPortfolio(id)} />);

    // A SECOND, later external update — e.g. DebtPositionForm applying a
    // repayment sometime after this form's own save.
    act(() => {
      usePortfolioStore
        .getState()
        .setAaveV4DebtState(
          id,
          { drawnDebt: 3000, premiumDebt: 100, baseDrawnApr: 0.11, riskPremium: 0.06 },
          'manual',
        );
    });
    rerender(<ManualAaveV4StateForm portfolioId={id} portfolio={currentPortfolio(id)} />);

    // Without clearing dirty state after the first save, this form would
    // stay permanently "dirty" and never pick up this second change.
    expect(screen.getByLabelText('Drawn debt', { exact: false })).toHaveValue(3000);
    expect(screen.getByLabelText('Premium debt', { exact: false })).toHaveValue(100);
  });

  it('a debt field edit survives a rerender that does not change v4DebtState (unrelated portfolio update, e.g. renaming)', async () => {
    const id = createManualV4Portfolio();
    usePortfolioStore
      .getState()
      .setAaveV4DebtState(
        id,
        { drawnDebt: 15000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.01 },
        'manual',
      );
    const user = userEvent.setup();
    const { rerender } = render(
      <ManualAaveV4StateForm portfolioId={id} portfolio={currentPortfolio(id)} />,
    );

    const drawnDebtInput = screen.getByLabelText('Drawn debt', { exact: false });
    await user.clear(drawnDebtInput);
    await user.type(drawnDebtInput, '9999');
    expect(drawnDebtInput).toHaveValue(9999);

    // `update()` spreads `v4DebtState` from the existing record unchanged
    // (same object reference) — this rerender must not trigger a resync.
    act(() => {
      usePortfolioStore.getState().update(id, { name: 'Renamed Portfolio' });
    });
    rerender(<ManualAaveV4StateForm portfolioId={id} portfolio={currentPortfolio(id)} />);

    expect(screen.getByLabelText('Drawn debt', { exact: false })).toHaveValue(9999);
  });
});

describe('ManualCollateralFactorForm — resyncs to a canonical v4CollateralRisk change (BLOCKER #4 fix)', () => {
  it('reflects an external v4CollateralRisk update in the displayed field, with no remount', () => {
    const id = createManualV4Portfolio();
    usePortfolioStore
      .getState()
      .setAaveV4CollateralRisk(id, { collateralFactor: 0.5, dynamicConfigKey: 1 }, 'manual');
    const { rerender } = render(
      <ManualAaveV4StateForm portfolioId={id} portfolio={currentPortfolio(id)} />,
    );
    expect(screen.getByLabelText('Collateral factor (%)', { exact: false })).toHaveValue(50);

    act(() => {
      usePortfolioStore
        .getState()
        .setAaveV4CollateralRisk(id, { collateralFactor: 0.72, dynamicConfigKey: 2 }, 'manual');
    });
    rerender(<ManualAaveV4StateForm portfolioId={id} portfolio={currentPortfolio(id)} />);

    expect(screen.getByLabelText('Collateral factor (%)', { exact: false })).toHaveValue(72);
  });

  it('saving after an external update does not restore the old collateral factor', async () => {
    const id = createManualV4Portfolio();
    usePortfolioStore
      .getState()
      .setAaveV4CollateralRisk(id, { collateralFactor: 0.5, dynamicConfigKey: 1 }, 'manual');
    const user = userEvent.setup();
    const { rerender } = render(
      <ManualAaveV4StateForm portfolioId={id} portfolio={currentPortfolio(id)} />,
    );

    act(() => {
      usePortfolioStore
        .getState()
        .setAaveV4CollateralRisk(id, { collateralFactor: 0.72, dynamicConfigKey: 2 }, 'manual');
    });
    rerender(<ManualAaveV4StateForm portfolioId={id} portfolio={currentPortfolio(id)} />);

    await user.click(screen.getByRole('button', { name: 'Save collateral risk assumption' }));

    // Without the fix, this would silently resubmit the STALE 0.5 seeded
    // at mount, reverting the external update.
    expect(currentPortfolio(id).v4CollateralRisk?.collateralFactor).toBeCloseTo(0.72, 10);
  });

  it('a collateral-factor edit survives a rerender that does not change v4CollateralRisk (unrelated portfolio update)', async () => {
    const id = createManualV4Portfolio();
    usePortfolioStore
      .getState()
      .setAaveV4CollateralRisk(id, { collateralFactor: 0.5, dynamicConfigKey: 1 }, 'manual');
    const user = userEvent.setup();
    const { rerender } = render(
      <ManualAaveV4StateForm portfolioId={id} portfolio={currentPortfolio(id)} />,
    );

    const collateralFactorInput = screen.getByLabelText('Collateral factor (%)', {
      exact: false,
    });
    await user.clear(collateralFactorInput);
    await user.type(collateralFactorInput, '61');
    expect(collateralFactorInput).toHaveValue(61);

    act(() => {
      usePortfolioStore.getState().update(id, { name: 'Renamed Portfolio' });
    });
    rerender(<ManualAaveV4StateForm portfolioId={id} portfolio={currentPortfolio(id)} />);

    expect(screen.getByLabelText('Collateral factor (%)', { exact: false })).toHaveValue(61);
  });
});

/**
 * V3 unaffected — this component has no `protocolVersion` branch of its
 * own; `AaveProtocolVersionForm.tsx` (unmodified by this fix) is the sole
 * place that decides whether to mount it at all
 * (`{version === 'v4' && <ManualAaveV4StateForm ... />}`). This confirms
 * the component itself stays a safe, inert no-op for a V3-shaped
 * portfolio if it were ever rendered directly, rather than assuming its
 * caller's gating alone is sufficient.
 */
describe('ManualAaveV4StateForm — V3-shaped portfolio (gating lives in AaveProtocolVersionForm, unmodified)', () => {
  it('renders safely with default (0) values for a portfolio with no v4DebtState/v4CollateralRisk', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);

    render(
      <ManualAaveV4StateForm
        portfolioId={created.data.id}
        portfolio={currentPortfolio(created.data.id)}
      />,
    );

    expect(screen.getByLabelText('Drawn debt', { exact: false })).toHaveValue(0);
    expect(screen.getByLabelText('Collateral factor (%)', { exact: false })).toHaveValue(0);
  });
});

import { beforeEach, describe, expect, it } from 'vitest';

import { autoSaveCoordinator, persistenceService, SINGLETON_RECORD_ID } from '@/services';
import type { AcknowledgementsByPortfolio } from '@/stores/recommendationCenterStore';
import { useRecommendationCenterStore } from '@/stores/recommendationCenterStore';
import type { Portfolio } from '@/types/portfolio';

/**
 * Recommendation Center Store — 06_TASKS.md M7-032/M7-035/M7-036.
 */
const INITIAL_STATE = {
  status: 'idle' as const,
  portfolioId: null,
  targetHealthFactor: null,
  actions: null,
  errors: [],
  lastMetadata: null,
  categoryFilter: 'all' as const,
  selectedItemId: null,
  acknowledgements: {},
};

beforeEach(() => {
  useRecommendationCenterStore.setState(INITIAL_STATE);
  window.localStorage.clear();
});

function portfolioFixture(overrides: Partial<Portfolio> = {}): Portfolio {
  return {
    id: 'portfolio-1',
    name: 'Test Portfolio',
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
    settings: { safetyTargets: { targetHealthFactor: 8 } },
    archivedAt: null,
    marketUpdatedAt: '2026-01-01T00:00:00.000Z',
    protocolUpdatedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('recalculate — no target configured', () => {
  it('sets status to noTarget when settings.safetyTargets.targetHealthFactor is absent', () => {
    useRecommendationCenterStore.getState().recalculate(portfolioFixture({ settings: {} }));

    const state = useRecommendationCenterStore.getState();
    expect(state.status).toBe('noTarget');
    expect(state.actions).toBeNull();
    expect(state.targetHealthFactor).toBeNull();
  });
});

describe('recalculate — a real target', () => {
  it('computes real, non-fabricated repayment and additional-collateral recommendations', () => {
    useRecommendationCenterStore.getState().recalculate(portfolioFixture());

    const state = useRecommendationCenterStore.getState();
    expect(state.status).toBe('ready');
    expect(state.actions).not.toBeNull();
    // Target HF 8, current collateral $100,000 @ 0.8 threshold, debt $20,000.
    expect(state.actions?.repayment.relevantValues.requiredRepayment).toBe(10000);
    expect(state.actions?.additionalCollateral.relevantValues.requiredUsd).toBe(100000);
    expect(state.lastMetadata).not.toBeNull();
    expect(state.errors).toEqual([]);
  });

  it('reports a real, non-fabricated "no action needed" result when the target already matches the current Health Factor', () => {
    useRecommendationCenterStore
      .getState()
      .recalculate(portfolioFixture({ settings: { safetyTargets: { targetHealthFactor: 4 } } }));

    const state = useRecommendationCenterStore.getState();
    expect(state.status).toBe('ready');
    expect(state.actions?.repayment.relevantValues.requiredRepayment).toBe(0);
    expect(state.actions?.additionalCollateral.relevantValues.requiredUsd).toBe(0);
  });

  it('sets status to error on a genuine Engine failure (negative collateral quantity)', () => {
    useRecommendationCenterStore
      .getState()
      .recalculate(portfolioFixture({ collateral: { asset: 'BTC', quantity: -1 } }));

    const state = useRecommendationCenterStore.getState();
    expect(state.status).toBe('error');
    expect(state.actions).toBeNull();
    expect(state.errors.length).toBeGreaterThan(0);
  });

  it('preserves a real prior valid result for the same portfolio across a subsequent failure (M7-038 "Restore last valid result")', () => {
    useRecommendationCenterStore.getState().recalculate(portfolioFixture());
    const validState = useRecommendationCenterStore.getState();
    expect(validState.actions).not.toBeNull();

    useRecommendationCenterStore
      .getState()
      .recalculate(portfolioFixture({ collateral: { asset: 'BTC', quantity: -1 } }));

    const state = useRecommendationCenterStore.getState();
    expect(state.status).toBe('error');
    expect(state.errors.length).toBeGreaterThan(0);
    expect(state.actions).toEqual(validState.actions);
  });

  it('clears actions when a failure follows a switch to a different, already-broken portfolio', () => {
    useRecommendationCenterStore.getState().recalculate(portfolioFixture());
    expect(useRecommendationCenterStore.getState().actions).not.toBeNull();

    useRecommendationCenterStore.getState().recalculate(
      portfolioFixture({
        id: 'portfolio-2',
        collateral: { asset: 'BTC', quantity: -1 },
      }),
    );

    const state = useRecommendationCenterStore.getState();
    expect(state.status).toBe('error');
    expect(state.portfolioId).toBe('portfolio-2');
    expect(state.actions).toBeNull();
  });
});

describe('setCategoryFilter / selectItem', () => {
  it('sets the category filter', () => {
    useRecommendationCenterStore.getState().setCategoryFilter('debt');
    expect(useRecommendationCenterStore.getState().categoryFilter).toBe('debt');
  });

  it('sets and clears the selected item', () => {
    useRecommendationCenterStore.getState().selectItem('repayment');
    expect(useRecommendationCenterStore.getState().selectedItemId).toBe('repayment');

    useRecommendationCenterStore.getState().selectItem(null);
    expect(useRecommendationCenterStore.getState().selectedItemId).toBeNull();
  });

  it('clears the selected item when the active portfolio switches', () => {
    useRecommendationCenterStore.getState().recalculate(portfolioFixture({ id: 'portfolio-1' }));
    useRecommendationCenterStore.getState().selectItem('repayment');

    useRecommendationCenterStore.getState().recalculate(portfolioFixture({ id: 'portfolio-2' }));
    expect(useRecommendationCenterStore.getState().selectedItemId).toBeNull();
  });

  it('preserves the selected item when the same portfolio is merely recalculated', () => {
    useRecommendationCenterStore.getState().recalculate(portfolioFixture({ id: 'portfolio-1' }));
    useRecommendationCenterStore.getState().selectItem('additionalCollateral');

    useRecommendationCenterStore
      .getState()
      .recalculate(portfolioFixture({ id: 'portfolio-1', updatedAt: '2026-01-02T00:00:00.000Z' }));
    expect(useRecommendationCenterStore.getState().selectedItemId).toBe('additionalCollateral');
  });

  it('preserves the selected item when the same portfolio recalculates into noTarget (the target was removed)', () => {
    useRecommendationCenterStore.getState().recalculate(portfolioFixture({ id: 'portfolio-1' }));
    useRecommendationCenterStore.getState().selectItem('repayment');

    useRecommendationCenterStore
      .getState()
      .recalculate(portfolioFixture({ id: 'portfolio-1', settings: {} }));

    expect(useRecommendationCenterStore.getState().status).toBe('noTarget');
    expect(useRecommendationCenterStore.getState().selectedItemId).toBe('repayment');
  });

  it('preserves the selected item when the same portfolio recalculates into an error', () => {
    useRecommendationCenterStore.getState().recalculate(portfolioFixture({ id: 'portfolio-1' }));
    useRecommendationCenterStore.getState().selectItem('repayment');

    useRecommendationCenterStore
      .getState()
      .recalculate(
        portfolioFixture({ id: 'portfolio-1', collateral: { asset: 'BTC', quantity: -1 } }),
      );

    expect(useRecommendationCenterStore.getState().status).toBe('error');
    expect(useRecommendationCenterStore.getState().selectedItemId).toBe('repayment');
  });
});

describe('acknowledge / unacknowledge (M7-035)', () => {
  it('acknowledge does nothing before any recommendation has been computed', () => {
    useRecommendationCenterStore.getState().acknowledge('repayment');
    expect(useRecommendationCenterStore.getState().acknowledgements).toEqual({});
  });

  it('unacknowledge does nothing before any recommendation has been computed', () => {
    useRecommendationCenterStore.getState().unacknowledge('repayment');
    expect(useRecommendationCenterStore.getState().acknowledgements).toEqual({});
  });

  it('acknowledges an item, keyed per portfolio', () => {
    useRecommendationCenterStore.getState().recalculate(portfolioFixture());
    useRecommendationCenterStore.getState().acknowledge('repayment');

    const state = useRecommendationCenterStore.getState();
    expect(state.acknowledgements['portfolio-1']?.repayment).toEqual({
      currentDebt: 20000,
      targetDebt: 10000,
      targetHealthFactor: 8,
      requiredRepayment: 10000,
      estimatedBtcRequired: 0.2,
    });
  });

  it('un-acknowledges an item', () => {
    useRecommendationCenterStore.getState().recalculate(portfolioFixture());
    useRecommendationCenterStore.getState().acknowledge('repayment');
    useRecommendationCenterStore.getState().unacknowledge('repayment');

    expect(useRecommendationCenterStore.getState().acknowledgements['portfolio-1']).toEqual({});
  });

  it('un-acknowledging an item that was never acknowledged is a no-op', () => {
    useRecommendationCenterStore.getState().recalculate(portfolioFixture());
    useRecommendationCenterStore.getState().unacknowledge('repayment');

    expect(useRecommendationCenterStore.getState().acknowledgements).toEqual({});
  });

  it('keeps an acknowledgement across a recalculation whose relevantValues are unchanged', () => {
    useRecommendationCenterStore.getState().recalculate(portfolioFixture());
    useRecommendationCenterStore.getState().acknowledge('repayment');

    // Recompute the exact same portfolio again (e.g. an unrelated re-render).
    useRecommendationCenterStore.getState().recalculate(portfolioFixture());

    expect(
      useRecommendationCenterStore.getState().acknowledgements['portfolio-1']?.repayment,
    ).toBeDefined();
  });

  it('drops an acknowledgement the moment its triggering condition materially changes (a real debt increase)', () => {
    useRecommendationCenterStore.getState().recalculate(portfolioFixture());
    useRecommendationCenterStore.getState().acknowledge('repayment');
    expect(
      useRecommendationCenterStore.getState().acknowledgements['portfolio-1']?.repayment,
    ).toBeDefined();

    // A real debt increase changes requiredRepayment (10000 -> 15000).
    useRecommendationCenterStore
      .getState()
      .recalculate(portfolioFixture({ debt: { asset: 'USDC', balance: 25000 } }));

    expect(
      useRecommendationCenterStore.getState().acknowledgements['portfolio-1']?.repayment,
    ).toBeUndefined();
  });

  it('drops both acknowledgements together when a shared input (debt) changes both computations at once', () => {
    // repayment and additionalCollateral both derive from the same
    // portfolio.debt/collateral/liquidationThreshold/targetHealthFactor —
    // a real debt change genuinely alters both `relevantValues` sets
    // simultaneously (targetDebt depends on collateral+threshold+target;
    // targetCollateralValue depends on debt+threshold+target), so both
    // acknowledgements are correctly invalidated together, not just one.
    useRecommendationCenterStore.getState().recalculate(portfolioFixture());
    useRecommendationCenterStore.getState().acknowledge('repayment');
    useRecommendationCenterStore.getState().acknowledge('additionalCollateral');

    useRecommendationCenterStore
      .getState()
      .recalculate(portfolioFixture({ debt: { asset: 'USDC', balance: 25000 } }));

    const state = useRecommendationCenterStore.getState();
    expect(state.acknowledgements['portfolio-1']?.repayment).toBeUndefined();
    expect(state.acknowledgements['portfolio-1']?.additionalCollateral).toBeUndefined();
  });

  it('preserves an acknowledgement of one item across a change that leaves its own relevantValues untouched (a protocol field neither recommendation reads)', () => {
    // Neither calculateRepaymentRecommendation nor
    // calculateAdditionalCollateralRecommendation reads borrowApr/
    // supplyApr/maxLoanToValue — only liquidationThreshold. Changing one
    // of the unread fields must not disturb an existing acknowledgement.
    useRecommendationCenterStore.getState().recalculate(portfolioFixture());
    useRecommendationCenterStore.getState().acknowledge('repayment');

    useRecommendationCenterStore.getState().recalculate(
      portfolioFixture({
        protocol: {
          maxLoanToValue: 0.75,
          liquidationThreshold: 0.8,
          borrowApr: 0.09,
          supplyApr: 0.02,
        },
      }),
    );

    expect(
      useRecommendationCenterStore.getState().acknowledgements['portfolio-1']?.repayment,
    ).toBeDefined();
  });

  it('keeps acknowledgements for other portfolios independent', () => {
    useRecommendationCenterStore.getState().recalculate(portfolioFixture({ id: 'portfolio-1' }));
    useRecommendationCenterStore.getState().acknowledge('repayment');

    useRecommendationCenterStore.getState().recalculate(portfolioFixture({ id: 'portfolio-2' }));
    expect(
      useRecommendationCenterStore.getState().acknowledgements['portfolio-1']?.repayment,
    ).toBeDefined();
    expect(
      useRecommendationCenterStore.getState().acknowledgements['portfolio-2']?.repayment,
    ).toBeUndefined();
  });
});

describe('local acknowledgements persistence (M8-009)', () => {
  it('acknowledge schedules a real local storage write, readable back through persistenceService', async () => {
    useRecommendationCenterStore.getState().recalculate(portfolioFixture());
    useRecommendationCenterStore.getState().acknowledge('repayment');

    await autoSaveCoordinator.flushAll();
    const stored = await persistenceService.read<AcknowledgementsByPortfolio>(
      'recommendationAcknowledgements',
      SINGLETON_RECORD_ID,
    );
    expect(stored.ok).toBe(true);
    if (!stored.ok || stored.data === null) return;
    expect(stored.data['portfolio-1']?.repayment).toBeDefined();
  });

  it('unacknowledge schedules an updated write reflecting the removal', async () => {
    useRecommendationCenterStore.getState().recalculate(portfolioFixture());
    useRecommendationCenterStore.getState().acknowledge('repayment');
    await autoSaveCoordinator.flushAll();

    useRecommendationCenterStore.getState().unacknowledge('repayment');
    await autoSaveCoordinator.flushAll();

    const stored = await persistenceService.read<AcknowledgementsByPortfolio>(
      'recommendationAcknowledgements',
      SINGLETON_RECORD_ID,
    );
    expect(stored.ok).toBe(true);
    if (!stored.ok || stored.data === null) return;
    expect(stored.data['portfolio-1']?.repayment).toBeUndefined();
  });

  it('a no-op recalculate (unchanged relevantValues) does not schedule a redundant write', async () => {
    useRecommendationCenterStore.getState().recalculate(portfolioFixture());
    useRecommendationCenterStore.getState().acknowledge('repayment');
    await autoSaveCoordinator.flushAll();

    // Recomputing the identical portfolio leaves reconcileAcknowledgements'
    // own reference unchanged — no new write should be scheduled, so the
    // coordinator's state for this key stays whatever it already settled to.
    const stateBefore = autoSaveCoordinator.getState(
      'recommendationAcknowledgements',
      SINGLETON_RECORD_ID,
    );
    useRecommendationCenterStore.getState().recalculate(portfolioFixture());
    expect(
      autoSaveCoordinator.getState('recommendationAcknowledgements', SINGLETON_RECORD_ID),
    ).toBe(stateBefore);
  });

  it('loadAcknowledgements hydrates acknowledgements from local storage, flushing first', async () => {
    useRecommendationCenterStore.getState().recalculate(portfolioFixture());
    useRecommendationCenterStore.getState().acknowledge('repayment');

    useRecommendationCenterStore.setState({ acknowledgements: {} });
    await useRecommendationCenterStore.getState().loadAcknowledgements();

    expect(
      useRecommendationCenterStore.getState().acknowledgements['portfolio-1']?.repayment,
    ).toBeDefined();
  });
});

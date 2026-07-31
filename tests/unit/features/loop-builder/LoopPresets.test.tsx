import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { LoopPresets } from '@/features/loop-builder';
import type { ApplicationPortfolio } from '@/services';
import { useLoopBuilderStore } from '@/stores/loopBuilderStore';

/**
 * Loop Presets — 06_TASKS.md M7-009. Requirements: "Presets must
 * expose their assumptions. Presets must not be described as
 * guaranteed-safe strategies." DoD: "Selecting a preset updates
 * editable controls without hiding any input."
 */
const INITIAL_STATE = {
  settings: null,
  currentResult: null,
  status: 'idle' as const,
  errors: [],
  warnings: [],
  lastMetadata: null,
  savedStrategies: [],
  selectedStrategyId: null,
};

function validPortfolio(): ApplicationPortfolio {
  return {
    collateral: { asset: 'BTC', quantity: 1 },
    debt: { asset: 'USDC', balance: 0 },
    market: { btcPriceUsd: 50000 },
    protocol: {
      maxLoanToValue: 0.5,
      liquidationThreshold: 0.8,
      borrowApr: 0.05,
      supplyApr: 0.02,
    },
  };
}

beforeEach(() => {
  useLoopBuilderStore.setState(INITIAL_STATE);
});

describe('LoopPresets — expose their assumptions (Requirement)', () => {
  it('shows each preset own loop count and minimum Health Factor directly on the button', () => {
    render(
      <LoopPresets portfolio={validPortfolio()} maxLoanToValue={0.5} borrowRateAssumption={0.05} />,
    );
    expect(screen.getByText('2 loops · min HF 2.20')).toBeInTheDocument();
    expect(screen.getByText('3 loops · min HF 1.80')).toBeInTheDocument();
    expect(screen.getByText('5 loops · min HF 1.50')).toBeInTheDocument();
  });
});

describe('LoopPresets — not described as guaranteed-safe (Requirement)', () => {
  it('explicitly disclaims "guaranteed-safe," never affirms it, and never uses "risk-free"', () => {
    render(
      <LoopPresets portfolio={validPortfolio()} maxLoanToValue={0.5} borrowRateAssumption={0.05} />,
    );
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/risk-free/i);
    // The only occurrence of "guaranteed-safe" must be explicitly negated ("not guaranteed-safe"), never an affirmative claim.
    expect(text).toMatch(/not guaranteed-safe/i);
    expect((text.match(/guaranteed-safe/gi) ?? []).length).toBe(1);
  });

  it('shows a disclaimer directing users to the Safety Analysis before relying on a preset', () => {
    render(
      <LoopPresets portfolio={validPortfolio()} maxLoanToValue={0.5} borrowRateAssumption={0.05} />,
    );
    expect(screen.getByText(/review the Safety Analysis/i)).toBeInTheDocument();
  });
});

describe('LoopPresets — selecting a preset (DoD)', () => {
  it('applies the exact preset values to the Store and runs a real calculation', async () => {
    const user = userEvent.setup();
    render(
      <LoopPresets portfolio={validPortfolio()} maxLoanToValue={0.5} borrowRateAssumption={0.05} />,
    );

    await user.click(screen.getByRole('button', { name: /Conservative/ }));

    const state = useLoopBuilderStore.getState();
    expect(state.settings).toEqual({
      targetBorrowPercentage: 0.3,
      maxLoops: 2,
      minHealthFactor: 2.2,
      maxLoanToValueOverride: 0.5,
      borrowAprOverride: 0.05,
    });
    expect(state.currentResult).not.toBeNull();
  });

  it('shows "Custom" before any preset is selected', () => {
    render(
      <LoopPresets portfolio={validPortfolio()} maxLoanToValue={0.5} borrowRateAssumption={0.05} />,
    );
    expect(screen.getByText(/Strategy Presets/).textContent).toContain('Custom');
  });

  it('shows the matching preset name once its exact values are active', async () => {
    const user = userEvent.setup();
    render(
      <LoopPresets portfolio={validPortfolio()} maxLoanToValue={0.5} borrowRateAssumption={0.05} />,
    );
    await user.click(screen.getByRole('button', { name: /Aggressive/ }));
    expect(screen.getByText(/Strategy Presets/).textContent).toContain('Aggressive');
  });
});

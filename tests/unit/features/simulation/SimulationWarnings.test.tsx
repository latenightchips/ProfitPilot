import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { SimulationWarnings } from '@/features/simulation';
import { usePortfolioStore } from '@/stores/portfolioStore';
import { useSimulationStore } from '@/stores/simulationStore';
import type { Portfolio } from '@/types/portfolio';

/**
 * Simulation Warnings — 06_TASKS.md M6-014 ("Implement Simulation
 * Warnings"). DoD: "Warnings explain both the cause and potential
 * impact." Every assertion below checks a value the real
 * `buildSimulationWarnings` (driven by the real Store) actually
 * computed, never a hand-crafted mock result.
 */
beforeEach(() => {
  usePortfolioStore.setState({
    portfolios: {},
    activePortfolioId: null,
    loadStatus: 'idle',
    saveStatus: 'idle',
    errors: [],
    lastSynchronizedAt: null,
  });
  useSimulationStore.getState().reset();
});

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

function createPortfolio(overrides: Record<string, unknown> = {}): Portfolio {
  const result = usePortfolioStore.getState().create(validInput(overrides));
  if (!result.ok) throw new Error('setup failed');
  return result.data;
}

describe('SimulationWarnings — empty state', () => {
  it('prompts the user to run a simulation, rather than rendering empty warnings', () => {
    const portfolio = createPortfolio();
    render(<SimulationWarnings portfolio={portfolio} />);
    expect(screen.getByText('Run a simulation to see any warnings.')).toBeInTheDocument();
  });
});

describe('SimulationWarnings — no warnings triggered', () => {
  it('shows positive confirmation text, not an empty section', () => {
    const portfolio = createPortfolio();
    useSimulationStore.getState().setCurrentScenario({
      type: 'price',
      priceScenario: { type: 'absolute', btcPriceUsd: 60000 },
    });
    useSimulationStore.getState().runSimulation(portfolio);

    render(<SimulationWarnings portfolio={portfolio} />);

    expect(screen.getByText('No warnings for this simulation.')).toBeInTheDocument();
    expect(screen.getByText(/Invalid assumptions aren.t checked here/)).toBeInTheDocument();
  });
});

describe('SimulationWarnings — Unsafe Health Factor (real Store + real Portfolio)', () => {
  it('warns when the simulated Health Factor drops below the portfolio’s own configured target', () => {
    const portfolio = createPortfolio({
      settings: { safetyTargets: { targetHealthFactor: 5 } },
    });
    // 2 BTC * $20,000 = $40,000 collateral; $20,000 debt * 0.8 liquidation
    // threshold / $20,000 debt = Health Factor 1.6 — well below the
    // configured target of 5.
    useSimulationStore.getState().setCurrentScenario({
      type: 'price',
      priceScenario: { type: 'absolute', btcPriceUsd: 20000 },
    });
    useSimulationStore.getState().runSimulation(portfolio);

    render(<SimulationWarnings portfolio={portfolio} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/is below your configured target \(5\)/)).toBeInTheDocument();
    expect(screen.getByText(/increases your risk of losing collateral/)).toBeInTheDocument();
  });

  it('also fires for a portfolio action result, not just price/interest scenarios', () => {
    const portfolio = createPortfolio({
      settings: { safetyTargets: { targetHealthFactor: 5 } },
    });
    // 1 BTC * $50,000 = $50,000 collateral remaining; Health Factor =
    // ($50,000 * 0.8) / $20,000 = 2.0 — below the configured target of 5,
    // but comfortably clear of the liquidation-proximity/negative-equity
    // boundaries, so only Unsafe Health Factor fires here.
    useSimulationStore
      .getState()
      .runPortfolioActionSimulation(portfolio, { collateralDelta: -1, debtDelta: 0 });

    render(<SimulationWarnings portfolio={portfolio} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/is below your configured target \(5\)/)).toBeInTheDocument();
  });

  it('does not fire for a zero-debt portfolio, whose real simulated Health Factor is Infinity (Batch 22, M6-023)', () => {
    const portfolio = createPortfolio({
      debt: { asset: 'USDC', balance: 0 },
      settings: { safetyTargets: { targetHealthFactor: 5 } },
    });
    useSimulationStore.getState().setCurrentScenario({
      type: 'price',
      priceScenario: { type: 'absolute', btcPriceUsd: 60000 },
    });
    useSimulationStore.getState().runSimulation(portfolio);

    render(<SimulationWarnings portfolio={portfolio} />);

    expect(screen.getByText('No warnings for this simulation.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

/**
 * Simulation warning thresholds — a later task, added after M6-014's own
 * original build, requesting and approving numeric thresholds for 5
 * previously-blocked/unbuilt cases (see `../types/simulationWarnings.ts`
 * for the full reasoning). Every scenario below is driven through the
 * real Store/Service against a real portfolio — the same discipline this
 * file's own earlier tests already established — not a hand-crafted
 * `SimulationWarning` object.
 */
describe('SimulationWarnings — Health Factor at or below liquidation (real Store + real Portfolio)', () => {
  it('warns at Health Factor 1.0 exactly (AT_LIQUIDATION)', () => {
    const portfolio = createPortfolio();
    // collateralValue = debt / liquidationThreshold = 20000 / 0.8 =
    // 25000 -> price 12500 for 2 BTC -> Health Factor exactly 1.0.
    useSimulationStore.getState().setCurrentScenario({
      type: 'price',
      priceScenario: { type: 'absolute', btcPriceUsd: 12500 },
    });
    useSimulationStore.getState().runSimulation(portfolio);

    render(<SimulationWarnings portfolio={portfolio} />);

    expect(screen.getByText(/is at or below the liquidation boundary/)).toBeInTheDocument();
  });
});

describe('SimulationWarnings — Near liquidation (real Store + real Portfolio)', () => {
  it('warns at Health Factor 1.1 exactly (NEAR_LIQUIDATION)', () => {
    const portfolio = createPortfolio();
    // collateralValue = 1.1 * 20000 / 0.8 = 27500 -> price 13750 for
    // 2 BTC -> Health Factor exactly 1.1.
    useSimulationStore.getState().setCurrentScenario({
      type: 'price',
      priceScenario: { type: 'absolute', btcPriceUsd: 13750 },
    });
    useSimulationStore.getState().runSimulation(portfolio);

    render(<SimulationWarnings portfolio={portfolio} />);

    expect(screen.getByText(/is close to the liquidation boundary/)).toBeInTheDocument();
  });
});

describe('SimulationWarnings — Negative equity (real Store + real Portfolio)', () => {
  it('warns when the simulated portfolio value goes negative', () => {
    const portfolio = createPortfolio();
    // 2 BTC * $9,000 = $18,000 collateral < $20,000 debt -> equity -2000.
    useSimulationStore.getState().setCurrentScenario({
      type: 'price',
      priceScenario: { type: 'absolute', btcPriceUsd: 9000 },
    });
    useSimulationStore.getState().runSimulation(portfolio);

    render(<SimulationWarnings portfolio={portfolio} />);

    expect(screen.getByText(/is negative — debt exceeds collateral value/)).toBeInTheDocument();
  });
});

describe('SimulationWarnings — High leverage (real Store + real Portfolio)', () => {
  it('warns at leverage 3x exactly', () => {
    const portfolio = createPortfolio();
    // 2 BTC * $15,000 = $30,000 collateral; net worth 30,000 - 20,000 =
    // 10,000; leverage 30,000 / 10,000 = 3.0 exactly. Health Factor
    // (30000 * 0.8) / 20000 = 1.2, clear of the liquidation checks.
    useSimulationStore.getState().setCurrentScenario({
      type: 'price',
      priceScenario: { type: 'absolute', btcPriceUsd: 15000 },
    });
    useSimulationStore.getState().runSimulation(portfolio);

    render(<SimulationWarnings portfolio={portfolio} />);

    expect(screen.getByText(/simulated leverage \(3x\) is unusually high/)).toBeInTheDocument();
  });
});

describe('SimulationWarnings — High borrowing cost (real Store + real Portfolio)', () => {
  it('warns for an interest scenario stress-testing a 20% Borrow Rate', () => {
    const portfolio = createPortfolio();
    useSimulationStore.getState().setCurrentScenario({
      type: 'interest',
      priceScenario: { type: 'absolute', btcPriceUsd: 50000 },
      timeHorizonDays: 30,
      borrowApr: 0.2,
    });
    useSimulationStore.getState().runSimulation(portfolio);

    render(<SimulationWarnings portfolio={portfolio} />);

    expect(
      screen.getByText(/simulated Borrow APR \(20.00%\) is unusually high/),
    ).toBeInTheDocument();
  });

  it("does not warn for the portfolio's own ordinary 5% Borrow Rate on a price scenario", () => {
    const portfolio = createPortfolio();
    useSimulationStore.getState().setCurrentScenario({
      type: 'price',
      priceScenario: { type: 'absolute', btcPriceUsd: 50000 },
    });
    useSimulationStore.getState().runSimulation(portfolio);

    render(<SimulationWarnings portfolio={portfolio} />);

    expect(screen.getByText('No warnings for this simulation.')).toBeInTheDocument();
  });
});

/**
 * V4 High Borrowing Cost rate source — V4 Readiness Audit §12 Stage 20.
 * `protocol.borrowApr` and `v4DebtState.baseDrawnApr`/`riskPremium` are
 * deliberately different values so a legacy-field read or a
 * risk-premium mixup is directly observable.
 */
describe('SimulationWarnings — V4 High Borrowing Cost rate source (Stage 20)', () => {
  function createAndSelectV4(v4DebtState: {
    drawnDebt: number;
    premiumDebt: number;
    baseDrawnApr: number;
    riskPremium: number;
  }): Portfolio {
    const portfolio = createPortfolio({ protocol: { ...validInput().protocol, borrowApr: 0.99 } });
    usePortfolioStore.getState().setProtocolVersion(portfolio.id, 'v4');
    usePortfolioStore.getState().setAaveV4Position(portfolio.id, {
      userAddress: '0x1234567890123456789012345678901234567890',
    });
    usePortfolioStore.getState().setAaveV4DebtState(portfolio.id, v4DebtState);
    return usePortfolioStore.getState().portfolios[portfolio.id]!.portfolio;
  }

  it('baseline (portfolio action, no interest scenario) uses the canonical effective V4 rate, never the raw 99% legacy scalar', () => {
    const portfolio = createAndSelectV4({
      drawnDebt: 20000,
      premiumDebt: 500,
      baseDrawnApr: 0.05,
      riskPremium: 0.1,
    });
    useSimulationStore
      .getState()
      .runPortfolioActionSimulation(portfolio, { collateralDelta: 0, debtDelta: 0 });

    render(<SimulationWarnings portfolio={portfolio} />);

    // Real effective rate ≈5.37%, below the 15% threshold — no warning,
    // even though the raw legacy scalar (99%) would have triggered one.
    expect(screen.getByText('No warnings for this simulation.')).toBeInTheDocument();
  });

  it('an active interest scenario with no established rate stress uses the real unstressed effective rate (same as baseline)', () => {
    const portfolio = createAndSelectV4({
      drawnDebt: 20000,
      premiumDebt: 500,
      baseDrawnApr: 0.05,
      riskPremium: 0.1,
    });
    useSimulationStore.getState().setCurrentScenario({
      type: 'interest',
      priceScenario: { type: 'absolute', btcPriceUsd: 50000 },
      timeHorizonDays: 30,
      borrowApr: 0.99, // V3-only field; must not be read for V4
    });
    useSimulationStore.getState().runSimulation(portfolio);

    render(<SimulationWarnings portfolio={portfolio} />);

    expect(screen.getByText('No warnings for this simulation.')).toBeInTheDocument();
  });

  it('an active, genuinely-stressed V4 rate scenario evaluates the actual stressed effective rate — crosses the High Borrowing Cost threshold', () => {
    const portfolio = createAndSelectV4({
      drawnDebt: 20000,
      premiumDebt: 500,
      baseDrawnApr: 0.05,
      riskPremium: 0.1,
    });
    useSimulationStore.getState().setCurrentScenario({
      type: 'interest',
      priceScenario: { type: 'absolute', btcPriceUsd: 50000 },
      timeHorizonDays: 30,
      borrowApr: 0.99, // V3-only field; must not be read for V4
      v4RateStress: { baseDrawnApr: 0.5, riskPremium: 0.1 },
    });
    useSimulationStore.getState().runSimulation(portfolio);

    render(<SimulationWarnings portfolio={portfolio} />);

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toMatch(/simulated Borrow APR \(\d+\.\d\d%\) is unusually high/);
    // The blended stressed rate must not equal the raw baseDrawnApr
    // (50.00%) itself — riskPremium is layered on top by the Engine, so
    // the true effective rate is higher than 50%, not equal to it.
    expect(alert.textContent).not.toMatch(/\(50\.00%\)/);
  });
});

describe('SimulationWarnings — Long holding-period assumption (real Store + real Portfolio)', () => {
  it('warns for a Custom Holding Period beyond the longest built-in preset (400 days)', () => {
    const portfolio = createPortfolio();
    useSimulationStore.getState().setCurrentScenario({
      type: 'interest',
      priceScenario: { type: 'absolute', btcPriceUsd: 50000 },
      timeHorizonDays: 400,
      borrowApr: 0.05,
    });
    useSimulationStore.getState().runSimulation(portfolio);

    render(<SimulationWarnings portfolio={portfolio} />);

    expect(
      screen.getByText(/selected Holding Period \(400 days\) is longer than a year/),
    ).toBeInTheDocument();
  });

  it('does not warn for the longest built-in preset (365 days)', () => {
    const portfolio = createPortfolio();
    useSimulationStore.getState().setCurrentScenario({
      type: 'interest',
      priceScenario: { type: 'absolute', btcPriceUsd: 50000 },
      timeHorizonDays: 365,
      borrowApr: 0.05,
    });
    useSimulationStore.getState().runSimulation(portfolio);

    render(<SimulationWarnings portfolio={portfolio} />);

    expect(screen.getByText('No warnings for this simulation.')).toBeInTheDocument();
  });
});

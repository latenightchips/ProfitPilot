/**
 * Apply-to-Portfolio application contract — V1.1 Batch 3 ("Apply to
 * Portfolio"). The smallest coherent domain-level type for converting a
 * completed Simulation/Loop Builder/Exit Planner result into a real
 * change to the TRACKED portfolio (never an on-chain transaction — see
 * this type's own `valueBasis` field).
 *
 * **Not a new parallel state machine.** A `PortfolioApplyProposal` is a
 * plain, disposable value object — built fresh from the current planner
 * result plus the current portfolio at the moment the user opens the
 * confirmation dialog, never persisted, never held across a portfolio
 * switch or a page navigation. `stores/portfolioStore.ts`'s own
 * `applyPortfolioState` action is the only thing that ever turns one into
 * a real state change, and it re-validates `sourcePortfolioUpdatedAt`
 * against the CURRENT portfolio at apply time (Section 9's stale-result
 * protection) rather than trusting a proposal that may have gone stale
 * while the confirmation dialog was open.
 *
 * **`proposedPortfolio` is a complete `ApplicationPortfolio`, not a
 * delta.** Every builder (`buildLoopApplyProposal`,
 * `buildPortfolioActionApplyProposal`) reuses an already-existing,
 * already-tested Service function to construct it
 * (`buildFinalLoopPortfolio`/`buildPortfolioActionAfterPortfolio`) —
 * nothing in this module re-derives V4 debt-state math a second way. Only
 * `collateral`/`debt`/`protocolVersion`/`v4DebtState` can ever differ from
 * the source portfolio; `market`/`protocol`/`v4Position`/`v4CollateralRisk`
 * are always carried forward unchanged (Section 2's "assumptions that
 * remain unchanged" — see `unchangedAssumptions` below for the
 * human-readable statement of this same fact).
 */
import type { ApplicationPortfolio, PortfolioSummary } from '@/services/portfolio';

export type PortfolioApplySourceWorkflow = 'simulation' | 'loopBuilder' | 'exitPlanner';

export interface PortfolioApplyProposal {
  sourceWorkflow: PortfolioApplySourceWorkflow;
  portfolioId: string;
  /**
   * The source portfolio's own `updatedAt` at the moment this proposal
   * was built — the stale-result baseline `applyPortfolioState` compares
   * against the CURRENT portfolio's `updatedAt` before ever writing
   * (Section 9). A mismatch means the portfolio changed (a live sync
   * landed, another edit was made, or the portfolio was even deleted and
   * a same-id-reused case is structurally impossible) since this proposal
   * was generated — the apply is refused, forcing regeneration rather
   * than silently applying stale assumptions.
   */
  sourcePortfolioUpdatedAt: string;
  protocolVersion: 'v3' | 'v4';
  /** The complete resulting portfolio state — see this file's own header comment. */
  proposedPortfolio: ApplicationPortfolio;
  /** Human-readable statement of what Apply does NOT change — for the confirmation UI (Section 3). */
  unchangedAssumptions: readonly string[];
  before: PortfolioSummary;
  after: PortfolioSummary;
  /**
   * Always `'hypothetical'` — V1.1 Batch 3 never claims a value is
   * live/on-chain-confirmed. `applyPortfolioState` uses this same
   * discipline concretely: a V4 proposal's `v4DebtState` is written with
   * `v4DebtStateSource: 'manual'`, never `'live'` (Section 8's ownership
   * rule — see that action's own comment).
   */
  valueBasis: 'hypothetical';
  generatedAt: string;
}

/**
 * Portfolio Apply Service — public entry point. V1.1 Batch 3 ("Apply to
 * Portfolio"). Pure proposal-building logic only — `stores/portfolioStore.ts`'s
 * `applyPortfolioState` is the only place a `PortfolioApplyProposal` ever
 * becomes a real state change (see that action's own comment).
 */
export { buildLoopApplyProposal } from './buildLoopApplyProposal';
export { buildPortfolioActionApplyProposal } from './buildPortfolioActionApplyProposal';
export type { PortfolioApplyProposal, PortfolioApplySourceWorkflow } from './types';

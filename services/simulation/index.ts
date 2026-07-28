/**
 * Simulation Service — public entry point.
 *
 * 06_TASKS.md M3-001 ("Create Service Foundation") established this
 * directory; M3-009 ("Implement Simulation Service") is its first
 * occupant. `portfolioAction.ts` was added in Milestone 6 Batch 5
 * (M6-008, "Implement Portfolio Action Simulation") — see that file's
 * own header comment for why it is separate from
 * `services/portfolio/actionPreview.ts`'s own `previewPortfolioAction`
 * (M3-006).
 *
 * **`PriceScenarioInput` re-exported here (Batch 6, M6-006)**: it is an
 * Engine type (`engine/simulation/resolveScenarioPrice.ts`), but
 * `SimulationScenario`'s own `interest` variant needs it alongside
 * `borrowApr`/`timeHorizonDays`. Re-exporting it through the Service
 * barrel — rather than having `features/simulation/` import `@/engine`
 * directly — keeps `04_BUILD_GUIDE.md`'s own "Only services communicate
 * directly with the Formula Engine" rule intact (already followed since
 * Batch 4).
 */
export { type PortfolioActionSimulationInput, simulatePortfolioAction } from './portfolioAction';
export { simulateScenario, type SimulationResult, type SimulationScenario } from './scenario';
export type { PriceScenarioInput } from '@/engine';

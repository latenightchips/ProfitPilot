/**
 * Formula Coverage Registry — 06_TASKS.md M2-029 ("Implement Formula
 * Regression Suite").
 *
 * The canonical, single source of truth for what happened to every one of
 * `02_Formulas.md`'s 69 documented Formula IDs (F-001 through F-069). Each
 * entry is either:
 *   - `'implemented'`: has a real, Formula-ID-tagged implementation in
 *     `engine/`, verified against this registry by
 *     `tests/unit/engine/formulaCoverage.test.ts` (which scans `engine/`
 *     and `tests/` source text rather than trusting this file blindly).
 *   - `'not_implemented'`: intentionally not built, with a `reason`
 *     recorded here. Every reason below restates a finding already made,
 *     and usually already documented at length, in a prior batch's
 *     PROJECT_STATUS.md section — this file is a compact index into that
 *     history, not a new investigation.
 *
 * M2-029's own DoD ("A formula coverage report identifies no untested
 * Version 1 Formula IDs") is read as: no Formula ID is *silently*
 * untested. Every one of the 33 `'not_implemented'` entries below is
 * *documented* as untested and why — implementing all 69 would mean
 * inventing 33 formulas, scoring models, or iterative solvers nowhere
 * specified in `02_Formulas.md`, which directly contradicts this batch's
 * own "never invent formulas" instruction. See PROJECT_STATUS.md's Batch
 * 13 section and conflict #15 for the full reasoning.
 */

export type FormulaCoverageStatus = 'implemented' | 'not_implemented';

export interface FormulaCoverageEntry {
  id: string;
  title: string;
  status: FormulaCoverageStatus;
  /** Required when status is 'not_implemented'; omitted when 'implemented'. */
  reason?: string;
}

export const FORMULA_COVERAGE_REGISTRY: readonly FormulaCoverageEntry[] = [
  { id: 'F-001', title: 'Portfolio Value', status: 'implemented' },
  { id: 'F-002', title: 'Collateral Value', status: 'implemented' },
  { id: 'F-003', title: 'Debt Value', status: 'implemented' },
  { id: 'F-004', title: 'Net Portfolio Value', status: 'implemented' },
  {
    id: 'F-005',
    title: 'Equity Ratio',
    status: 'not_implemented',
    reason:
      'No task in 06_TASKS.md maps to this formula by name or plain-English description (Batch 2 finding).',
  },
  { id: 'F-006', title: 'Debt Ratio', status: 'implemented' },
  { id: 'F-007', title: 'Portfolio Gain', status: 'implemented' },
  {
    id: 'F-008',
    title: 'Portfolio Return',
    status: 'not_implemented',
    reason:
      'No task in 06_TASKS.md maps to this formula by name or plain-English description (Batch 2 finding).',
  },
  {
    id: 'F-009',
    title: '(undefined)',
    status: 'not_implemented',
    reason:
      'Never defined anywhere in 02_Formulas.md — the Portfolio Metrics chapter\'s own index cites the range "F-001 -> F-009," but no Purpose/Equation/Example section exists for F-009 at all. There is nothing documented to implement.',
  },
  { id: 'F-010', title: 'Exposure', status: 'implemented' },
  { id: 'F-011', title: 'Effective Leverage', status: 'implemented' },
  { id: 'F-012', title: 'Borrow Capacity', status: 'implemented' },
  { id: 'F-013', title: 'Available Borrow', status: 'implemented' },
  { id: 'F-014', title: 'Loop Capital', status: 'implemented' },
  { id: 'F-015', title: 'BTC Purchased Per Loop', status: 'implemented' },
  {
    id: 'F-016',
    title: 'Recursive Exposure',
    status: 'not_implemented',
    reason:
      'Realized conceptually inside calculateLoopStrategy (F-018) — cumulative BTC holdings grow step-by-step via steps[].collateralAfter — without a separate F-016-tagged function, since M2-016 does not name "exposure" as a distinct output (Batch 5).',
  },
  {
    id: 'F-017',
    title: 'Loop Efficiency',
    status: 'not_implemented',
    reason: 'No task in 06_TASKS.md maps to this formula (Batch 5 finding).',
  },
  { id: 'F-018', title: 'Maximum Loop Count', status: 'implemented' },
  {
    id: 'F-019',
    title: 'Loop Amplification Ratio',
    status: 'not_implemented',
    reason:
      'No task in 06_TASKS.md maps to this formula; "leverage"/"amplification" task language maps to the already-implemented F-011, not F-019 (Batch 5 finding).',
  },
  { id: 'F-020', title: 'Loan-to-Value (LTV)', status: 'implemented' },
  { id: 'F-021', title: 'Maximum Borrow Limit', status: 'implemented' },
  { id: 'F-022', title: 'Health Factor', status: 'implemented' },
  { id: 'F-023', title: 'Distance to Liquidation', status: 'implemented' },
  { id: 'F-024', title: 'Liquidation Price', status: 'implemented' },
  { id: 'F-025', title: 'Liquidation Buffer', status: 'implemented' },
  {
    id: 'F-026',
    title: 'Risk Category',
    status: 'not_implemented',
    reason:
      'Blocked by PROJECT_STATUS.md conflict #1: Health Factor risk-band thresholds disagree across 4 source documents; implementing would mean picking one arbitrarily.',
  },
  { id: 'F-027', title: 'Maximum Additional Debt', status: 'implemented' },
  {
    id: 'F-028',
    title: 'Health Factor After Price Change',
    status: 'not_implemented',
    reason:
      "Realized conceptually inside simulatePriceScenario (F-050), which calls calculateHealthFactor (F-022) with the scenario's new collateral value — the same equation F-028 documents — without its own F-028-tagged function, since no task names this as a distinct output (same pattern as F-016).",
  },
  {
    id: 'F-029',
    title: 'Protocol Safety Score',
    status: 'not_implemented',
    reason:
      'Only a discrete 7-point example lookup table is given (HF>=2.20 -> 100 ... HF<=1.00 -> 0), with no continuous equation or interpolation rule between points; implementing would mean inventing an interpolation method.',
  },
  { id: 'F-030', title: 'Daily Interest', status: 'implemented' },
  { id: 'F-031', title: 'Monthly Interest', status: 'implemented' },
  { id: 'F-032', title: 'Annual Interest', status: 'implemented' },
  { id: 'F-033', title: 'Debt Growth', status: 'implemented' },
  {
    id: 'F-034',
    title: 'Position Decay',
    status: 'not_implemented',
    reason:
      'No task in 06_TASKS.md maps to this formula — all F-030-F-039 formulas assume a single constant APR; compounding/variable-rate projection is blocked (conflict #7) (Batch 4 finding).',
  },
  {
    id: 'F-035',
    title: 'Health Factor Over Time',
    status: 'not_implemented',
    reason: 'No task in 06_TASKS.md maps to this formula (Batch 4 finding, same F-034-039 group).',
  },
  {
    id: 'F-036',
    title: 'Liquidation Price Over Time',
    status: 'not_implemented',
    reason: 'No task in 06_TASKS.md maps to this formula (Batch 4 finding, same F-034-039 group).',
  },
  {
    id: 'F-037',
    title: 'Break-Even BTC Appreciation',
    status: 'implemented',
  },
  {
    id: 'F-038',
    title: 'Time to Target Health Factor',
    status: 'not_implemented',
    reason: 'No task in 06_TASKS.md maps to this formula (Batch 4 finding, same F-034-039 group).',
  },
  {
    id: 'F-039',
    title: 'Time to Danger',
    status: 'not_implemented',
    reason: 'No task in 06_TASKS.md maps to this formula (Batch 4 finding, same F-034-039 group).',
  },
  { id: 'F-040', title: 'Target Debt', status: 'implemented' },
  { id: 'F-041', title: 'Required Debt Repayment', status: 'implemented' },
  { id: 'F-042', title: 'BTC Sale Required', status: 'implemented' },
  {
    id: 'F-043',
    title: 'Exit Profit',
    status: 'not_implemented',
    reason: 'No task in 06_TASKS.md maps to this formula (Batch 9 finding).',
  },
  {
    id: 'F-044',
    title: 'Capital Preservation Ratio',
    status: 'not_implemented',
    reason: 'No task in 06_TASKS.md maps to this formula (Batch 9 finding).',
  },
  {
    id: 'F-045',
    title: 'Target Price Exit',
    status: 'not_implemented',
    reason:
      '06_TASKS.md\'s M2-024 does not treat "Target BTC price" as a standalone exit target type (calculateTargetExit.ts\'s own note: a later task, M7-021, lists it only as an accompanying scenario-price field, not a target type); its own equation is also stated as solved only "iteratively," not as a closed form.',
  },
  {
    id: 'F-046',
    title: 'Recommended Partial Exit',
    status: 'not_implemented',
    reason: 'No task in 06_TASKS.md maps to this formula (Batch 9 finding).',
  },
  {
    id: 'F-047',
    title: 'Risk Reduction Efficiency',
    status: 'not_implemented',
    reason: 'No task in 06_TASKS.md maps to this formula (Batch 9 finding).',
  },
  {
    id: 'F-048',
    title: 'Optimal Exit Window',
    status: 'not_implemented',
    reason: 'No task in 06_TASKS.md maps to this formula (Batch 9 finding).',
  },
  {
    id: 'F-049',
    title: 'Exit Confidence Score',
    status: 'not_implemented',
    reason: 'No task in 06_TASKS.md maps to this formula (Batch 9 finding).',
  },
  { id: 'F-050', title: 'Price Change Simulation', status: 'implemented' },
  { id: 'F-051', title: 'Percentage Price Movement', status: 'implemented' },
  { id: 'F-052', title: 'Portfolio Projection', status: 'implemented' },
  { id: 'F-053', title: 'Scenario Difference', status: 'implemented' },
  {
    id: 'F-054',
    title: 'Best Case Scenario',
    status: 'not_implemented',
    reason:
      'Aggregates results across an entire batch of simulations ("Evaluate every simulation," return the maximum) rather than computing a single scenario; no task assigns this multi-scenario aggregation as a distinct deliverable.',
  },
  {
    id: 'F-055',
    title: 'Worst Case Scenario',
    status: 'not_implemented',
    reason:
      'Same multi-scenario aggregation pattern as F-054; no task assigns it as a distinct deliverable.',
  },
  {
    id: 'F-056',
    title: 'Break-Even Scenario',
    status: 'not_implemented',
    reason:
      'Its own documented "Method" is "Iterative Solver" — no closed-form equation is given to implement.',
  },
  {
    id: 'F-057',
    title: 'Target Achievement Simulation',
    status: 'not_implemented',
    reason:
      'Its own documented "Method" is "Evaluate every scenario until target is reached" — an iterative search over a scenario matrix, not a closed-form equation; no task assigns it.',
  },
  {
    id: 'F-058',
    title: 'Scenario Ranking Score',
    status: 'not_implemented',
    reason:
      'Names 6 inputs and a 0-100 output but no weighting model or equation combining them (Batch 8 finding); rankScenarios is explicitly not an implementation of F-058.',
  },
  {
    id: 'F-059',
    title: 'Simulation Summary',
    status: 'not_implemented',
    reason:
      "A composite report aggregating F-054-F-058's own outputs plus a generated recommendation; blocked transitively by all five being unimplemented, and no task assigns it.",
  },
  {
    id: 'F-060',
    title: 'Health Factor Recommendation',
    status: 'not_implemented',
    reason:
      "Blocked by PROJECT_STATUS.md conflict #1: the same Health Factor risk-band disagreement, this time in the Recommendation Engine's own rules.",
  },
  { id: 'F-061', title: 'Borrow Recommendation', status: 'implemented' },
  { id: 'F-062', title: 'Repayment Recommendation', status: 'implemented' },
  {
    id: 'F-063',
    title: 'Additional Collateral Recommendation',
    status: 'implemented',
  },
  { id: 'F-064', title: 'Loop Recommendation', status: 'implemented' },
  {
    id: 'F-065',
    title: 'Interest Warning',
    status: 'not_implemented',
    reason:
      'No numeric threshold anywhere in 02_Formulas.md for what counts as a "high" interest cost (Batch 10 finding).',
  },
  {
    id: 'F-066',
    title: 'Profit Target Recommendation',
    status: 'not_implemented',
    reason: 'No task in 06_TASKS.md maps to this formula (Batch 10 finding).',
  },
  {
    id: 'F-067',
    title: 'Simple Portfolio Score',
    status: 'not_implemented',
    reason:
      'Weights are documented but per-component 0-100 scoring formulas are not (PROJECT_STATUS.md conflict #12).',
  },
  {
    id: 'F-068',
    title: 'Primary Recommendation',
    status: 'not_implemented',
    reason:
      'No task in 06_TASKS.md maps to this formula (Batch 10 finding, part of the F-060-F-069 chapter gap).',
  },
  {
    id: 'F-069',
    title: 'Recommendation Summary',
    status: 'not_implemented',
    reason:
      'No task in 06_TASKS.md maps to this formula (Batch 10 finding, part of the F-060-F-069 chapter gap).',
  },
];

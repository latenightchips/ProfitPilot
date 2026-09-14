import { toDecimal } from '../shared/decimal';
import { createFailure, createSuccess, type FormulaResult } from '../shared/result';
import { validateHealthFactorForClassification } from '../validation/validate';

const FORMULA_ID = 'F-026';
const FORMULA_VERSION = '1.0';

/**
 * Risk Category — 02_Formulas.md F-026. Owner decision (PROJECT_STATUS.md
 * conflict #1, closed): canonical basis is `01_PRD.md` REQ-005-A, with the
 * overlapping-boundary ambiguity in that requirement's own historical
 * wording explicitly resolved to a mutually-exclusive, descending
 * comparison — every Health Factor value belongs to exactly one category:
 *
 *   HF > 2.50               → SAFE
 *   2.00 <  HF <= 2.50       → MONITOR
 *   1.50 <  HF <= 2.00       → ELEVATED
 *   1.20 <  HF <= 1.50       → HIGH RISK
 *              HF <= 1.20    → LIQUIDATION RISK
 *
 * This is the ONE canonical Health Factor classification in this
 * codebase — F-060 (`calculateHealthFactorRecommendation`) consumes this
 * function's own result rather than comparing Health Factor against a
 * second threshold table, and every other surface that needs a
 * qualitative Health Factor label (the Dashboard's Health Factor Status
 * section) calls this same function directly. The four historical,
 * mutually-disagreeing schemes this replaces (README.md/`01_PRD.md`
 * REQ-001-B, `01_PRD.md` REQ-005-A's own original ambiguous wording,
 * this file's own F-026, and F-060's own historical rules) remain in
 * `docs/` as frozen historical specification text, not rewritten.
 */
export type RiskCategory = 'SAFE' | 'MONITOR' | 'ELEVATED' | 'HIGH RISK' | 'LIQUIDATION RISK';

/**
 * Classifies an already-computed Health Factor (`calculateHealthFactor`,
 * F-022) into its canonical Risk Category. Never rounds `healthFactor`
 * before comparing it against the thresholds above — every comparison is
 * against the real numeric value.
 *
 * `+Infinity` (F-022's own "Health Factor without debt" output) is a
 * legitimate input and classifies SAFE, the trivial consequence of
 * `Infinity > 2.50`. NaN and any negative value (Health Factor can never
 * legitimately be negative) fail closed rather than fabricating a
 * category — see `validateHealthFactorForClassification`'s own doc
 * comment. Unreachable in practice for any Health Factor that actually
 * came from `calculateHealthFactor` itself (which never produces NaN or
 * a negative value), kept as the same "fail closed on invalid input,
 * never guess" defense-in-depth this Engine applies everywhere else.
 */
export function calculateRiskCategory(healthFactor: number): FormulaResult<RiskCategory> {
  const options = {
    formulaId: FORMULA_ID,
    formulaVersion: FORMULA_VERSION,
    inputsUsed: { healthFactor },
  };

  const validated = validateHealthFactorForClassification(healthFactor, 'healthFactor');
  if (!validated.ok) return createFailure(validated.error, options);

  const hf = validated.value;
  const thresholds: [threshold: number, category: RiskCategory][] = [
    [2.5, 'SAFE'],
    [2.0, 'MONITOR'],
    [1.5, 'ELEVATED'],
    [1.2, 'HIGH RISK'],
  ];
  for (const [threshold, category] of thresholds) {
    if (hf.greaterThan(toDecimal(threshold))) return createSuccess(category, options);
  }
  return createSuccess('LIQUIDATION RISK', options);
}

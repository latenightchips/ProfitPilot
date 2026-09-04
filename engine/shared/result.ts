/**
 * Standard Engine return type — 06_TASKS.md M2-004 ("Create Standard
 * Formula Result Model") and 01_PRD.md REQ-002 "OUTPUT MODEL": every
 * calculation returns a structured result, never a raw number.
 */

/**
 * The Engine must remain framework-independent and portable enough to be
 * published as its own package (04_BUILD_GUIDE.md), so this is a literal
 * constant rather than an import of the host application's package.json.
 * Bump it alongside package.json's "version" field.
 */
const ENGINE_VERSION = '1.8.0';
export interface FormulaWarning {
  code: string;
  message: string;
}

export interface FormulaError {
  code: string;
  message: string;
}

export interface FormulaMetadata {
  /** e.g. "F-022" — see 02_Formulas.md. */
  formulaId: string;
  engineVersion: string;
  /** 02_Formulas.md document version this formula was implemented against. */
  formulaVersion: string;
  assumptions: string[];
  inputsUsed: Record<string, unknown>;
  timestamp: string;
}

export interface FormulaSuccess<T> {
  ok: true;
  value: T;
  warnings: FormulaWarning[];
  metadata: FormulaMetadata;
}

export interface FormulaFailure {
  ok: false;
  error: FormulaError;
  metadata: FormulaMetadata;
}

export type FormulaResult<T> = FormulaSuccess<T> | FormulaFailure;

export interface CreateResultOptions {
  formulaId: string;
  formulaVersion: string;
  inputsUsed: Record<string, unknown>;
  assumptions?: string[];
}

function buildMetadata(options: CreateResultOptions): FormulaMetadata {
  return {
    formulaId: options.formulaId,
    engineVersion: ENGINE_VERSION,
    formulaVersion: options.formulaVersion,
    assumptions: options.assumptions ?? [],
    inputsUsed: options.inputsUsed,
    timestamp: new Date().toISOString(),
  };
}

export function createSuccess<T>(
  value: T,
  options: CreateResultOptions,
  warnings: FormulaWarning[] = [],
): FormulaSuccess<T> {
  return { ok: true, value, warnings, metadata: buildMetadata(options) };
}

export function createFailure(error: FormulaError, options: CreateResultOptions): FormulaFailure {
  return { ok: false, error, metadata: buildMetadata(options) };
}

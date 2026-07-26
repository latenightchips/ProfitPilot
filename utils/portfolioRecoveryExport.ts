/**
 * Portfolio recovery copy export — 06_TASKS.md M4-017 ("Implement
 * Portfolio Error Recovery"): "Export recovery copy where possible."
 *
 * Scoped narrowly to what M4-017 itself asks for — a local download of a
 * portfolio's own raw data, so a user does not lose visibility into it
 * if its calculated summary fails. This is **not** the fuller "Export
 * Portfolio" feature 03_UI.md's Dashboard "PAGE ACTIONS"/"EXPORT
 * OPTIONS" sections describe (CSV/PDF formats, calculated summary
 * fields) — that is a separate, unassigned task; building it here would
 * be scope creep beyond what M4-017's own text asks for.
 *
 * **Export contents — deliberately smaller than 04_BUILD_GUIDE.md's
 * "IMPORT/EXPORT DIRECTORY" illustrative shape** ("Application Version,
 * Engine Version, Formula Version, Export Timestamp"). "Engine Version"/
 * "Formula Version" describe a *successful* calculation's own metadata
 * (`ServiceMetadata`, M3-002) — by definition, this export exists
 * specifically for the case where the calculation *failed*, so there is
 * no real Engine/Formula version to report without fabricating one.
 * Only `exportedAt` and `schemaVersion` (this application's own
 * Version 0.1, matching `package.json`) are included, plus the portfolio
 * itself — 01_PRD.md's "BACKUP & RECOVERY" section names exactly this
 * for Version 0.1: "Local export only... Every export should include
 * schema versioning."
 */
import type { Portfolio } from '@/types/portfolio';

export const PORTFOLIO_RECOVERY_SCHEMA_VERSION = '0.1.0';

export interface PortfolioRecoveryCopy {
  schemaVersion: string;
  exportedAt: string;
  portfolio: Portfolio;
}

export function buildPortfolioRecoveryCopy(portfolio: Portfolio): PortfolioRecoveryCopy {
  return {
    schemaVersion: PORTFOLIO_RECOVERY_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    portfolio,
  };
}

/**
 * Triggers a browser download of a portfolio's recovery copy as JSON.
 * Standard Blob + temporary-anchor pattern — no new dependency, and no
 * network request (this Store has none to make, per Conflict B).
 */
export function downloadPortfolioRecoveryCopy(portfolio: Portfolio): void {
  const copy = buildPortfolioRecoveryCopy(portfolio);
  const blob = new Blob([JSON.stringify(copy, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `portfolio-${portfolio.id}-recovery.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

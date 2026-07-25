import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { FORMULA_COVERAGE_REGISTRY } from '../../fixtures/formulaCoverage';

/**
 * Formula Coverage Report — 06_TASKS.md M2-029.
 *
 * This is the executable form of the DoD's "formula coverage report":
 * rather than a static document that can silently drift out of date, it
 * scans the real `engine/` and `tests/` source text on every run and
 * cross-checks it against `tests/fixtures/formulaCoverage.ts`'s registry.
 * A Formula ID cannot become "implemented" in the registry without an
 * actual tagged implementation and a test asserting it, and cannot
 * silently gain an implementation without the registry being updated to
 * match — either drift fails this suite.
 */

/**
 * Matches only actual code-level Formula ID tags (`FORMULA_ID = 'F-0XX'` or
 * `formulaId: 'F-0XX'`), never a prose mention in a comment — several
 * engine/ files discuss a Formula ID by name without implementing it (e.g.
 * calculateTargetExit.ts's own comment references F-045 to explain why
 * F-040 differs from it), and a naive full-text scan would misread that as
 * an implementation.
 */
const TAGGED_FORMULA_ID_PATTERN = /(?:formulaId:\s*|FORMULA_ID\s*=\s*)'(F-0\d{2})'/g;

/** Looser scan for test files: any mention of the literal ID is enough to count as "referenced." */
const MENTIONED_FORMULA_ID_PATTERN = /F-0\d{2}/g;

/**
 * 06_TASKS.md M2-032's "Public output includes the correct Formula ID" —
 * stricter than `MENTIONED_FORMULA_ID_PATTERN`: a Formula ID appearing
 * only in a test's description string or a comment would satisfy that
 * looser pattern without ever actually asserting the runtime
 * `result.metadata.formulaId` value. This matches only the real runtime
 * assertion (`....formulaId).toBe('F-0XX')`), the convention used
 * consistently since Batch 1.
 */
const RUNTIME_METADATA_ASSERTION_PATTERN = /\.formulaId\)\.toBe\('(F-0\d{2})'\)/g;

function collectFormulaIds(rootDir: string, pattern: RegExp): Set<string> {
  const ids = new Set<string>();

  function walk(dir: string): void {
    for (const entry of readdirSync(dir)) {
      const fullPath = join(dir, entry);
      const stats = statSync(fullPath);
      if (stats.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!entry.endsWith('.ts')) continue;

      const content = readFileSync(fullPath, 'utf-8');
      for (const match of content.matchAll(pattern)) {
        ids.add(match[1] ?? match[0]);
      }
    }
  }

  walk(rootDir);
  return ids;
}

/**
 * 06_TASKS.md M2-032's "Documentation exists" — for every engine/ file
 * that tags a Formula ID, its own doc comment must cite `02_Formulas.md`
 * (the established convention every implemented file already follows),
 * not just carry the bare ID.
 */
function collectUndocumentedTaggedFiles(rootDir: string): string[] {
  const undocumented: string[] = [];

  function walk(dir: string): void {
    for (const entry of readdirSync(dir)) {
      const fullPath = join(dir, entry);
      const stats = statSync(fullPath);
      if (stats.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!entry.endsWith('.ts')) continue;

      const content = readFileSync(fullPath, 'utf-8');
      const isTagged = new RegExp(TAGGED_FORMULA_ID_PATTERN.source).test(content);
      if (isTagged && !content.includes('02_Formulas.md')) {
        undocumented.push(fullPath);
      }
    }
  }

  walk(rootDir);
  return undocumented;
}

describe('Formula Coverage Report (M2-029)', () => {
  const engineDir = join(process.cwd(), 'engine');
  const testsDir = join(process.cwd(), 'tests', 'unit', 'engine');

  const idsTaggedInEngineSource = collectFormulaIds(engineDir, TAGGED_FORMULA_ID_PATTERN);
  const idsMentionedInTests = collectFormulaIds(testsDir, MENTIONED_FORMULA_ID_PATTERN);
  const idsAssertedAtRuntimeInTests = collectFormulaIds(
    testsDir,
    RUNTIME_METADATA_ASSERTION_PATTERN,
  );
  const undocumentedTaggedFiles = collectUndocumentedTaggedFiles(engineDir);

  it('the registry contains exactly F-001 through F-069, once each', () => {
    const ids = FORMULA_COVERAGE_REGISTRY.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);

    const expectedIds = Array.from({ length: 69 }, (_, i) => `F-${String(i + 1).padStart(3, '0')}`);
    expect([...ids].sort()).toEqual([...expectedIds].sort());
  });

  it('every "not_implemented" entry has a documented reason', () => {
    for (const entry of FORMULA_COVERAGE_REGISTRY) {
      if (entry.status === 'not_implemented') {
        expect(entry.reason, `${entry.id} (${entry.title}) is missing a reason`).toBeTruthy();
      }
    }
  });

  it.each(FORMULA_COVERAGE_REGISTRY.filter((entry) => entry.status === 'implemented'))(
    '$id ($title): is actually tagged in engine/ source and referenced by at least one test',
    (entry) => {
      expect(
        idsTaggedInEngineSource.has(entry.id),
        `${entry.id} is marked 'implemented' in the registry but no engine/ source file tags it`,
      ).toBe(true);
      expect(
        idsMentionedInTests.has(entry.id),
        `${entry.id} is marked 'implemented' but no test under tests/unit/engine references it`,
      ).toBe(true);
    },
  );

  it.each(FORMULA_COVERAGE_REGISTRY.filter((entry) => entry.status === 'not_implemented'))(
    '$id ($title): is not tagged anywhere in engine/ source (registry would be stale otherwise)',
    (entry) => {
      expect(
        idsTaggedInEngineSource.has(entry.id),
        `${entry.id} is marked 'not_implemented' in the registry but an engine/ source file tags it — the registry is stale and should be updated to 'implemented'`,
      ).toBe(false);
    },
  );

  it('every Formula ID tagged in engine/ source is accounted for by the registry as implemented', () => {
    const implementedIds = new Set(
      FORMULA_COVERAGE_REGISTRY.filter((entry) => entry.status === 'implemented').map(
        (entry) => entry.id,
      ),
    );
    const untrackedIds = [...idsTaggedInEngineSource].filter((id) => !implementedIds.has(id));
    expect(untrackedIds, 'engine/ tags a Formula ID the registry does not know about').toEqual([]);
  });

  it.each(FORMULA_COVERAGE_REGISTRY.filter((entry) => entry.status === 'implemented'))(
    '$id ($title): a test asserts result.metadata.formulaId at runtime (M2-032 "Public output includes the correct Formula ID")',
    (entry) => {
      expect(
        idsAssertedAtRuntimeInTests.has(entry.id),
        `${entry.id} has no test asserting \`.formulaId).toBe('${entry.id}')\` at runtime — a mention in a description or comment is not enough`,
      ).toBe(true);
    },
  );

  it('every engine/ file that tags a Formula ID also cites 02_Formulas.md in its own doc comment (M2-032 "Documentation exists")', () => {
    expect(
      undocumentedTaggedFiles,
      'these files carry a Formula ID tag but no doc comment citing 02_Formulas.md',
    ).toEqual([]);
  });

  it('counts match the expected 36 implemented / 33 not-implemented split', () => {
    const implementedCount = FORMULA_COVERAGE_REGISTRY.filter(
      (entry) => entry.status === 'implemented',
    ).length;
    const notImplementedCount = FORMULA_COVERAGE_REGISTRY.filter(
      (entry) => entry.status === 'not_implemented',
    ).length;
    expect(implementedCount).toBe(36);
    expect(notImplementedCount).toBe(33);
    expect(implementedCount + notImplementedCount).toBe(69);
  });
});

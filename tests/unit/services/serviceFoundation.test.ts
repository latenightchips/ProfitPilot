import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Service Foundation — 06_TASKS.md M3-001 ("Create Service Foundation").
 *
 * Mechanically verifies M3-001's own DoD ("Services are accessible
 * through documented public entry points. No Service imports React
 * components.") rather than asserting it in prose — the same pattern
 * `engine/`'s own framework-independence checks used throughout
 * Milestone 2.
 */

const EXPECTED_SUBDIRECTORIES = [
  'portfolio',
  'market',
  'protocol',
  'simulation',
  'loop',
  'exit',
  'recommendation',
  'persistence',
  'import',
  'export',
  'shared',
] as const;

const servicesDir = join(process.cwd(), 'services');

function collectTsFiles(rootDir: string): string[] {
  const files: string[] = [];

  function walk(dir: string): void {
    for (const entry of readdirSync(dir)) {
      const fullPath = join(dir, entry);
      const stats = statSync(fullPath);
      if (stats.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (entry.endsWith('.ts') || entry.endsWith('.tsx')) files.push(fullPath);
    }
  }

  walk(rootDir);
  return files;
}

describe('Service Foundation (M3-001)', () => {
  it.each(EXPECTED_SUBDIRECTORIES)('services/%s/ exists with an index.ts entry point', (name) => {
    const indexPath = join(servicesDir, name, 'index.ts');
    expect(() => statSync(indexPath)).not.toThrow();
    expect(statSync(indexPath).isFile()).toBe(true);
  });

  it('services/index.ts (the root public entry point) exists', () => {
    const indexPath = join(servicesDir, 'index.ts');
    expect(() => statSync(indexPath)).not.toThrow();
  });

  it('the root services/index.ts is importable without throwing', async () => {
    await expect(import('@/services')).resolves.toBeDefined();
  });

  it('no file under services/ imports React, Next.js, or a UI component path (DoD: "No Service imports React components")', () => {
    const forbiddenImportPattern =
      /from\s+['"](react|react-dom|next(?:\/.*)?|@\/components(?:\/.*)?)['"]/;
    const offendingFiles: string[] = [];

    for (const file of collectTsFiles(servicesDir)) {
      const content = readFileSync(file, 'utf-8');
      if (forbiddenImportPattern.test(content)) offendingFiles.push(file);
    }

    expect(offendingFiles, 'these Service files import React/Next.js/UI components').toEqual([]);
  });
});

/**
 * Hardcoded-infrastructure check — 06_TASKS.md M3-013 ("Implement
 * Service Dependency Injection"), Goal "Avoid hardcoded infrastructure."
 *
 * Every batch from M3-005 onward manually grepped `services/` for
 * `fetch(`/`axios`/`XMLHttpRequest`/`process.env`/`infrastructure` as
 * part of its own architecture audit (see PROJECT_STATUS.md's Batch 5
 * and Batch 8 write-ups on the unassigned `infrastructure/` layer).
 * This formalizes that recurring manual check into a permanent,
 * automated regression test rather than repeating it by hand every
 * batch — mechanically proving the Goal, not just asserting it in prose,
 * the same "prove the DoD" pattern this file's own M3-001 checks use.
 */
describe('No hardcoded infrastructure under services/ (M3-013)', () => {
  it('no file under services/ calls fetch, axios, or XMLHttpRequest, or reads process.env, or references an infrastructure/ import path', () => {
    const forbiddenPattern =
      /(\bfetch\s*\(|\baxios\b|\bXMLHttpRequest\b|process\.env|from\s+['"][^'"]*\/infrastructure\/)/;
    const offendingFiles: string[] = [];

    for (const file of collectTsFiles(servicesDir)) {
      const content = readFileSync(file, 'utf-8');
      // Doc comments in services/market/quote.ts, services/protocol/quote.ts,
      // etc. discuss these terms in prose while explaining what was
      // deliberately not built; only flag matches outside comment blocks.
      const withoutComments = content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      if (forbiddenPattern.test(withoutComments)) offendingFiles.push(file);
    }

    expect(offendingFiles, 'these Service files reference hardcoded infrastructure').toEqual([]);
  });
});

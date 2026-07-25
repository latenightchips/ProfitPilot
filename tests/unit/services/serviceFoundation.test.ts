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

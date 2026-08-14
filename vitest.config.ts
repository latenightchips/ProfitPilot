import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/unit/**/*.test.{ts,tsx}', '**/*.test.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: [
        'engine/**',
        'infrastructure/**',
        'services/**',
        'app/api/**',
        'utils/**',
        'types/**',
        'stores/**',
        'app/portfolio/**',
        'app/portfolios/**',
        'app/page.tsx',
        'app/simulation/**',
        'app/loop-builder/**',
        'app/settings/**',
        'app/sign-up/**',
        'app/sign-in/**',
        'app/reset-password/**',
        'features/dashboard/**',
        'features/simulation/**',
        'features/loop-builder/**',
        'features/exit-planner/**',
        'features/recommendations/**',
        'components/layout/AppHeader.tsx',
        'components/strategy/**',
        'providers/**',
      ],
      exclude: ['**/*.d.ts', '**/tests/**'],
    },
  },
});

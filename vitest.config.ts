import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',

    // Allow importing TypeScript source directly from workspace packages
    // (since their `main` fields point to src/index.ts, not compiled JS)
    server: {
      deps: {
        // Let Vite process workspace packages instead of treating them as
        // external CJS modules — needed because `main` is a .ts file
        inline: ['shared', 'database', 'queue'],// don''t treat them external packages
      },
    },

    // Where to find test files
    include: ['tests/**/*.test.ts'],

    // Globals (describe/it/expect) — opt-in to avoid polluting Node globals
    globals: false,
  },

  resolve: {
    alias: {
      // Map bare workspace package names to their TypeScript source
      shared:   path.resolve(__dirname, 'packages/shared/src/index.ts'),
      database: path.resolve(__dirname, 'packages/database/src/index.ts'),
      queue:    path.resolve(__dirname, 'packages/queue/src/index.ts'),
    },
  },
});

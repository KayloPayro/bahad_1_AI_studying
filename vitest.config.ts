import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: { __SITE_BASE__: JSON.stringify('/') },
  test: {
    include: ['packages/*/src/**/*.test.ts', 'modules/*/src/**/*.test.ts'],
    environment: 'node',
  },
});

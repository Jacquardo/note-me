import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: [
      'tests/**/*.test.js'
    ],
    exclude: [
      'node_modules',
      'dist',
      '.git',
      'vendor'
    ],
    setupFiles: [],
    coverage: {
      provider: 'v8',
      reporter: [
        'text',
        'html',
        'lcov'
      ],
      reportsDirectory: './coverage',
      exclude: [
        'vendor/**',
        'tests/**',
        'sw.js',
        'vitest.config.js'
      ]
    }
  }
});
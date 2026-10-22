import {defineConfig} from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Every test file seeds and clears the same on-disk `.algoliaMockServer` index.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/**', 'dist/**', 'bin/**', '**/*.d.ts', '**/*.config.*', '**/types/**'],
    },
  },
})

import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    projects: [
      {
        extends: true,
        test: { name: 'client', environment: 'jsdom', include: ['client/src/**/*.test.js'] },
      },
      {
        extends: true,
        test: { name: 'server', environment: 'node', include: ['server/tests/unit/**/*.test.js'] },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          environment: 'node',
          include: ['server/tests/integration/**/*.test.js'],
          testTimeout: 10000,
          hookTimeout: 15000,
        },
      },
    ],
  },
})

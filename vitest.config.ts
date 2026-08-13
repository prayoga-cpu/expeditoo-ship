import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/testing/setup-vitest.ts'],
    env: {
      STRIPE_SECRET_KEY: 'sk_test_mock_key',
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
    },
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
    // Isolate service tests from UI tests if needed in future
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});

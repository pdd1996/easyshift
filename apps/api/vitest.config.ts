import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    env: {
      DATABASE_URL: 'mysql://easyshift:easyshift@localhost:3306/easyshift_test',
      JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long',
    },
  },
});

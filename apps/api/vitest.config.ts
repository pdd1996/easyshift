import { config } from 'dotenv';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const apiRoot = fileURLToPath(new URL('.', import.meta.url));
config({ path: resolve(apiRoot, '.env') });

const TEST_DATABASE = 'easyshift_test';
const FALLBACK_DATABASE_URL = `mysql://easyshift:easyshift@localhost:3306/${TEST_DATABASE}`;

function resolveTestDatabaseUrl(): string {
  const source = process.env.DATABASE_URL;
  if (!source) {
    return FALLBACK_DATABASE_URL;
  }

  try {
    const url = new URL(source);
    url.pathname = `/${TEST_DATABASE}`;
    return url.toString();
  } catch {
    return FALLBACK_DATABASE_URL;
  }
}

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    env: {
      DATABASE_URL: resolveTestDatabaseUrl(),
      JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long',
      WX_MOCK: 'true',
    },
  },
});

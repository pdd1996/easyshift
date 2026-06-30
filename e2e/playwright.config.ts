import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const e2eWxOpenId = process.env.E2E_WX_MOCK_OPENID ?? `e2e_pw_${process.pid}`;

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL: process.env.E2E_WEB_ORIGIN ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'pnpm dev:api',
      url: 'http://localhost:3000/api/v1/health',
      cwd: repoRoot,
      env: {
        WX_MOCK: 'true',
        WX_MOCK_OPENID: e2eWxOpenId,
      },
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'pnpm dev:web',
      url: 'http://localhost:5173',
      cwd: repoRoot,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});

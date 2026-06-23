import { test, expect } from '@playwright/test';

test.skip('E2E-01 login placeholder', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByText('EasyShift 易排班')).toBeVisible();
});

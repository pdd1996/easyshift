import type { Page } from '@playwright/test';
import { E2E_CONFIG } from './env';

export async function loginAsAdmin(
  page: Page,
  phone = E2E_CONFIG.adminPhone,
  password = E2E_CONFIG.adminPassword,
): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('手机号').fill(phone);
  await page.getByLabel('密码').fill(password);
  await page.getByRole('button', { name: /登\s*录/ }).click();
  await page.getByRole('heading', { name: '工作台' }).waitFor({ state: 'visible' });
}

export async function openSchedulePage(page: Page): Promise<void> {
  await page.getByRole('menuitem', { name: '排班表' }).click();
  await page.getByRole('heading', { name: '排班表' }).waitFor({ state: 'visible' });
}

export async function createCurrentWeekPeriod(page: Page): Promise<void> {
  const createButton = page.getByRole('button', { name: /创建.*排班/ });
  await createButton.waitFor({ state: 'visible' });
  await createButton.click();
  await page.getByRole('columnheader', { name: '员工' }).waitFor({ state: 'visible' });
}

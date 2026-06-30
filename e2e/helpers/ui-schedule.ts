import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export async function assignShiftInGrid(
  page: Page,
  employeeName: string,
  weekdayIndex: number,
  shiftCode: string,
  options?: { confirmPublishedEdit?: boolean },
): Promise<void> {
  const row = page.locator('tbody tr').filter({
    has: page.getByText(employeeName, { exact: true }),
  });
  const cellButton = row.locator('button[type="button"]').nth(weekdayIndex);
  await cellButton.click();

  const popover = page.locator('.ant-popover').filter({ hasText: '选择班次' });
  await popover.waitFor({ state: 'visible' });
  await popover.getByRole('button', { name: shiftCode, exact: true }).click();

  if (options?.confirmPublishedEdit) {
    const editModal = page.getByRole('dialog', { name: '编辑已发布排班' });
    await editModal.waitFor({ state: 'visible' });
    await editModal.getByRole('button', { name: /继续编辑/ }).click();
    await editModal.waitFor({ state: 'hidden' });
  }

  await expectShiftInCell(page, employeeName, weekdayIndex, shiftCode);
}

export async function publishCurrentPeriod(page: Page): Promise<void> {
  const publishButton = page.getByRole('button', { name: '发布本周期' });
  await publishButton.waitFor({ state: 'visible' });
  await expect(publishButton).toBeEnabled();
  await publishButton.click();

  const publishDialog = page.getByRole('dialog', { name: '发布本周期' });
  await publishDialog.waitFor({ state: 'visible' });

  const confirmButton = publishDialog.getByRole('button', {
    name: /确\s*认(并)?发\s*布/,
  });
  await confirmButton.click();

  const successDialog = page.getByRole('dialog', { name: '发布成功' });
  if (await successDialog.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await successDialog.getByRole('button', { name: /知\s*道\s*了/ }).click();
  }
}

export async function expectShiftInCell(
  page: Page,
  employeeName: string,
  weekdayIndex: number,
  shiftCode: string,
): Promise<void> {
  const row = page.locator('tbody tr').filter({
    has: page.getByText(employeeName, { exact: true }),
  });
  const cellButton = row.locator('button[type="button"]').nth(weekdayIndex);
  await cellButton.getByText(shiftCode, { exact: true }).waitFor({ state: 'visible' });
}

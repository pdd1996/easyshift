import { expect, test } from '@playwright/test';
import {
  AdminApiClient,
  type EmployeeRecord,
  type ShiftTypeRecord,
  waitForApiHealth,
} from '../helpers/admin-api';
import { addDays, e2eClockTime, e2eWeekStart } from '../helpers/dates';
import { createCurrentWeekPeriod, loginAsAdmin, openSchedulePage } from '../helpers/ui-auth';
import {
  assignShiftInGrid,
  confirmPublishDialog,
  copyNotificationText,
  dismissPublishSuccessDialog,
  expectShiftInCell,
  openPublishDialog,
  publishCurrentPeriod,
  readNotificationText,
} from '../helpers/ui-schedule';
import dayjs from 'dayjs';

const RUN_SUFFIX = Date.now().toString().slice(-6);
const RUN_WEEK_OFFSET = Number(Date.now().toString().slice(-5));
const WEEK_E2E_01 = e2eWeekStart(RUN_WEEK_OFFSET);
const WEEK_E2E_02 = e2eWeekStart(RUN_WEEK_OFFSET + 1);
const WEEK_E2E_04 = e2eWeekStart(RUN_WEEK_OFFSET + 2);
const WEEK_E2E_05 = e2eWeekStart(RUN_WEEK_OFFSET + 3);
const WEEK_E2E_06 = e2eWeekStart(RUN_WEEK_OFFSET + 4);
const DAY_SHIFT_CODE = 'D';
const NIGHT_SHIFT_CODE = 'N';

function formatWeekRange(weekStart: string): string {
  const start = dayjs(weekStart);
  const end = start.add(6, 'day');
  return `${start.format('M月D日')}–${end.format('M月D日')}`;
}

test.describe('Schedule E2E', () => {
  test.describe.configure({ mode: 'serial' });

  let admin: AdminApiClient;
  let dayShift: ShiftTypeRecord;
  let employee: EmployeeRecord;
  let staffToken: string;

  test.beforeAll(async () => {
    await waitForApiHealth();
    admin = new AdminApiClient();
    await admin.login();

    dayShift = await admin.ensureDayShiftType(DAY_SHIFT_CODE);

    employee = await admin.createEmployee({
      employeeNo: `E2E${RUN_SUFFIX}`,
      name: `E2E员工${RUN_SUFFIX}`,
      phone: `1389${RUN_SUFFIX.padStart(7, '0').slice(-7)}`,
      title: '护士',
    });
    staffToken = await admin.getStaffToken(employee);
  });

  async function prepareSchedulePage(page: import('@playwright/test').Page, weekStart: string) {
    await page.clock.install({ time: e2eClockTime(weekStart) });
    await loginAsAdmin(page);
    await openSchedulePage(page);
  }

  test('E2E-01 登录后排班保存，刷新后格子内容保留', async ({ page }) => {
    await prepareSchedulePage(page, WEEK_E2E_01);
    await createCurrentWeekPeriod(page);

    await assignShiftInGrid(page, employee.name, 0, DAY_SHIFT_CODE);
    await expectShiftInCell(page, employee.name, 0, DAY_SHIFT_CODE);

    await page.reload();
    await page.getByRole('columnheader', { name: '员工' }).waitFor({ state: 'visible' });
    await expectShiftInCell(page, employee.name, 0, DAY_SHIFT_CODE);
  });

  test('E2E-02 故意少排大夜，发布确认弹窗展示覆盖不足 warning', async ({ page }) => {
    const period = await admin.createPeriod(WEEK_E2E_02);
    const nightShift = await admin.ensureNightShiftType(NIGHT_SHIFT_CODE);
    await admin.upsertEntries(period.id, [
      { employeeId: employee.id, workDate: WEEK_E2E_02, shiftTypeId: nightShift.id },
    ]);

    await prepareSchedulePage(page, WEEK_E2E_02);
    await expect(page.getByText('草稿')).toBeVisible();

    const publishDialog = await openPublishDialog(page);
    await expect(publishDialog.getByText(/存在 \d+ 条排班警告/)).toBeVisible();
    await expect(publishDialog.getByText(/N 仅 1 人，低于最低 2 人/)).toBeVisible();
    await publishDialog.getByRole('button', { name: /取\s*消/ }).click();
  });

  test('E2E-04 发布成功，页面显示 v1 与发布时间', async ({ page }) => {
    const period = await admin.createPeriod(WEEK_E2E_04);
    await admin.upsertEntries(period.id, [
      { employeeId: employee.id, workDate: WEEK_E2E_04, shiftTypeId: dayShift.id },
    ]);

    await prepareSchedulePage(page, WEEK_E2E_04);
    await expect(page.getByText('草稿')).toBeVisible();

    await publishCurrentPeriod(page);

    await expect(page.getByText('已发布')).toBeVisible();
    await expect(page.getByText(/^v1 · \d{4}-\d{2}-\d{2}/).first()).toBeVisible();
  });

  test('E2E-05 发布后改草稿，员工 API 仍 v1；再发布后 API 为 v2', async ({ page }) => {
    const period = await admin.createPeriod(WEEK_E2E_05);
    const tuesday = addDays(WEEK_E2E_05, 1);
    await admin.upsertEntries(period.id, [
      { employeeId: employee.id, workDate: WEEK_E2E_05, shiftTypeId: dayShift.id },
    ]);
    await admin.publish(period.id, { acknowledgeWarnings: true });

    await prepareSchedulePage(page, WEEK_E2E_05);
    await expect(page.getByText(/^v1 · \d{4}-\d{2}-\d{2}/).first()).toBeVisible();

    await assignShiftInGrid(page, employee.name, 1, DAY_SHIFT_CODE, {
      confirmPublishedEdit: true,
    });
    await expect(page.locator('.ant-tag').filter({ hasText: '有未发布变更' })).toBeVisible();

    const beforeRepublish = await admin.getStaffSchedule(staffToken, WEEK_E2E_05);
    expect(beforeRepublish.version).toBe(1);
    const tuesdayBefore = beforeRepublish.days.find((day) => day.workDate === tuesday);
    expect(tuesdayBefore?.shift).toBeNull();

    await publishCurrentPeriod(page);
    await expect(page.getByText(/^v2 · \d{4}-\d{2}-\d{2}/).first()).toBeVisible();

    const afterRepublish = await admin.getStaffSchedule(staffToken, WEEK_E2E_05);
    expect(afterRepublish.version).toBe(2);
    const tuesdayAfter = afterRepublish.days.find((day) => day.workDate === tuesday);
    expect(tuesdayAfter?.shift?.code).toBe(DAY_SHIFT_CODE);
  });

  test('E2E-06 发布成功后复制通知文案含周期信息', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    const period = await admin.createPeriod(WEEK_E2E_06);
    await admin.upsertEntries(period.id, [
      { employeeId: employee.id, workDate: WEEK_E2E_06, shiftTypeId: dayShift.id },
    ]);

    await prepareSchedulePage(page, WEEK_E2E_06);
    const publishDialog = await openPublishDialog(page);
    await confirmPublishDialog(publishDialog);

    const notificationText = await readNotificationText(page);
    expect(notificationText).toContain('【心内科】');
    expect(notificationText).toContain(formatWeekRange(WEEK_E2E_06));
    expect(notificationText).toContain('班表已更新');
    expect(notificationText).toContain('第 1 版');
    expect(notificationText).toContain('发布时间');

    await copyNotificationText(page);
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    const normalizeText = (text: string) =>
      text
        .split('\n')
        .map((line) => line.trim())
        .join('\n')
        .trim();
    expect(normalizeText(clipboardText)).toBe(normalizeText(notificationText));

    await dismissPublishSuccessDialog(page);
  });
});

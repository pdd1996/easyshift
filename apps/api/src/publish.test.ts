import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { createApp } from './app.js';
import { db } from './db/index.js';
import { schedulePublishSnapshots } from './db/schema/index.js';
import { adminHeaders, loginAsAdmin } from './test/helpers.js';
import {
  cleanupTestEmployees,
  cleanupTestPeriods,
  cleanupTestShiftTypes,
  ensureTestFixtures,
  isDatabaseAvailable,
} from './test/seed-test.js';
import { eq } from 'drizzle-orm';

const dbAvailable = await isDatabaseAvailable();
const skipDbTests = process.env.SKIP_DB_TESTS === 'true';

describe.skipIf(skipDbTests && !dbAvailable)('publish API (AC-07)', () => {
  const app = createApp();
  let cookie = '';
  const createdPeriodIds: number[] = [];
  const createdEmployeeIds: number[] = [];
  const createdShiftTypeIds: number[] = [];
  const runSuffix = Date.now().toString().slice(-6);
  const weekStart = '2026-07-06';

  let employeeId = 0;
  let shiftTypeId = 0;
  let periodId = 0;

  beforeAll(async () => {
    if (!dbAvailable) {
      throw new Error(
        'publish API 集成测试需要可用的 easyshift_test 数据库，或显式设置 SKIP_DB_TESTS=true',
      );
    }

    const fixtures = await ensureTestFixtures();
    cookie = await loginAsAdmin(app, fixtures.adminPhone, fixtures.adminPassword);

    const employeeRes = await app.request('/api/v1/employees', {
      method: 'POST',
      headers: adminHeaders(cookie),
      body: JSON.stringify({
        employeeNo: `P${runSuffix}`,
        name: '发布测试员工',
        title: '护士',
        phone: `13800${runSuffix}`,
      }),
    });
    const employeeBody = (await employeeRes.json()) as { data: { id: number } };
    employeeId = employeeBody.data.id;
    createdEmployeeIds.push(employeeId);

    const shiftTypeRes = await app.request('/api/v1/shift-types', {
      method: 'POST',
      headers: adminHeaders(cookie),
      body: JSON.stringify({
        code: `P${runSuffix}`,
        name: '发布测试白班',
        startTime: '08:00:00',
        durationMinutes: 480,
        color: '#4CAF50',
        minRequiredCount: 2,
        sortOrder: 60,
      }),
    });
    const shiftTypeBody = (await shiftTypeRes.json()) as { data: { id: number } };
    shiftTypeId = shiftTypeBody.data.id;
    createdShiftTypeIds.push(shiftTypeId);

    const periodRes = await app.request('/api/v1/schedule/periods', {
      method: 'POST',
      headers: adminHeaders(cookie),
      body: JSON.stringify({ weekStart }),
    });
    const periodBody = (await periodRes.json()) as { data: { id: number } };
    periodId = periodBody.data.id;
    createdPeriodIds.push(periodId);
  });

  afterAll(async () => {
    await cleanupTestPeriods(createdPeriodIds);
    await cleanupTestShiftTypes(createdShiftTypeIds);
    await cleanupTestEmployees(createdEmployeeIds);
  });

  it('returns validation warnings without blocking', async () => {
    const res = await app.request(`/api/v1/schedule/periods/${periodId}/validation`, {
      headers: adminHeaders(cookie),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { errors: unknown[]; warnings: Array<{ code: string }> };
    };
    expect(body.data.errors).toHaveLength(0);
    expect(body.data.warnings.some((warning) => warning.code === 'COVERAGE_BELOW_MIN')).toBe(true);
  });

  it('requires acknowledgeWarnings when coverage warnings exist', async () => {
    const res = await app.request(`/api/v1/schedule/periods/${periodId}/publish`, {
      method: 'POST',
      headers: adminHeaders(cookie),
      body: JSON.stringify({ acknowledgeWarnings: false }),
    });

    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('UNACKNOWLEDGED_WARNINGS');
  });

  it('treats an empty optional JSON body as default publish options', async () => {
    const res = await app.request(`/api/v1/schedule/periods/${periodId}/publish`, {
      method: 'POST',
      headers: adminHeaders(cookie),
    });

    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('UNACKNOWLEDGED_WARNINGS');
  });

  it('[s2] publishes draft period and increments latestPublishedVersion (AC-07)', async () => {
    const res = await app.request(`/api/v1/schedule/periods/${periodId}/publish`, {
      method: 'POST',
      headers: adminHeaders(cookie),
      body: JSON.stringify({ acknowledgeWarnings: true }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { version: number; publishedAt: string; notificationText: string };
    };
    expect(body.data.version).toBe(1);
    expect(body.data.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+08:00$/);
    expect(body.data.notificationText).toContain('班表已更新');
    expect(body.data.notificationText).toContain('第 1 版');

    const periodRes = await app.request(`/api/v1/schedule/periods/${periodId}`, {
      headers: adminHeaders(cookie),
    });
    const periodBody = (await periodRes.json()) as {
      data: {
        editStatus: string;
        hasUnpublishedChanges: boolean;
        latestPublishedVersion: number | null;
        lastPublishedAt: string | null;
      };
    };
    expect(periodBody.data.editStatus).toBe('published');
    expect(periodBody.data.hasUnpublishedChanges).toBe(false);
    expect(periodBody.data.latestPublishedVersion).toBe(1);
    expect(periodBody.data.lastPublishedAt).not.toBeNull();

    const snapshots = await db
      .select()
      .from(schedulePublishSnapshots)
      .where(eq(schedulePublishSnapshots.periodId, periodId));
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]!.version).toBe(1);
    expect(snapshots[0]!.snapshotData).toMatchObject({
      meta: {
        weekStart,
        version: 1,
      },
      entries: [],
    });
  });

  it('rejects republish when there are no unpublished changes', async () => {
    const res = await app.request(`/api/v1/schedule/periods/${periodId}/publish`, {
      method: 'POST',
      headers: adminHeaders(cookie),
      body: JSON.stringify({ acknowledgeWarnings: true }),
    });

    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('NOTHING_TO_PUBLISH');
  });

  it('republishes after edit and increments version to 2', async () => {
    const saveRes = await app.request(`/api/v1/schedule/periods/${periodId}/entries`, {
      method: 'PUT',
      headers: adminHeaders(cookie),
      body: JSON.stringify({
        entries: [{ employeeId, workDate: weekStart, shiftTypeId, note: null }],
      }),
    });
    expect(saveRes.status).toBe(200);

    const periodRes = await app.request(`/api/v1/schedule/periods/${periodId}`, {
      headers: adminHeaders(cookie),
    });
    const periodBody = (await periodRes.json()) as { data: { hasUnpublishedChanges: boolean } };
    expect(periodBody.data.hasUnpublishedChanges).toBe(true);

    const res = await app.request(`/api/v1/schedule/periods/${periodId}/publish`, {
      method: 'POST',
      headers: adminHeaders(cookie),
      body: JSON.stringify({ acknowledgeWarnings: true }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { version: number } };
    expect(body.data.version).toBe(2);

    const gridRes = await app.request(`/api/v1/schedule/periods/${periodId}/grid`, {
      headers: adminHeaders(cookie),
    });
    const gridBody = (await gridRes.json()) as {
      data: {
        period: {
          latestPublishedVersion: number | null;
          hasUnpublishedChanges: boolean;
        };
      };
    };
    expect(gridBody.data.period.latestPublishedVersion).toBe(2);
    expect(gridBody.data.period.hasUnpublishedChanges).toBe(false);

    const snapshots = await db
      .select()
      .from(schedulePublishSnapshots)
      .where(eq(schedulePublishSnapshots.periodId, periodId));
    expect(snapshots.map((snapshot) => snapshot.version).sort()).toEqual([1, 2]);
    expect(snapshots.find((snapshot) => snapshot.version === 2)!.snapshotData).toMatchObject({
      meta: {
        weekStart,
        version: 2,
      },
      entries: [{ employeeId, workDate: weekStart, shiftTypeId, note: null }],
    });
  });
});

import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { createApp } from './app.js';
import { addDays } from './services/schedule/date-utils.js';
import { adminHeaders, loginAsAdmin } from './test/helpers.js';
import {
  cleanupTestEmployees,
  cleanupTestPeriods,
  cleanupTestShiftTypes,
  ensureTestFixtures,
  isDatabaseAvailable,
} from './test/seed-test.js';

const dbAvailable = await isDatabaseAvailable();
const skipDbTests = process.env.SKIP_DB_TESTS === 'true';

describe.skipIf(skipDbTests && !dbAvailable)('schedule copy API (AC-04)', () => {
  const app = createApp();
  let cookie = '';
  const createdPeriodIds: number[] = [];
  const createdEmployeeIds: number[] = [];
  const createdShiftTypeIds: number[] = [];
  const runId = Date.now();
  const runSuffix = runId.toString().slice(-6);
  const sourceWeekStart = addDays('2027-01-04', (runId % 1000) * 14);
  const targetWeekStart = addDays(sourceWeekStart, 7);
  const sourceWorkDates = [sourceWeekStart, addDays(sourceWeekStart, 1), addDays(sourceWeekStart, 2)];
  const targetWorkDates = [targetWeekStart, addDays(targetWeekStart, 1), addDays(targetWeekStart, 2)];

  let employeeId = 0;
  let shiftTypeId = 0;
  let sourcePeriodId = 0;
  let targetPeriodId = 0;

  beforeAll(async () => {
    if (!dbAvailable) {
      throw new Error(
        'schedule copy API 集成测试需要可用的 easyshift_test 数据库，或显式设置 SKIP_DB_TESTS=true',
      );
    }

    const fixtures = await ensureTestFixtures();
    cookie = await loginAsAdmin(app, fixtures.adminPhone, fixtures.adminPassword);

    const employeeRes = await app.request('/api/v1/employees', {
      method: 'POST',
      headers: adminHeaders(cookie),
      body: JSON.stringify({
        employeeNo: `C${runSuffix}`,
        name: '复制测试员工',
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
        code: `C${runSuffix}`,
        name: '复制测试白班',
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

    const sourcePeriodRes = await app.request('/api/v1/schedule/periods', {
      method: 'POST',
      headers: adminHeaders(cookie),
      body: JSON.stringify({ weekStart: sourceWeekStart }),
    });
    const sourcePeriodBody = (await sourcePeriodRes.json()) as { data: { id: number } };
    sourcePeriodId = sourcePeriodBody.data.id;
    createdPeriodIds.push(sourcePeriodId);

    const targetPeriodRes = await app.request('/api/v1/schedule/periods', {
      method: 'POST',
      headers: adminHeaders(cookie),
      body: JSON.stringify({ weekStart: targetWeekStart }),
    });
    const targetPeriodBody = (await targetPeriodRes.json()) as { data: { id: number } };
    targetPeriodId = targetPeriodBody.data.id;
    createdPeriodIds.push(targetPeriodId);

    await app.request(`/api/v1/schedule/periods/${sourcePeriodId}/entries`, {
      method: 'PUT',
      headers: adminHeaders(cookie),
      body: JSON.stringify({
        entries: [
          { employeeId, workDate: sourceWeekStart, shiftTypeId, note: '周一' },
          { employeeId, workDate: sourceWorkDates[1]!, shiftTypeId, note: '周二' },
          { employeeId, workDate: sourceWorkDates[2]!, shiftTypeId, note: '周三' },
        ],
      }),
    });
  });

  afterAll(async () => {
    await cleanupTestPeriods(createdPeriodIds);
    await cleanupTestShiftTypes(createdShiftTypeIds);
    await cleanupTestEmployees(createdEmployeeIds);
  });

  it('[s1] copies source week draft entries to target week with +7 day mapping (AC-04)', async () => {
    const res = await app.request(
      `/api/v1/schedule/periods/${targetPeriodId}/copy-from-previous-week`,
      {
        method: 'POST',
        headers: adminHeaders(cookie),
      },
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        sourceWeekStart: string;
        copiedCount: number;
        entries: Array<{ employeeId: number; workDate: string; shiftTypeId: number; note: string | null }>;
      };
    };

    expect(body.data.sourceWeekStart).toBe(sourceWeekStart);
    expect(body.data.copiedCount).toBe(3);
    expect(body.data.entries).toHaveLength(3);
    expect(body.data.entries.map((entry) => entry.workDate).sort()).toEqual(targetWorkDates);

    const gridRes = await app.request(`/api/v1/schedule/periods/${targetPeriodId}/grid`, {
      headers: adminHeaders(cookie),
    });
    const gridBody = (await gridRes.json()) as {
      data: { entries: Array<{ workDate: string; note: string | null }> };
    };
    expect(gridBody.data.entries).toHaveLength(3);
  });

  it('[s2] overwrites existing target week draft when copying (WEB-SCH-07)', async () => {
    for (const workDate of targetWorkDates) {
      await app.request(`/api/v1/schedule/periods/${targetPeriodId}/entries`, {
        method: 'DELETE',
        headers: adminHeaders(cookie),
        body: JSON.stringify({ employeeId, workDate }),
      });
    }

    await app.request(`/api/v1/schedule/periods/${targetPeriodId}/entries`, {
      method: 'PUT',
      headers: adminHeaders(cookie),
      body: JSON.stringify({
        entries: [{ employeeId, workDate: targetWeekStart, shiftTypeId, note: '将被覆盖' }],
      }),
    });

    const gridBeforeRes = await app.request(`/api/v1/schedule/periods/${targetPeriodId}/grid`, {
      headers: adminHeaders(cookie),
    });
    const gridBefore = (await gridBeforeRes.json()) as { data: { entries: unknown[] } };
    expect(gridBefore.data.entries).toHaveLength(1);

    const copyRes = await app.request(
      `/api/v1/schedule/periods/${targetPeriodId}/copy-from-previous-week`,
      {
        method: 'POST',
        headers: adminHeaders(cookie),
      },
    );
    expect(copyRes.status).toBe(200);

    const gridAfterRes = await app.request(`/api/v1/schedule/periods/${targetPeriodId}/grid`, {
      headers: adminHeaders(cookie),
    });
    const gridAfter = (await gridAfterRes.json()) as {
      data: { entries: Array<{ workDate: string; note: string | null }> };
    };

    expect(gridAfter.data.entries).toHaveLength(3);
    expect(gridAfter.data.entries.some((entry) => entry.note === '将被覆盖')).toBe(false);
    expect(gridAfter.data.entries.some((entry) => entry.workDate === targetWeekStart && entry.note === '周一')).toBe(
      true,
    );
  });

  it('returns 404 when source week period does not exist', async () => {
    const orphanRes = await app.request('/api/v1/schedule/periods', {
      method: 'POST',
      headers: adminHeaders(cookie),
      body: JSON.stringify({ weekStart: '2026-07-06' }),
    });
    const orphanBody = (await orphanRes.json()) as { data: { id: number } };
    createdPeriodIds.push(orphanBody.data.id);

    const res = await app.request(
      `/api/v1/schedule/periods/${orphanBody.data.id}/copy-from-previous-week`,
      {
        method: 'POST',
        headers: adminHeaders(cookie),
      },
    );

    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('NOT_FOUND');
  });
});

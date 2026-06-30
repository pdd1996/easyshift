import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { createApp } from './app.js';
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

describe.skipIf(skipDbTests && !dbAvailable)('schedule API', () => {
  const app = createApp();
  let cookie = '';
  const createdPeriodIds: number[] = [];
  const createdEmployeeIds: number[] = [];
  const createdShiftTypeIds: number[] = [];
  const runSuffix = Date.now().toString().slice(-6);
  const weekStart = '2026-06-22';
  const workDate = weekStart;

  let employeeId = 0;
  let shiftTypeId = 0;
  let periodId = 0;

  beforeAll(async () => {
    if (!dbAvailable) {
      throw new Error(
        'schedule API 集成测试需要可用的 easyshift_test 数据库，或显式设置 SKIP_DB_TESTS=true',
      );
    }

    const fixtures = await ensureTestFixtures();
    cookie = await loginAsAdmin(app, fixtures.adminPhone, fixtures.adminPassword);

    const employeeRes = await app.request('/api/v1/employees', {
      method: 'POST',
      headers: adminHeaders(cookie),
      body: JSON.stringify({
        employeeNo: `S${runSuffix}`,
        name: '排班测试员工',
        title: '护士',
        phone: `13900${runSuffix}`,
      }),
    });
    const employeeBody = (await employeeRes.json()) as { data: { id: number } };
    employeeId = employeeBody.data.id;
    createdEmployeeIds.push(employeeId);

    const shiftTypeRes = await app.request('/api/v1/shift-types', {
      method: 'POST',
      headers: adminHeaders(cookie),
      body: JSON.stringify({
        code: `S${runSuffix}`,
        name: '排班测试白班',
        kind: 'day',
        startTime: '08:00:00',
        durationMinutes: 480,
        color: '#4CAF50',
        minRequiredCount: 2,
        sortOrder: 50,
      }),
    });
    const shiftTypeBody = (await shiftTypeRes.json()) as { data: { id: number } };
    shiftTypeId = shiftTypeBody.data.id;
    createdShiftTypeIds.push(shiftTypeId);
  });

  afterAll(async () => {
    await cleanupTestPeriods(createdPeriodIds);
    await cleanupTestShiftTypes(createdShiftTypeIds);
    await cleanupTestEmployees(createdEmployeeIds);
  });

  it('[i3] creates a schedule period for Monday weekStart', async () => {
    const res = await app.request('/api/v1/schedule/periods', {
      method: 'POST',
      headers: adminHeaders(cookie),
      body: JSON.stringify({ weekStart }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      data: { id: number; weekStart: string; editStatus: string };
    };
    periodId = body.data.id;
    createdPeriodIds.push(periodId);
    expect(body.data.weekStart).toBe(weekStart);
    expect(body.data.editStatus).toBe('draft');
  });

  it('returns existing period when weekStart already exists', async () => {
    const res = await app.request('/api/v1/schedule/periods', {
      method: 'POST',
      headers: adminHeaders(cookie),
      body: JSON.stringify({ weekStart }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { id: number } };
    expect(body.data.id).toBe(periodId);
  });

  it('rejects non-Monday weekStart', async () => {
    const res = await app.request('/api/v1/schedule/periods', {
      method: 'POST',
      headers: adminHeaders(cookie),
      body: JSON.stringify({ weekStart: '2026-06-23' }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('lists schedule periods in week range', async () => {
    const res = await app.request(
      `/api/v1/schedule/periods?fromWeekStart=${weekStart}&toWeekStart=${weekStart}`,
      {
        headers: adminHeaders(cookie),
      },
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ id: number; weekStart: string }> };
    expect(body.data.some((period) => period.id === periodId)).toBe(true);
  });

  it('[r1] returns schedule grid with employees and dailyCoverage', async () => {
    const res = await app.request(`/api/v1/schedule/periods/${periodId}/grid`, {
      headers: adminHeaders(cookie),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        period: { id: number; weekStart: string };
        employees: Array<{ id: number }>;
        shiftTypes: Array<{ id: number }>;
        entries: unknown[];
        dailyCoverage: Array<{
          workDate: string;
          byShiftType: Array<{ assignedCount: number; minRequiredCount: number }>;
        }>;
      };
    };

    expect(body.data.period.id).toBe(periodId);
    expect(body.data.employees.some((employee) => employee.id === employeeId)).toBe(true);
    expect(body.data.shiftTypes.some((shiftType) => shiftType.id === shiftTypeId)).toBe(true);
    expect(body.data.dailyCoverage).toHaveLength(7);
    expect(body.data.dailyCoverage[0]!.workDate).toBe(weekStart);
  });

  it('[i1] saves a schedule cell', async () => {
    const res = await app.request(`/api/v1/schedule/periods/${periodId}/entries`, {
      method: 'PUT',
      headers: adminHeaders(cookie),
      body: JSON.stringify({
        entries: [
          {
            employeeId,
            workDate,
            shiftTypeId,
            note: null,
          },
        ],
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: Array<{ employeeId: number; workDate: string; shiftTypeId: number }>;
    };
    expect(body.data).toHaveLength(1);
    expect(body.data[0]!.employeeId).toBe(employeeId);
    expect(body.data[0]!.shiftTypeId).toBe(shiftTypeId);
  });

  it('[r4] reports dailyCoverage after saving a cell (AC-06)', async () => {
    const res = await app.request(`/api/v1/schedule/periods/${periodId}/grid`, {
      headers: adminHeaders(cookie),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        entries: unknown[];
        dailyCoverage: Array<{
          workDate: string;
          byShiftType: Array<{
            shiftTypeId: number;
            assignedCount: number;
            minRequiredCount: number;
          }>;
        }>;
        warnings: Array<{ code: string; workDate?: string }>;
      };
    };

    expect(body.data.entries).toHaveLength(1);
    const mondayCoverage = body.data.dailyCoverage.find((day) => day.workDate === workDate);
    const shiftCoverage = mondayCoverage!.byShiftType.find((item) => item.shiftTypeId === shiftTypeId);
    expect(shiftCoverage!.assignedCount).toBe(1);
    expect(shiftCoverage!.minRequiredCount).toBe(2);
    expect(
      body.data.warnings.some(
        (warning) => warning.code === 'COVERAGE_BELOW_MIN' && warning.workDate === workDate,
      ),
    ).toBe(true);
  });

  it('returns 409 when batch contains duplicate employee/day cells', async () => {
    const res = await app.request(`/api/v1/schedule/periods/${periodId}/entries`, {
      method: 'PUT',
      headers: adminHeaders(cookie),
      body: JSON.stringify({
        entries: [
          { employeeId, workDate, shiftTypeId, note: null },
          { employeeId, workDate, shiftTypeId, note: null },
        ],
      }),
    });

    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('SCHEDULE_ENTRY_CONFLICT');
  });

  it('rejects assigning inactive shift types to new cells', async () => {
    const deactivateRes = await app.request(`/api/v1/shift-types/${shiftTypeId}/deactivate`, {
      method: 'POST',
      headers: adminHeaders(cookie),
    });
    expect(deactivateRes.status).toBe(200);

    const res = await app.request(`/api/v1/schedule/periods/${periodId}/entries`, {
      method: 'PUT',
      headers: adminHeaders(cookie),
      body: JSON.stringify({
        entries: [
          {
            employeeId,
            workDate: '2026-06-23',
            shiftTypeId,
            note: null,
          },
        ],
      }),
    });

    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('BUSINESS_RULE_VIOLATION');
    expect(body.error.message).toBe('停用班次不可新排班');
  });

  it('keeps inactive shift types visible but excludes them from coverage warnings', async () => {
    const res = await app.request(`/api/v1/schedule/periods/${periodId}/grid`, {
      headers: adminHeaders(cookie),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        shiftTypes: Array<{ id: number; status: string }>;
        entries: Array<{ shiftTypeId: number }>;
        dailyCoverage: Array<{
          byShiftType: Array<{ shiftTypeId: number }>;
        }>;
        warnings: Array<{ shiftTypeId?: number }>;
      };
    };

    expect(body.data.shiftTypes.some((shiftType) => shiftType.id === shiftTypeId && shiftType.status === 'inactive')).toBe(
      true,
    );
    expect(body.data.entries.some((entry) => entry.shiftTypeId === shiftTypeId)).toBe(true);
    expect(
      body.data.dailyCoverage.every((day) =>
        day.byShiftType.every((coverage) => coverage.shiftTypeId !== shiftTypeId),
      ),
    ).toBe(true);
    expect(body.data.warnings.every((warning) => warning.shiftTypeId !== shiftTypeId)).toBe(true);
  });

  it('[i2] clears a schedule cell', async () => {
    const res = await app.request(`/api/v1/schedule/periods/${periodId}/entries`, {
      method: 'DELETE',
      headers: adminHeaders(cookie),
      body: JSON.stringify({
        employeeId,
        workDate,
      }),
    });

    expect(res.status).toBe(204);

    const gridRes = await app.request(`/api/v1/schedule/periods/${periodId}/grid`, {
      headers: adminHeaders(cookie),
    });
    const gridBody = (await gridRes.json()) as { data: { entries: unknown[] } };
    expect(gridBody.data.entries).toHaveLength(0);
  });

  it('[log1] lists department change logs with pagination and filters', async () => {
    const listRes = await app.request('/api/v1/schedule/change-logs?page=1&pageSize=20', {
      headers: adminHeaders(cookie),
    });

    expect(listRes.status).toBe(200);
    const listBody = (await listRes.json()) as {
      data: Array<{
        id: number;
        periodId: number;
        weekStart: string;
        action: string;
        operator: { id: number; phone: string | null };
      }>;
      meta: { page: number; pageSize: number; total: number };
    };

    expect(listBody.meta.page).toBe(1);
    expect(listBody.meta.pageSize).toBe(20);
    expect(listBody.meta.total).toBeGreaterThanOrEqual(2);
    expect(listBody.data.some((log) => log.periodId === periodId)).toBe(true);

    const periodRes = await app.request(
      `/api/v1/schedule/change-logs?periodId=${periodId}&page=1&pageSize=20`,
      { headers: adminHeaders(cookie) },
    );
    expect(periodRes.status).toBe(200);
    const periodBody = (await periodRes.json()) as {
      data: Array<{ periodId: number; weekStart: string; action: string }>;
    };
    expect(periodBody.data.some((log) => log.action === 'entry_upsert')).toBe(true);
    expect(periodBody.data.some((log) => log.action === 'entry_delete')).toBe(true);
    expect(periodBody.data.every((log) => log.periodId === periodId)).toBe(true);
    expect(periodBody.data.every((log) => log.weekStart === weekStart)).toBe(true);

    const actionRes = await app.request(
      `/api/v1/schedule/change-logs?periodId=${periodId}&action=entry_delete`,
      { headers: adminHeaders(cookie) },
    );
    expect(actionRes.status).toBe(200);
    const actionBody = (await actionRes.json()) as { data: Array<{ action: string }> };
    expect(actionBody.data.length).toBeGreaterThan(0);
    expect(actionBody.data.every((log) => log.action === 'entry_delete')).toBe(true);

    const optionsRes = await app.request('/api/v1/schedule/change-logs/filter-options', {
      headers: adminHeaders(cookie),
    });
    expect(optionsRes.status).toBe(200);
    const optionsBody = (await optionsRes.json()) as {
      data: { operators: unknown[]; periods: unknown[]; actions: string[] };
    };
    expect(optionsBody.data.actions).toContain('entry_upsert');
    expect(optionsBody.data.periods.length).toBeGreaterThan(0);
  });

  it('[log1] returns 404 when filtering by unknown periodId', async () => {
    const res = await app.request('/api/v1/schedule/change-logs?periodId=999999999', {
      headers: adminHeaders(cookie),
    });
    expect(res.status).toBe(404);
  });
});

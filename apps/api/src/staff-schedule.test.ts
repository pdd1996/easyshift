import { weekStartFromDate } from '@easyshift/shared-types';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { createApp } from './app.js';
import { adminHeaders, loginAsAdmin, staffHeaders } from './test/helpers.js';
import {
  cleanupTestEmployees,
  cleanupTestPeriods,
  cleanupTestShiftTypes,
  cleanupTestStaffUsers,
  createStaffUserForEmployee,
  createStaffUserWithoutEmployee,
  ensureTestFixtures,
  isDatabaseAvailable,
} from './test/seed-test.js';

const dbAvailable = await isDatabaseAvailable();
const skipDbTests = process.env.SKIP_DB_TESTS === 'true';

describe.skipIf(skipDbTests && !dbAvailable)('staff schedule API (AC-11, AC-12)', () => {
  const app = createApp();
  let adminCookie = '';
  const createdPeriodIds: number[] = [];
  const createdEmployeeIds: number[] = [];
  const createdShiftTypeIds: number[] = [];
  const createdStaffUserIds: number[] = [];
  const runSuffix = Date.now().toString().slice(-6);
  const weekStart = '2026-07-13';
  const emptyWeekStart = '2026-01-05';

  let employeeAId = 0;
  let employeeBId = 0;
  let shiftTypeId = 0;
  let offShiftTypeId = 0;
  let periodId = 0;
  let staffTokenA = '';
  let staffTokenB = '';

  beforeAll(async () => {
    if (!dbAvailable) {
      throw new Error(
        'staff schedule API 集成测试需要可用的 easyshift_test 数据库，或显式设置 SKIP_DB_TESTS=true',
      );
    }

    const fixtures = await ensureTestFixtures();
    adminCookie = await loginAsAdmin(app, fixtures.adminPhone, fixtures.adminPassword);

    const employeeARes = await app.request('/api/v1/employees', {
      method: 'POST',
      headers: adminHeaders(adminCookie),
      body: JSON.stringify({
        employeeNo: `SA${runSuffix}`,
        name: '员工A',
        title: '护士',
        phone: `13801${runSuffix}`,
      }),
    });
    const employeeABody = (await employeeARes.json()) as { data: { id: number } };
    employeeAId = employeeABody.data.id;
    createdEmployeeIds.push(employeeAId);

    const employeeBRes = await app.request('/api/v1/employees', {
      method: 'POST',
      headers: adminHeaders(adminCookie),
      body: JSON.stringify({
        employeeNo: `SB${runSuffix}`,
        name: '员工B',
        title: '护士',
        phone: `13802${runSuffix}`,
      }),
    });
    const employeeBBody = (await employeeBRes.json()) as { data: { id: number } };
    employeeBId = employeeBBody.data.id;
    createdEmployeeIds.push(employeeBId);

    const staffA = await createStaffUserForEmployee(employeeAId);
    staffTokenA = staffA.token;
    createdStaffUserIds.push(staffA.userId);
    const staffB = await createStaffUserForEmployee(employeeBId);
    staffTokenB = staffB.token;
    createdStaffUserIds.push(staffB.userId);

    const shiftTypeRes = await app.request('/api/v1/shift-types', {
      method: 'POST',
      headers: adminHeaders(adminCookie),
      body: JSON.stringify({
        code: `SS${runSuffix}`,
        name: '员工端白班',
        kind: 'day',
        startTime: '08:00:00',
        durationMinutes: 480,
        color: '#4CAF50',
        minRequiredCount: 1,
        sortOrder: 70,
      }),
    });
    const shiftTypeBody = (await shiftTypeRes.json()) as { data: { id: number } };
    shiftTypeId = shiftTypeBody.data.id;
    createdShiftTypeIds.push(shiftTypeId);

    const offShiftTypeRes = await app.request('/api/v1/shift-types', {
      method: 'POST',
      headers: adminHeaders(adminCookie),
      body: JSON.stringify({
        code: `OF${runSuffix}`,
        name: '休息',
        kind: 'off',
        startTime: null,
        durationMinutes: null,
        color: '#9E9E9E',
        minRequiredCount: 0,
        sortOrder: 71,
      }),
    });
    const offShiftTypeBody = (await offShiftTypeRes.json()) as { data: { id: number } };
    offShiftTypeId = offShiftTypeBody.data.id;
    createdShiftTypeIds.push(offShiftTypeId);

    const periodRes = await app.request('/api/v1/schedule/periods', {
      method: 'POST',
      headers: adminHeaders(adminCookie),
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
    await cleanupTestStaffUsers(createdStaffUserIds);
  });

  it('returns 400 when weekStart is not Monday', async () => {
    const res = await app.request('/api/v1/staff/schedule?weekStart=2026-07-14', {
      headers: staffHeaders(staffTokenA),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 403 when staff account is not bound to an employee', async () => {
    const unboundStaff = await createStaffUserWithoutEmployee();
    createdStaffUserIds.push(unboundStaff.userId);

    const res = await app.request(`/api/v1/staff/schedule?weekStart=${weekStart}`, {
      headers: staffHeaders(unboundStaff.token),
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('[s1] returns not_published when period has no published snapshot (AC-11)', async () => {
    const res = await app.request(`/api/v1/staff/schedule?weekStart=${weekStart}`, {
      headers: staffHeaders(staffTokenA),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        weekStart: string;
        publishedAt: string | null;
        version: number | null;
        status?: string;
        days: unknown[];
      };
    };
    expect(body.data.weekStart).toBe(weekStart);
    expect(body.data.publishedAt).toBeNull();
    expect(body.data.version).toBeNull();
    expect(body.data.status).toBe('not_published');
    expect(body.data.days).toHaveLength(0);
  });

  it('returns not_published when no schedule period exists for the week', async () => {
    const res = await app.request(`/api/v1/staff/schedule?weekStart=${emptyWeekStart}`, {
      headers: staffHeaders(staffTokenA),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { weekStart: string; status?: string; days: unknown[] };
    };
    expect(body.data.weekStart).toBe(emptyWeekStart);
    expect(body.data.status).toBe('not_published');
    expect(body.data.days).toHaveLength(0);
  });

  it('[s2] returns published entries from latest snapshot only (AC-11, AC-12)', async () => {
    const saveRes = await app.request(`/api/v1/schedule/periods/${periodId}/entries`, {
      method: 'PUT',
      headers: adminHeaders(adminCookie),
      body: JSON.stringify({
        entries: [
          { employeeId: employeeAId, workDate: weekStart, shiftTypeId, note: '备注A' },
          { employeeId: employeeBId, workDate: weekStart, shiftTypeId, note: null },
        ],
      }),
    });
    expect(saveRes.status).toBe(200);

    const publishRes = await app.request(`/api/v1/schedule/periods/${periodId}/publish`, {
      method: 'POST',
      headers: adminHeaders(adminCookie),
      body: JSON.stringify({ acknowledgeWarnings: true }),
    });
    expect(publishRes.status).toBe(200);
    const publishBody = (await publishRes.json()) as {
      data: { version: number; publishedAt: string };
    };
    expect(publishBody.data.version).toBe(1);

    const res = await app.request(`/api/v1/staff/schedule?weekStart=${weekStart}`, {
      headers: staffHeaders(staffTokenA),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        weekStart: string;
        publishedAt: string;
        version: number;
        days: Array<{
          workDate: string;
          weekday: number;
          shift: {
            code: string;
            name: string;
            startTime: string;
            durationMinutes: number;
            color: string;
          } | null;
          note: string | null;
        }>;
      };
    };
    expect(body.data.weekStart).toBe(weekStart);
    expect(body.data.version).toBe(1);
    expect(body.data.publishedAt).toBe(publishBody.data.publishedAt);
    expect(body.data.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+08:00$/);
    expect(body.data.days).toHaveLength(7);

    const monday = body.data.days.find((day) => day.workDate === weekStart);
    expect(monday).toBeDefined();
    expect(monday!.weekday).toBe(1);
    expect(monday!.shift).toMatchObject({
      name: '员工端白班',
      startTime: '08:00:00',
      durationMinutes: 480,
      color: '#4CAF50',
    });
    expect(monday!.note).toBe('备注A');

    const tuesday = body.data.days.find((day) => day.workDate === '2026-07-14');
    expect(tuesday).toBeDefined();
    expect(tuesday!.shift).toBeNull();
  });

  it('returns only employee A entries for employee A token (AC-13)', async () => {
    const res = await app.request(`/api/v1/staff/schedule?weekStart=${weekStart}`, {
      headers: staffHeaders(staffTokenA),
    });

    expect(res.status).toBe(200);
    const bodyA = (await res.json()) as {
      data: { days: Array<{ workDate: string; shift: unknown; note: string | null }> };
    };
    const assignedDaysA = bodyA.data.days.filter((day) => day.shift !== null);
    expect(assignedDaysA).toHaveLength(1);
    expect(assignedDaysA[0]!.note).toBe('备注A');

    const resB = await app.request(`/api/v1/staff/schedule?weekStart=${weekStart}`, {
      headers: staffHeaders(staffTokenB),
    });
    const bodyB = (await resB.json()) as {
      data: { days: Array<{ workDate: string; shift: unknown; note: string | null }> };
    };
    const assignedDaysB = bodyB.data.days.filter((day) => day.shift !== null);
    expect(assignedDaysB).toHaveLength(1);
    expect(assignedDaysB[0]!.note).toBeNull();
  });

  it('still reads v1 snapshot after admin edits without republish (AC-08)', async () => {
    const saveRes = await app.request(`/api/v1/schedule/periods/${periodId}/entries`, {
      method: 'PUT',
      headers: adminHeaders(adminCookie),
      body: JSON.stringify({
        entries: [
          { employeeId: employeeAId, workDate: weekStart, shiftTypeId, note: '草稿修改' },
          { employeeId: employeeAId, workDate: '2026-07-14', shiftTypeId, note: null },
        ],
      }),
    });
    expect(saveRes.status).toBe(200);

    const res = await app.request(`/api/v1/staff/schedule?weekStart=${weekStart}`, {
      headers: staffHeaders(staffTokenA),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        version: number;
        days: Array<{ workDate: string; note: string | null; shift: unknown }>;
      };
    };
    expect(body.data.version).toBe(1);

    const monday = body.data.days.find((day) => day.workDate === weekStart);
    expect(monday!.note).toBe('备注A');

    const tuesday = body.data.days.find((day) => day.workDate === '2026-07-14');
    expect(tuesday!.shift).toBeNull();
  });

  it('returns v2 snapshot after republish (AC-08)', async () => {
    const publishRes = await app.request(`/api/v1/schedule/periods/${periodId}/publish`, {
      method: 'POST',
      headers: adminHeaders(adminCookie),
      body: JSON.stringify({ acknowledgeWarnings: true }),
    });
    expect(publishRes.status).toBe(200);
    const publishBody = (await publishRes.json()) as { data: { version: number } };
    expect(publishBody.data.version).toBe(2);

    const res = await app.request(`/api/v1/staff/schedule?weekStart=${weekStart}`, {
      headers: staffHeaders(staffTokenA),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        version: number;
        days: Array<{ workDate: string; note: string | null; shift: unknown }>;
      };
    };
    expect(body.data.version).toBe(2);

    const monday = body.data.days.find((day) => day.workDate === weekStart);
    expect(monday!.note).toBe('草稿修改');

    const tuesday = body.data.days.find((day) => day.workDate === '2026-07-14');
    expect(tuesday!.shift).not.toBeNull();
  });

  it('shows OFF shift explicitly instead of blank (MP-SCH-06)', async () => {
    const saveRes = await app.request(`/api/v1/schedule/periods/${periodId}/entries`, {
      method: 'PUT',
      headers: adminHeaders(adminCookie),
      body: JSON.stringify({
        entries: [
          { employeeId: employeeAId, workDate: weekStart, shiftTypeId, note: '草稿修改' },
          { employeeId: employeeAId, workDate: '2026-07-14', shiftTypeId, note: null },
          { employeeId: employeeAId, workDate: '2026-07-15', shiftTypeId: offShiftTypeId, note: null },
        ],
      }),
    });
    expect(saveRes.status).toBe(200);

    const publishRes = await app.request(`/api/v1/schedule/periods/${periodId}/publish`, {
      method: 'POST',
      headers: adminHeaders(adminCookie),
      body: JSON.stringify({ acknowledgeWarnings: true }),
    });
    expect(publishRes.status).toBe(200);

    const res = await app.request(`/api/v1/staff/schedule?weekStart=${weekStart}`, {
      headers: staffHeaders(staffTokenA),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        days: Array<{
          workDate: string;
          shift: { code: string; name: string } | null;
        }>;
      };
    };

    const wednesday = body.data.days.find((day) => day.workDate === '2026-07-15');
    expect(wednesday).toBeDefined();
    expect(wednesday!.shift).toMatchObject({ code: `OF${runSuffix}`, name: '休息' });

    const thursday = body.data.days.find((day) => day.workDate === '2026-07-16');
    expect(thursday!.shift).toBeNull();
  });

  it('defaults weekStart to current Shanghai week when query param is omitted (MP-SCH-01)', async () => {
    const currentWeekStart = weekStartFromDate(new Date());

    const res = await app.request('/api/v1/staff/schedule', {
      headers: staffHeaders(staffTokenA),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { weekStart: string; status?: string; version: number | null };
    };
    expect(body.data.weekStart).toBe(currentWeekStart);

    if (currentWeekStart === weekStart) {
      expect(body.data.version).toBe(3);
    } else {
      expect(body.data.status).toBe('not_published');
    }
  });
});

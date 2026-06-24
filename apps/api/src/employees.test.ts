import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { createApp } from './app.js';
import { adminHeaders, loginAsAdmin } from './test/helpers.js';
import {
  cleanupTestEmployees,
  ensureTestFixtures,
  isDatabaseAvailable,
} from './test/seed-test.js';

const dbAvailable = await isDatabaseAvailable();
const skipDbTests = process.env.SKIP_DB_TESTS === 'true';

describe.skipIf(skipDbTests && !dbAvailable)('employees API', () => {
  const app = createApp();
  let cookie = '';
  const createdEmployeeIds: number[] = [];
  const runSuffix = Date.now().toString().slice(-6);
  const primaryEmployeeNo = `T${runSuffix}`;
  const secondaryEmployeeNo = `T${runSuffix}2`;

  beforeAll(async () => {
    if (!dbAvailable) {
      throw new Error('employees API 集成测试需要可用的 easyshift_test 数据库，或显式设置 SKIP_DB_TESTS=true');
    }

    const fixtures = await ensureTestFixtures();
    cookie = await loginAsAdmin(app, fixtures.adminPhone, fixtures.adminPassword);
  });

  afterAll(async () => {
    await cleanupTestEmployees(createdEmployeeIds);
  });

  it('creates an employee', async () => {
    const res = await app.request('/api/v1/employees', {
      method: 'POST',
      headers: adminHeaders(cookie),
      body: JSON.stringify({
        employeeNo: primaryEmployeeNo,
        name: '张三',
        title: '护士',
        phone: '13900139001',
      }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      data: { id: number; employeeNo: string; name: string; status: string };
    };
    createdEmployeeIds.push(body.data.id);
    expect(body.data.employeeNo).toBe(primaryEmployeeNo);
    expect(body.data.name).toBe('张三');
    expect(body.data.status).toBe('active');
  });

  it('returns 409 when employee number is duplicated (AC-01)', async () => {
    const res = await app.request('/api/v1/employees', {
      method: 'POST',
      headers: adminHeaders(cookie),
      body: JSON.stringify({
        employeeNo: primaryEmployeeNo,
        name: '李四',
        phone: '13900139002',
      }),
    });

    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('EMPLOYEE_NO_DUPLICATE');
    expect(body.error.message).toBe('工号已存在');
  });

  it('lists employees with pagination', async () => {
    const res = await app.request('/api/v1/employees?page=1&pageSize=20', {
      headers: adminHeaders(cookie),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: Array<{ employeeNo: string }>;
      meta: { total: number; page: number; pageSize: number };
    };
    expect(body.meta.total).toBeGreaterThanOrEqual(1);
    expect(body.data.some((e) => e.employeeNo === primaryEmployeeNo)).toBe(true);
  });

  it('deactivates an employee', async () => {
    const listRes = await app.request('/api/v1/employees', {
      headers: adminHeaders(cookie),
    });
    const listBody = (await listRes.json()) as { data: Array<{ id: number; employeeNo: string }> };
    const employee = listBody.data.find((e) => e.employeeNo === primaryEmployeeNo);
    expect(employee).toBeDefined();

    const res = await app.request(`/api/v1/employees/${employee!.id}/deactivate`, {
      method: 'POST',
      headers: adminHeaders(cookie),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { status: string } };
    expect(body.data.status).toBe('inactive');
  });

  it('generates a binding code', async () => {
    const createRes = await app.request('/api/v1/employees', {
      method: 'POST',
      headers: adminHeaders(cookie),
      body: JSON.stringify({
        employeeNo: secondaryEmployeeNo,
        name: '王五',
        phone: '13900139003',
      }),
    });
    const createBody = (await createRes.json()) as { data: { id: number } };
    createdEmployeeIds.push(createBody.data.id);

    const res = await app.request(`/api/v1/employees/${createBody.data.id}/binding-code`, {
      method: 'POST',
      headers: adminHeaders(cookie),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { bindingCode: string; expiresAt: string };
    };
    expect(body.data.bindingCode).toMatch(/^[A-Z2-9]{6}$/);
    expect(body.data.expiresAt).toContain('+08:00');
  });
});

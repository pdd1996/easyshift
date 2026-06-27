import mysql from 'mysql2/promise';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { adminHeaders, loginAsAdmin, staffHeaders } from './test/helpers.js';
import {
  cleanupTestEmployees,
  cleanupTestStaffUsers,
  createStaffUserForEmployee,
  ensureTestFixtures,
  isDatabaseAvailable,
} from './test/seed-test.js';

const dbAvailable = await isDatabaseAvailable();
const skipDbTests = process.env.SKIP_DB_TESTS === 'true';

function miniProgramJsonHeaders(): Record<string, string> {
  return { 'Content-Type': 'application/json' };
}

async function generateBindingCode(
  app: ReturnType<typeof createApp>,
  cookie: string,
  employeeId: number,
): Promise<string> {
  const res = await app.request(`/api/v1/employees/${employeeId}/binding-code`, {
    method: 'POST',
    headers: adminHeaders(cookie),
  });
  expect(res.status).toBe(200);
  const body = (await res.json()) as { data: { bindingCode: string } };
  return body.data.bindingCode;
}

async function getActiveBindingCodeStatus(employeeId: number): Promise<string | null> {
  const connection = await mysql.createConnection(env.DATABASE_URL);
  try {
    const [rows] = await connection.execute(
      `SELECT status FROM employee_binding_codes
       WHERE employee_id = ?
       ORDER BY id DESC
       LIMIT 1`,
      [employeeId],
    );
    const list = rows as Array<{ status: string }>;
    return list[0]?.status ?? null;
  } finally {
    await connection.end();
  }
}

describe.skipIf(skipDbTests && !dbAvailable)('miniprogram binding API (AC-10)', () => {
  const app = createApp();
  let adminCookie = '';
  const createdEmployeeIds: number[] = [];
  const createdStaffUserIds: number[] = [];
  const runSuffix = Date.now().toString().slice(-6);

  let employeeId = 0;
  let employeePhone = '';
  let secondaryEmployeeId = 0;

  beforeAll(async () => {
    if (!dbAvailable) {
      throw new Error(
        'binding API 集成测试需要可用的 easyshift_test 数据库，或显式设置 SKIP_DB_TESTS=true',
      );
    }

    await ensureTestFixtures();
    adminCookie = await loginAsAdmin(app, '13800000000', env.SEED_ADMIN_PASSWORD);

    employeePhone = `13801${runSuffix}`;
    const createRes = await app.request('/api/v1/employees', {
      method: 'POST',
      headers: adminHeaders(adminCookie),
      body: JSON.stringify({
        employeeNo: `B${runSuffix}`,
        name: '绑定测试员工',
        title: '护士',
        phone: employeePhone,
      }),
    });
    const createBody = (await createRes.json()) as { data: { id: number } };
    employeeId = createBody.data.id;
    createdEmployeeIds.push(employeeId);

    const secondaryRes = await app.request('/api/v1/employees', {
      method: 'POST',
      headers: adminHeaders(adminCookie),
      body: JSON.stringify({
        employeeNo: `B${runSuffix}2`,
        name: '绑定测试员工二',
        phone: `13802${runSuffix}`,
      }),
    });
    const secondaryBody = (await secondaryRes.json()) as { data: { id: number } };
    secondaryEmployeeId = secondaryBody.data.id;
    createdEmployeeIds.push(secondaryEmployeeId);
  });

  afterAll(async () => {
    await cleanupTestStaffUsers(createdStaffUserIds);
    await cleanupTestEmployees(createdEmployeeIds);
  });

  it('[s1] 正确绑定码 + 手机号后四位 → 200，签发 Bearer Token', async () => {
    const bindingCode = await generateBindingCode(app, adminCookie, employeeId);
    const wxCode = `wx_bind_s1_${runSuffix}`;
    const phoneLastFour = employeePhone.slice(-4);

    const bindRes = await app.request('/api/v1/auth/miniprogram/bind', {
      method: 'POST',
      headers: miniProgramJsonHeaders(),
      body: JSON.stringify({ code: wxCode, bindingCode, phoneLastFour }),
    });

    expect(bindRes.status).toBe(200);
    const bindBody = (await bindRes.json()) as {
      data: {
        bound: boolean;
        token: string;
        expiresAt: string;
        employee: { id: number; name: string; employeeNo: string; departmentName: string };
      };
    };
    expect(bindBody.data.bound).toBe(true);
    expect(bindBody.data.token).toBeTruthy();
    expect(bindBody.data.expiresAt).toContain('+08:00');
    expect(bindBody.data.employee.id).toBe(employeeId);
    expect(bindBody.data.employee.name).toBe('绑定测试员工');

    const scheduleRes = await app.request('/api/v1/staff/schedule', {
      headers: staffHeaders(bindBody.data.token),
    });
    expect(scheduleRes.status).toBe(200);

    const loginRes = await app.request('/api/v1/auth/miniprogram/login', {
      method: 'POST',
      headers: miniProgramJsonHeaders(),
      body: JSON.stringify({ code: wxCode }),
    });
    expect(loginRes.status).toBe(200);
    const loginBody = (await loginRes.json()) as {
      data: { bound: boolean; token: string; employee: { id: number } };
    };
    expect(loginBody.data.bound).toBe(true);
    expect(loginBody.data.token).toBeTruthy();
    expect(loginBody.data.employee.id).toBe(employeeId);
  });

  it('[s2] 错误绑定码 → 422 + BINDING_CODE_INVALID', async () => {
    const wxCode = `wx_bind_s2_${runSuffix}`;

    const res = await app.request('/api/v1/auth/miniprogram/bind', {
      method: 'POST',
      headers: miniProgramJsonHeaders(),
      body: JSON.stringify({
        code: wxCode,
        bindingCode: 'ZZZZZZ',
        phoneLastFour: employeePhone.slice(-4),
      }),
    });

    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('BINDING_CODE_INVALID');
    expect(body.error.message).toContain('绑定码');
  });

  it('[s3] 手机号后四位不匹配 → 422 + PHONE_MISMATCH', async () => {
    const bindingCode = await generateBindingCode(app, adminCookie, secondaryEmployeeId);
    const wxCode = `wx_bind_s3_${runSuffix}`;

    const res = await app.request('/api/v1/auth/miniprogram/bind', {
      method: 'POST',
      headers: miniProgramJsonHeaders(),
      body: JSON.stringify({
        code: wxCode,
        bindingCode,
        phoneLastFour: '0000',
      }),
    });

    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('PHONE_MISMATCH');
  });

  it('[s4] 绑定成功后码 status=used', async () => {
    const tertiaryRes = await app.request('/api/v1/employees', {
      method: 'POST',
      headers: adminHeaders(adminCookie),
      body: JSON.stringify({
        employeeNo: `B${runSuffix}3`,
        name: '绑定测试员工三',
        phone: `13803${runSuffix}`,
      }),
    });
    const tertiaryBody = (await tertiaryRes.json()) as { data: { id: number } };
    const tertiaryEmployeeId = tertiaryBody.data.id;
    createdEmployeeIds.push(tertiaryEmployeeId);

    const bindingCode = await generateBindingCode(app, adminCookie, tertiaryEmployeeId);
    const wxCode = `wx_bind_s4_${runSuffix}`;

    const bindRes = await app.request('/api/v1/auth/miniprogram/bind', {
      method: 'POST',
      headers: miniProgramJsonHeaders(),
      body: JSON.stringify({
        code: wxCode,
        bindingCode,
        phoneLastFour: `13803${runSuffix}`.slice(-4),
      }),
    });
    expect(bindRes.status).toBe(200);

    const status = await getActiveBindingCodeStatus(tertiaryEmployeeId);
    expect(status).toBe('used');
  });

  it('[s5] 已绑定员工再次绑定 → 422 + ALREADY_BOUND', async () => {
    const bindingCode = await generateBindingCode(app, adminCookie, employeeId);
    const wxCode = `wx_bind_s5_${runSuffix}`;

    const res = await app.request('/api/v1/auth/miniprogram/bind', {
      method: 'POST',
      headers: miniProgramJsonHeaders(),
      body: JSON.stringify({
        code: wxCode,
        bindingCode,
        phoneLastFour: employeePhone.slice(-4),
      }),
    });

    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('ALREADY_BOUND');
  });

  it('[s6] 同一 openid 绑第二人 → 422 + ALREADY_BOUND', async () => {
    const bindingCode = await generateBindingCode(app, adminCookie, secondaryEmployeeId);
    const wxCode = `wx_bind_s1_${runSuffix}`;

    const res = await app.request('/api/v1/auth/miniprogram/bind', {
      method: 'POST',
      headers: miniProgramJsonHeaders(),
      body: JSON.stringify({
        code: wxCode,
        bindingCode,
        phoneLastFour: `13802${runSuffix}`.slice(-4),
      }),
    });

    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('ALREADY_BOUND');
  });

  it('login returns bound=false for unbound wx user', async () => {
    const res = await app.request('/api/v1/auth/miniprogram/login', {
      method: 'POST',
      headers: miniProgramJsonHeaders(),
      body: JSON.stringify({ code: `wx_unbound_${runSuffix}` }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { bound: boolean } };
    expect(body.data.bound).toBe(false);
    expect(body.data).not.toHaveProperty('token');
  });

  it('rejects binding code reuse after successful bind', async () => {
    const quaternaryRes = await app.request('/api/v1/employees', {
      method: 'POST',
      headers: adminHeaders(adminCookie),
      body: JSON.stringify({
        employeeNo: `B${runSuffix}4`,
        name: '绑定测试员工四',
        phone: `13804${runSuffix}`,
      }),
    });
    const quaternaryBody = (await quaternaryRes.json()) as { data: { id: number } };
    const quaternaryEmployeeId = quaternaryBody.data.id;
    createdEmployeeIds.push(quaternaryEmployeeId);

    const bindingCode = await generateBindingCode(app, adminCookie, quaternaryEmployeeId);
    const wxCodeFirst = `wx_bind_reuse_a_${runSuffix}`;
    const phoneLastFour = `13804${runSuffix}`.slice(-4);

    const firstBind = await app.request('/api/v1/auth/miniprogram/bind', {
      method: 'POST',
      headers: miniProgramJsonHeaders(),
      body: JSON.stringify({ code: wxCodeFirst, bindingCode, phoneLastFour }),
    });
    expect(firstBind.status).toBe(200);

    const wxCodeSecond = `wx_bind_reuse_b_${runSuffix}`;
    const secondBind = await app.request('/api/v1/auth/miniprogram/bind', {
      method: 'POST',
      headers: miniProgramJsonHeaders(),
      body: JSON.stringify({ code: wxCodeSecond, bindingCode, phoneLastFour }),
    });
    expect(secondBind.status).toBe(422);
    const body = (await secondBind.json()) as { error: { code: string } };
    expect(body.error.code).toBe('BINDING_CODE_INVALID');
  });

  it('allows only one concurrent bind attempt to consume a binding code', async () => {
    const concurrentRes = await app.request('/api/v1/employees', {
      method: 'POST',
      headers: adminHeaders(adminCookie),
      body: JSON.stringify({
        employeeNo: `B${runSuffix}6`,
        name: '并发绑定员工',
        phone: `13806${runSuffix}`,
      }),
    });
    const concurrentBody = (await concurrentRes.json()) as { data: { id: number } };
    const concurrentEmployeeId = concurrentBody.data.id;
    createdEmployeeIds.push(concurrentEmployeeId);

    const bindingCode = await generateBindingCode(app, adminCookie, concurrentEmployeeId);
    const phoneLastFour = `13806${runSuffix}`.slice(-4);

    const responses = await Promise.all([
      app.request('/api/v1/auth/miniprogram/bind', {
        method: 'POST',
        headers: miniProgramJsonHeaders(),
        body: JSON.stringify({
          code: `wx_bind_concurrent_a_${runSuffix}`,
          bindingCode,
          phoneLastFour,
        }),
      }),
      app.request('/api/v1/auth/miniprogram/bind', {
        method: 'POST',
        headers: miniProgramJsonHeaders(),
        body: JSON.stringify({
          code: `wx_bind_concurrent_b_${runSuffix}`,
          bindingCode,
          phoneLastFour,
        }),
      }),
    ]);

    expect(responses.map((res) => res.status).sort()).toEqual([200, 422]);
    const failed = responses.find((res) => res.status === 422);
    expect(failed).toBeDefined();
    const failedBody = (await failed!.json()) as { error: { code: string } };
    expect(['ALREADY_BOUND', 'BINDING_CODE_INVALID']).toContain(failedBody.error.code);
  });

  it('rejects staff token when employee was pre-bound via test helper', async () => {
    const preBoundRes = await app.request('/api/v1/employees', {
      method: 'POST',
      headers: adminHeaders(adminCookie),
      body: JSON.stringify({
        employeeNo: `B${runSuffix}5`,
        name: '预绑定员工',
        phone: `13805${runSuffix}`,
      }),
    });
    const preBoundBody = (await preBoundRes.json()) as { data: { id: number } };
    const preBoundEmployeeId = preBoundBody.data.id;
    createdEmployeeIds.push(preBoundEmployeeId);

    const staff = await createStaffUserForEmployee(preBoundEmployeeId);
    createdStaffUserIds.push(staff.userId);

    const bindingCode = await generateBindingCode(app, adminCookie, preBoundEmployeeId);
    const res = await app.request('/api/v1/auth/miniprogram/bind', {
      method: 'POST',
      headers: miniProgramJsonHeaders(),
      body: JSON.stringify({
        code: `wx_prebound_${runSuffix}`,
        bindingCode,
        phoneLastFour: `13805${runSuffix}`.slice(-4),
      }),
    });

    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('ALREADY_BOUND');
  });

  it('[s7] 解绑后旧 Token → 401', async () => {
    const unbindRes = await app.request('/api/v1/employees', {
      method: 'POST',
      headers: adminHeaders(adminCookie),
      body: JSON.stringify({
        employeeNo: `B${runSuffix}7`,
        name: '解绑测试员工',
        phone: `13807${runSuffix}`,
      }),
    });
    const unbindBody = (await unbindRes.json()) as { data: { id: number } };
    const unbindEmployeeId = unbindBody.data.id;
    createdEmployeeIds.push(unbindEmployeeId);

    const bindingCode = await generateBindingCode(app, adminCookie, unbindEmployeeId);
    const wxCode = `wx_unbind_s7_${runSuffix}`;
    const phoneLastFour = `13807${runSuffix}`.slice(-4);

    const bindRes = await app.request('/api/v1/auth/miniprogram/bind', {
      method: 'POST',
      headers: miniProgramJsonHeaders(),
      body: JSON.stringify({ code: wxCode, bindingCode, phoneLastFour }),
    });
    expect(bindRes.status).toBe(200);
    const bindBody = (await bindRes.json()) as { data: { token: string } };
    const token = bindBody.data.token;

    const meBefore = await app.request('/api/v1/staff/me', {
      headers: staffHeaders(token),
    });
    expect(meBefore.status).toBe(200);

    const unbindApiRes = await app.request('/api/v1/auth/miniprogram/unbind', {
      method: 'POST',
      headers: { ...miniProgramJsonHeaders(), ...staffHeaders(token) },
      body: JSON.stringify({ confirm: true }),
    });
    expect(unbindApiRes.status).toBe(200);
    const unbindApiBody = (await unbindApiRes.json()) as { data: { ok: boolean } };
    expect(unbindApiBody.data.ok).toBe(true);

    const meAfter = await app.request('/api/v1/staff/me', {
      headers: staffHeaders(token),
    });
    expect(meAfter.status).toBe(401);

    const scheduleAfter = await app.request('/api/v1/staff/schedule', {
      headers: staffHeaders(token),
    });
    expect(scheduleAfter.status).toBe(401);

    const loginRes = await app.request('/api/v1/auth/miniprogram/login', {
      method: 'POST',
      headers: miniProgramJsonHeaders(),
      body: JSON.stringify({ code: wxCode }),
    });
    expect(loginRes.status).toBe(200);
    const loginBody = (await loginRes.json()) as { data: { bound: boolean } };
    expect(loginBody.data.bound).toBe(false);
  });

  it('GET /staff/me returns bound employee profile', async () => {
    const profileRes = await app.request('/api/v1/employees', {
      method: 'POST',
      headers: adminHeaders(adminCookie),
      body: JSON.stringify({
        employeeNo: `B${runSuffix}8`,
        name: '资料测试员工',
        phone: `13808${runSuffix}`,
      }),
    });
    const profileBody = (await profileRes.json()) as { data: { id: number } };
    const profileEmployeeId = profileBody.data.id;
    createdEmployeeIds.push(profileEmployeeId);

    const bindingCode = await generateBindingCode(app, adminCookie, profileEmployeeId);
    const wxCode = `wx_profile_me_${runSuffix}`;
    const phoneLastFour = `13808${runSuffix}`.slice(-4);

    const bindRes = await app.request('/api/v1/auth/miniprogram/bind', {
      method: 'POST',
      headers: miniProgramJsonHeaders(),
      body: JSON.stringify({ code: wxCode, bindingCode, phoneLastFour }),
    });
    expect(bindRes.status).toBe(200);
    const bindBody = (await bindRes.json()) as { data: { token: string } };

    const meRes = await app.request('/api/v1/staff/me', {
      headers: staffHeaders(bindBody.data.token),
    });

    expect(meRes.status).toBe(200);
    const meBody = (await meRes.json()) as {
      data: { employee: { id: number; name: string; employeeNo: string; departmentName: string } };
    };
    expect(meBody.data.employee.id).toBe(profileEmployeeId);
    expect(meBody.data.employee.name).toBe('资料测试员工');
    expect(meBody.data.employee.employeeNo).toBe(`B${runSuffix}8`);
    expect(meBody.data.employee.departmentName).toBeTruthy();
  });
});

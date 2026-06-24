import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { createApp } from './app.js';
import { adminHeaders, loginAsAdmin } from './test/helpers.js';
import {
  cleanupTestShiftTypes,
  ensureTestFixtures,
  isDatabaseAvailable,
} from './test/seed-test.js';

const dbAvailable = await isDatabaseAvailable();
const skipDbTests = process.env.SKIP_DB_TESTS === 'true';

describe.skipIf(skipDbTests && !dbAvailable)('shift-types API', () => {
  const app = createApp();
  let cookie = '';
  const createdShiftTypeIds: number[] = [];
  const runSuffix = Date.now().toString().slice(-6);
  const primaryCode = `T${runSuffix}`;

  beforeAll(async () => {
    if (!dbAvailable) {
      throw new Error(
        'shift-types API 集成测试需要可用的 easyshift_test 数据库，或显式设置 SKIP_DB_TESTS=true',
      );
    }

    const fixtures = await ensureTestFixtures();
    cookie = await loginAsAdmin(app, fixtures.adminPhone, fixtures.adminPassword);
  });

  afterAll(async () => {
    await cleanupTestShiftTypes(createdShiftTypeIds);
  });

  it('creates a shift type', async () => {
    const res = await app.request('/api/v1/shift-types', {
      method: 'POST',
      headers: adminHeaders(cookie),
      body: JSON.stringify({
        code: primaryCode,
        name: '测试白班',
        startTime: '08:00:00',
        durationMinutes: 480,
        color: '#4CAF50',
        minRequiredCount: 2,
        sortOrder: 99,
      }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      data: { id: number; code: string; name: string; status: string };
    };
    createdShiftTypeIds.push(body.data.id);
    expect(body.data.code).toBe(primaryCode);
    expect(body.data.name).toBe('测试白班');
    expect(body.data.status).toBe('active');
  });

  it('returns 409 when shift type code is duplicated (AC-02)', async () => {
    const res = await app.request('/api/v1/shift-types', {
      method: 'POST',
      headers: adminHeaders(cookie),
      body: JSON.stringify({
        code: primaryCode,
        name: '重复班次',
        startTime: '09:00:00',
        durationMinutes: 480,
        color: '#FF5722',
        minRequiredCount: 1,
        sortOrder: 100,
      }),
    });

    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('SHIFT_TYPE_CODE_DUPLICATE');
    expect(body.error.message).toBe('班次代码已存在');
  });

  it('lists shift types sorted by sortOrder', async () => {
    const res = await app.request('/api/v1/shift-types', {
      headers: adminHeaders(cookie),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ code: string; sortOrder: number }> };
    expect(body.data.some((s) => s.code === primaryCode)).toBe(true);

    for (let i = 1; i < body.data.length; i += 1) {
      expect(body.data[i]!.sortOrder).toBeGreaterThanOrEqual(body.data[i - 1]!.sortOrder);
    }
  });

  it('updates a shift type', async () => {
    const listRes = await app.request('/api/v1/shift-types', {
      headers: adminHeaders(cookie),
    });
    const listBody = (await listRes.json()) as { data: Array<{ id: number; code: string }> };
    const shiftType = listBody.data.find((s) => s.code === primaryCode);
    expect(shiftType).toBeDefined();

    const res = await app.request(`/api/v1/shift-types/${shiftType!.id}`, {
      method: 'PUT',
      headers: adminHeaders(cookie),
      body: JSON.stringify({
        code: primaryCode,
        name: '测试白班（已改）',
        startTime: '07:30:00',
        durationMinutes: 510,
        color: '#2196F3',
        minRequiredCount: 3,
        sortOrder: 98,
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { name: string; minRequiredCount: number } };
    expect(body.data.name).toBe('测试白班（已改）');
    expect(body.data.minRequiredCount).toBe(3);
  });

  it('deactivates a shift type', async () => {
    const listRes = await app.request('/api/v1/shift-types', {
      headers: adminHeaders(cookie),
    });
    const listBody = (await listRes.json()) as { data: Array<{ id: number; code: string }> };
    const shiftType = listBody.data.find((s) => s.code === primaryCode);
    expect(shiftType).toBeDefined();

    const res = await app.request(`/api/v1/shift-types/${shiftType!.id}/deactivate`, {
      method: 'POST',
      headers: adminHeaders(cookie),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { status: string } };
    expect(body.data.status).toBe('inactive');
  });
});

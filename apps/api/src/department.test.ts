import { describe, expect, it, beforeAll } from 'vitest';
import { createApp } from './app.js';
import { adminHeaders, loginAsAdmin } from './test/helpers.js';
import { ensureTestFixtures, isDatabaseAvailable } from './test/seed-test.js';

const dbAvailable = await isDatabaseAvailable();
const skipDbTests = process.env.SKIP_DB_TESTS === 'true';

describe.skipIf(skipDbTests && !dbAvailable)('department API', () => {
  const app = createApp();
  let cookie = '';
  let originalName = '';

  beforeAll(async () => {
    if (!dbAvailable) {
      throw new Error(
        'department API 集成测试需要可用的 easyshift_test 数据库，或显式设置 SKIP_DB_TESTS=true',
      );
    }

    const fixtures = await ensureTestFixtures();
    cookie = await loginAsAdmin(app, fixtures.adminPhone, fixtures.adminPassword);

    const getRes = await app.request('/api/v1/department', {
      headers: adminHeaders(cookie),
    });
    const getBody = (await getRes.json()) as { data: { name: string } };
    originalName = getBody.data.name;
  });

  it('GET /department returns current department', async () => {
    const res = await app.request('/api/v1/department', {
      headers: adminHeaders(cookie),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { id: number; name: string } };
    expect(body.data.id).toBeGreaterThan(0);
    expect(body.data.name).toBeTruthy();
  });

  it('PUT /department updates department name (WEB-DEPT-01)', async () => {
    const newName = `测试科室-${Date.now().toString().slice(-6)}`;

    try {
      const putRes = await app.request('/api/v1/department', {
        method: 'PUT',
        headers: adminHeaders(cookie),
        body: JSON.stringify({ name: newName }),
      });

      expect(putRes.status).toBe(200);
      const putBody = (await putRes.json()) as { data: { id: number; name: string } };
      expect(putBody.data.name).toBe(newName);

      const getRes = await app.request('/api/v1/department', {
        headers: adminHeaders(cookie),
      });
      const getBody = (await getRes.json()) as { data: { name: string } };
      expect(getBody.data.name).toBe(newName);
    } finally {
      await app.request('/api/v1/department', {
        method: 'PUT',
        headers: adminHeaders(cookie),
        body: JSON.stringify({ name: originalName }),
      });
    }
  });

  it('PUT /department rejects empty name', async () => {
    const res = await app.request('/api/v1/department', {
      method: 'PUT',
      headers: adminHeaders(cookie),
      body: JSON.stringify({ name: '   ' }),
    });

    expect(res.status).toBe(400);
  });

  it('GET /department requires admin auth', async () => {
    const res = await app.request('/api/v1/department');
    expect(res.status).toBe(401);
  });
});

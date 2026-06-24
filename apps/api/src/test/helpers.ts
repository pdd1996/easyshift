import type { App } from '../app.js';
import { env } from '../config/env.js';

export const TEST_ORIGIN = env.CORS_ORIGIN;

export async function loginAsAdmin(
  app: App,
  phone: string,
  password: string,
): Promise<string> {
  const res = await app.request('/api/v1/auth/admin/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: TEST_ORIGIN,
    },
    body: JSON.stringify({ phone, password }),
  });

  if (res.status !== 200) {
    throw new Error(`Login failed with status ${res.status}`);
  }

  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) {
    throw new Error('Login response missing Set-Cookie');
  }

  return setCookie.split(';')[0]!;
}

export function adminHeaders(cookie: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Origin: TEST_ORIGIN,
    Cookie: cookie,
  };
}

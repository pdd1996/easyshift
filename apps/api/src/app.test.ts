import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';

describe('health', () => {
  it('returns ok', async () => {
    const app = createApp();
    const res = await app.request('/api/v1/health');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { status: string } };
    expect(body.data.status).toBe('ok');
  });
});

import { Hono } from 'hono';
import { notImplemented } from '../lib/errors.js';
import { validateCsrfOrigin } from '../middleware/auth.js';

export const authMiniappRoutes = new Hono();

authMiniappRoutes.post('/login', async () => notImplemented('POST /auth/miniprogram/login'));
authMiniappRoutes.post('/bind', async (c) => {
  await validateCsrfOrigin(c);
  notImplemented('POST /auth/miniprogram/bind');
});
authMiniappRoutes.post('/unbind', async (c) => {
  await validateCsrfOrigin(c);
  notImplemented('POST /auth/miniprogram/unbind');
});

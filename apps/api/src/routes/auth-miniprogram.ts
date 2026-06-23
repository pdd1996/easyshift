import { Hono } from 'hono';
import { notImplemented } from '../lib/errors.js';
import { requireStaff } from '../middleware/auth.js';

export const authMiniappRoutes = new Hono();

authMiniappRoutes.post('/login', async () => notImplemented('POST /auth/miniprogram/login'));
authMiniappRoutes.post('/bind', async () => notImplemented('POST /auth/miniprogram/bind'));
authMiniappRoutes.post('/unbind', requireStaff(), async () =>
  notImplemented('POST /auth/miniprogram/unbind'),
);

import { Hono } from 'hono';
import { notImplemented } from '../lib/errors.js';
import { requireStaff } from '../middleware/auth.js';

export const staffRoutes = new Hono();

staffRoutes.use('*', requireStaff());

staffRoutes.get('/me', async () => notImplemented('GET /staff/me'));
staffRoutes.get('/schedule', async () => notImplemented('GET /staff/schedule'));
staffRoutes.get('/schedule/summary', async () => notImplemented('GET /staff/schedule/summary'));

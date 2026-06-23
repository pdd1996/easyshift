import { Hono } from 'hono';
import { notImplemented } from '../lib/errors.js';
import { requireAdmin, validateCsrfOrigin } from '../middleware/auth.js';

export const departmentRoutes = new Hono();

departmentRoutes.use('*', requireAdmin());

departmentRoutes.get('/', async () => notImplemented('GET /department'));

departmentRoutes.put('/', async (c) => {
  await validateCsrfOrigin(c);
  notImplemented('PUT /department');
});

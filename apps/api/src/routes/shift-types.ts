import { Hono } from 'hono';
import { notImplemented } from '../lib/errors.js';
import { requireAdmin, validateCsrfOrigin } from '../middleware/auth.js';

export const shiftTypeRoutes = new Hono();

shiftTypeRoutes.use('*', requireAdmin());

shiftTypeRoutes.get('/', async () => notImplemented('GET /shift-types'));
shiftTypeRoutes.post('/', async (c) => {
  await validateCsrfOrigin(c);
  notImplemented('POST /shift-types');
});
shiftTypeRoutes.put('/:id', async (c) => {
  await validateCsrfOrigin(c);
  notImplemented('PUT /shift-types/:id');
});
shiftTypeRoutes.post('/:id/deactivate', async (c) => {
  await validateCsrfOrigin(c);
  notImplemented('POST /shift-types/:id/deactivate');
});

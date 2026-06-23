import { Hono } from 'hono';
import { notImplemented } from '../lib/errors.js';
import { requireAdmin, validateCsrfOrigin } from '../middleware/auth.js';

export const employeeRoutes = new Hono();

employeeRoutes.use('*', requireAdmin());

employeeRoutes.get('/', async () => notImplemented('GET /employees'));
employeeRoutes.post('/', async (c) => {
  await validateCsrfOrigin(c);
  notImplemented('POST /employees');
});
employeeRoutes.get('/:id', async () => notImplemented('GET /employees/:id'));
employeeRoutes.put('/:id', async (c) => {
  await validateCsrfOrigin(c);
  notImplemented('PUT /employees/:id');
});
employeeRoutes.post('/:id/deactivate', async (c) => {
  await validateCsrfOrigin(c);
  notImplemented('POST /employees/:id/deactivate');
});
employeeRoutes.post('/:id/binding-code', async (c) => {
  await validateCsrfOrigin(c);
  notImplemented('POST /employees/:id/binding-code');
});

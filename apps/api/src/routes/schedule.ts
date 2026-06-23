import { Hono } from 'hono';
import { notImplemented } from '../lib/errors.js';
import { requireAdmin, validateCsrfOrigin } from '../middleware/auth.js';

export const scheduleRoutes = new Hono();

scheduleRoutes.use('*', requireAdmin());

scheduleRoutes.get('/periods', async () => notImplemented('GET /schedule/periods'));
scheduleRoutes.post('/periods', async (c) => {
  await validateCsrfOrigin(c);
  notImplemented('POST /schedule/periods');
});
scheduleRoutes.get('/periods/:periodId', async () => notImplemented('GET /schedule/periods/:periodId'));
scheduleRoutes.get('/periods/:periodId/grid', async () => notImplemented('GET /schedule/periods/:periodId/grid'));
scheduleRoutes.put('/periods/:periodId/entries', async (c) => {
  await validateCsrfOrigin(c);
  notImplemented('PUT /schedule/periods/:periodId/entries');
});
scheduleRoutes.delete('/periods/:periodId/entries', async (c) => {
  await validateCsrfOrigin(c);
  notImplemented('DELETE /schedule/periods/:periodId/entries');
});
scheduleRoutes.post('/periods/:periodId/copy-from-previous-week', async (c) => {
  await validateCsrfOrigin(c);
  notImplemented('POST /schedule/periods/:periodId/copy-from-previous-week');
});
scheduleRoutes.get('/periods/:periodId/validation', async () =>
  notImplemented('GET /schedule/periods/:periodId/validation'),
);
scheduleRoutes.get('/periods/:periodId/stats', async () => notImplemented('GET /schedule/periods/:periodId/stats'));
scheduleRoutes.post('/periods/:periodId/publish', async (c) => {
  await validateCsrfOrigin(c);
  notImplemented('POST /schedule/periods/:periodId/publish');
});
scheduleRoutes.get('/periods/:periodId/notification-text', async () =>
  notImplemented('GET /schedule/periods/:periodId/notification-text'),
);
scheduleRoutes.get('/periods/:periodId/change-logs', async () =>
  notImplemented('GET /schedule/periods/:periodId/change-logs'),
);

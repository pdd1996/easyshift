import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { getDefaultDepartment } from '../lib/department.js';
import { validateCsrfOrigin, requireAdmin } from '../middleware/auth.js';
import { copyFromPreviousWeek } from '../services/schedule/copy.js';
import { deleteEntry, upsertEntries } from '../services/schedule/entry.js';
import { getScheduleGrid } from '../services/schedule/grid.js';
import { createPeriod, getPeriod, listPeriods } from '../services/schedule/period.js';
import { publishPeriod } from '../services/schedule/publish.js';
import { validatePeriod } from '../services/schedule/validation.js';
import { notImplemented } from '../lib/errors.js';

const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式须为 YYYY-MM-DD');

const createPeriodBodySchema = z.object({
  weekStart: dateStringSchema,
});

const listPeriodsQuerySchema = z.object({
  fromWeekStart: dateStringSchema.optional(),
  toWeekStart: dateStringSchema.optional(),
});

const entrySchema = z.object({
  employeeId: z.number().int().positive(),
  workDate: dateStringSchema,
  shiftTypeId: z.number().int().positive(),
  note: z.string().max(255).nullable().optional(),
});

const upsertEntriesBodySchema = z.object({
  entries: z.array(entrySchema).min(1),
});

const deleteEntryBodySchema = z.object({
  employeeId: z.number().int().positive(),
  workDate: dateStringSchema,
});

const publishBodySchema = z.object({
  acknowledgeWarnings: z.boolean().optional(),
});

const copyFromPreviousWeekBodySchema = z.object({
  sourceWeekStart: dateStringSchema.optional(),
});

export const scheduleRoutes = new Hono();

scheduleRoutes.use('*', requireAdmin());

function parsePeriodId(value: string): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

scheduleRoutes.get('/periods', zValidator('query', listPeriodsQuerySchema), async (c) => {
  const query = c.req.valid('query');
  const department = await getDefaultDepartment();
  const data = await listPeriods(department.id, query);
  return c.json({ data });
});

scheduleRoutes.post('/periods', zValidator('json', createPeriodBodySchema), async (c) => {
  await validateCsrfOrigin(c);
  const body = c.req.valid('json');
  const department = await getDefaultDepartment();
  const { period, created } = await createPeriod(department.id, body.weekStart);
  return c.json({ data: period }, created ? 201 : 200);
});

scheduleRoutes.get('/periods/:periodId', async (c) => {
  const periodId = parsePeriodId(c.req.param('periodId'));
  if (periodId === null) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: '无效的排班周期 ID' } }, 400);
  }

  const department = await getDefaultDepartment();
  const data = await getPeriod(department.id, periodId);
  return c.json({ data });
});

scheduleRoutes.get('/periods/:periodId/grid', async (c) => {
  const periodId = parsePeriodId(c.req.param('periodId'));
  if (periodId === null) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: '无效的排班周期 ID' } }, 400);
  }

  const department = await getDefaultDepartment();
  const data = await getScheduleGrid(department.id, periodId);
  return c.json({ data });
});

scheduleRoutes.put('/periods/:periodId/entries', zValidator('json', upsertEntriesBodySchema), async (c) => {
  await validateCsrfOrigin(c);
  const periodId = parsePeriodId(c.req.param('periodId'));
  if (periodId === null) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: '无效的排班周期 ID' } }, 400);
  }

  const body = c.req.valid('json');
  const department = await getDefaultDepartment();
  const authUser = c.get('authUser');
  const data = await upsertEntries(department.id, periodId, body.entries, authUser.id);
  return c.json({ data });
});

scheduleRoutes.delete('/periods/:periodId/entries', zValidator('json', deleteEntryBodySchema), async (c) => {
  await validateCsrfOrigin(c);
  const periodId = parsePeriodId(c.req.param('periodId'));
  if (periodId === null) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: '无效的排班周期 ID' } }, 400);
  }

  const body = c.req.valid('json');
  const department = await getDefaultDepartment();
  const authUser = c.get('authUser');
  const deleted = await deleteEntry(
    department.id,
    periodId,
    body.employeeId,
    body.workDate,
    authUser.id,
  );

  if (!deleted) {
    return c.body(null, 204);
  }

  return c.body(null, 204);
});

scheduleRoutes.post('/periods/:periodId/copy-from-previous-week', async (c) => {
  await validateCsrfOrigin(c);
  const periodId = parsePeriodId(c.req.param('periodId'));
  if (periodId === null) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: '无效的排班周期 ID' } }, 400);
  }

  let options: { sourceWeekStart?: string } = {};
  const contentType = c.req.header('content-type');
  if (contentType?.includes('application/json')) {
    const rawBody = await c.req.text();
    let jsonBody: unknown = {};
    if (rawBody.trim() !== '') {
      try {
        jsonBody = JSON.parse(rawBody) as unknown;
      } catch {
        return c.json({ error: { code: 'VALIDATION_ERROR', message: '请求体格式无效' } }, 400);
      }
    }

    const parsed = copyFromPreviousWeekBodySchema.safeParse(jsonBody);
    if (!parsed.success) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: '请求体格式无效' } }, 400);
    }
    options = parsed.data;
  }

  const department = await getDefaultDepartment();
  const authUser = c.get('authUser');
  const data = await copyFromPreviousWeek(department.id, periodId, authUser.id, options);
  return c.json({ data });
});
scheduleRoutes.get('/periods/:periodId/validation', async (c) => {
  const periodId = parsePeriodId(c.req.param('periodId'));
  if (periodId === null) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: '无效的排班周期 ID' } }, 400);
  }

  const department = await getDefaultDepartment();
  const data = await validatePeriod(department.id, periodId);
  return c.json({ data });
});
scheduleRoutes.get('/periods/:periodId/stats', async () => notImplemented('GET /schedule/periods/:periodId/stats'));
scheduleRoutes.post('/periods/:periodId/publish', async (c) => {
  await validateCsrfOrigin(c);
  const periodId = parsePeriodId(c.req.param('periodId'));
  if (periodId === null) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: '无效的排班周期 ID' } }, 400);
  }

  let options: { acknowledgeWarnings?: boolean } = {};
  const contentType = c.req.header('content-type');
  if (contentType?.includes('application/json')) {
    const rawBody = await c.req.text();
    let jsonBody: unknown = {};
    if (rawBody.trim() !== '') {
      try {
        jsonBody = JSON.parse(rawBody) as unknown;
      } catch {
        return c.json({ error: { code: 'VALIDATION_ERROR', message: '请求体格式无效' } }, 400);
      }
    }

    const parsed = publishBodySchema.safeParse(jsonBody);
    if (!parsed.success) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: '请求体格式无效' } }, 400);
    }
    options = parsed.data;
  }

  const department = await getDefaultDepartment();
  const authUser = c.get('authUser');
  const data = await publishPeriod(department.id, periodId, authUser.id, options);
  return c.json({ data });
});
scheduleRoutes.get('/periods/:periodId/notification-text', async () =>
  notImplemented('GET /schedule/periods/:periodId/notification-text'),
);
scheduleRoutes.get('/periods/:periodId/change-logs', async () =>
  notImplemented('GET /schedule/periods/:periodId/change-logs'),
);

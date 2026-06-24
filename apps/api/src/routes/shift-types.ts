import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { getDefaultDepartment } from '../lib/department.js';
import { validateCsrfOrigin, requireAdmin } from '../middleware/auth.js';
import {
  createShiftType,
  deactivateShiftType,
  listShiftTypes,
  updateShiftType,
} from '../services/shift-type.js';

const timeStringSchema = z
  .string()
  .regex(/^\d{2}:\d{2}(:\d{2})?$/, '时间格式须为 HH:mm 或 HH:mm:ss')
  .optional()
  .nullable();

const shiftTypeKindSchema = z.enum(['day', 'evening', 'night', 'off', 'standby', 'other']);

const shiftTypeBodySchema = z.object({
  code: z.string().trim().min(1).max(10),
  name: z.string().trim().min(1).max(50),
  kind: shiftTypeKindSchema,
  startTime: timeStringSchema,
  durationMinutes: z.number().int().min(0).optional().nullable(),
  color: z
    .string()
    .trim()
    .regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, '颜色须为十六进制格式，如 #4CAF50'),
  minRequiredCount: z.number().int().min(0),
  sortOrder: z.number().int(),
});

export const shiftTypeRoutes = new Hono();

shiftTypeRoutes.use('*', requireAdmin());

function parseShiftTypeId(value: string): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

shiftTypeRoutes.get('/', async (c) => {
  const department = await getDefaultDepartment();
  const data = await listShiftTypes(department.id);
  return c.json({ data });
});

shiftTypeRoutes.post('/', zValidator('json', shiftTypeBodySchema), async (c) => {
  await validateCsrfOrigin(c);
  const body = c.req.valid('json');
  const department = await getDefaultDepartment();
  const shiftType = await createShiftType(department.id, body);
  return c.json({ data: shiftType }, 201);
});

shiftTypeRoutes.put('/:id', zValidator('json', shiftTypeBodySchema), async (c) => {
  await validateCsrfOrigin(c);
  const id = parseShiftTypeId(c.req.param('id'));
  if (id === null) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: '无效的班次类型 ID' } }, 400);
  }
  const body = c.req.valid('json');
  const department = await getDefaultDepartment();
  const shiftType = await updateShiftType(department.id, id, body);
  return c.json({ data: shiftType });
});

shiftTypeRoutes.post('/:id/deactivate', async (c) => {
  await validateCsrfOrigin(c);
  const id = parseShiftTypeId(c.req.param('id'));
  if (id === null) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: '无效的班次类型 ID' } }, 400);
  }
  const department = await getDefaultDepartment();
  const shiftType = await deactivateShiftType(department.id, id);
  return c.json({ data: shiftType });
});

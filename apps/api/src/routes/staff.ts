import { zValidator } from '@hono/zod-validator';
import { isMonday, weekStartFromDate } from '@easyshift/shared-types';
import { Hono } from 'hono';
import { z } from 'zod';
import { AppError, notImplemented } from '../lib/errors.js';
import { requireStaff } from '../middleware/auth.js';
import { getStaffMe } from '../services/auth/miniprogram.js';
import { getStaffSchedule } from '../services/staff/schedule.js';

const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式须为 YYYY-MM-DD');

const scheduleQuerySchema = z.object({
  weekStart: dateStringSchema.optional(),
});

export const staffRoutes = new Hono();

staffRoutes.use('*', requireStaff());

staffRoutes.get('/me', async (c) => {
  const authUser = c.get('authUser');
  if (!authUser.employeeId) {
    throw new AppError(403, 'FORBIDDEN', '账号未绑定员工');
  }

  const data = await getStaffMe(authUser.employeeId);
  return c.json({ data });
});

staffRoutes.get('/schedule', zValidator('query', scheduleQuerySchema), async (c) => {
  const authUser = c.get('authUser');
  if (!authUser.employeeId) {
    throw new AppError(403, 'FORBIDDEN', '账号未绑定员工');
  }

  let weekStart = c.req.valid('query').weekStart;
  if (!weekStart) {
    weekStart = weekStartFromDate(new Date());
  } else if (!isMonday(weekStart)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'weekStart 必须为周一', { weekStart });
  }

  const data = await getStaffSchedule(authUser.employeeId, weekStart);
  return c.json({ data });
});

staffRoutes.get('/schedule/summary', async () => notImplemented('GET /staff/schedule/summary'));

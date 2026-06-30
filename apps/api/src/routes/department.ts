import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { validateCsrfOrigin, requireAdmin } from '../middleware/auth.js';
import { getDepartment, updateDepartment } from '../services/department.js';

const updateDepartmentSchema = z.object({
  name: z.string().trim().min(1, '科室名称不能为空').max(100, '科室名称不能超过 100 个字符'),
});

export const departmentRoutes = new Hono();

departmentRoutes.use('*', requireAdmin());

departmentRoutes.get('/', async (c) => {
  const department = await getDepartment();
  return c.json({ data: department });
});

departmentRoutes.put('/', zValidator('json', updateDepartmentSchema), async (c) => {
  await validateCsrfOrigin(c);
  const { name } = c.req.valid('json');
  const department = await updateDepartment(name);
  return c.json({ data: department });
});

import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { getDefaultDepartment } from '../lib/department.js';
import { validateCsrfOrigin, requireAdmin } from '../middleware/auth.js';
import {
  createEmployee,
  deactivateEmployee,
  generateBindingCode,
  getEmployee,
  listEmployees,
  updateEmployee,
} from '../services/employee.js';

const createEmployeeSchema = z.object({
  employeeNo: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(20),
  title: z.string().trim().max(50).optional().nullable(),
  phone: z.string().regex(/^1\d{10}$/, '手机号须为 11 位'),
});

const updateEmployeeSchema = createEmployeeSchema.extend({
  status: z.enum(['active', 'inactive']).optional(),
});

const listQuerySchema = z.object({
  status: z.enum(['active', 'inactive']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const employeeRoutes = new Hono();

employeeRoutes.use('*', requireAdmin());

employeeRoutes.get('/', zValidator('query', listQuerySchema), async (c) => {
  const query = c.req.valid('query');
  const department = await getDefaultDepartment();
  const result = await listEmployees(department.id, query);
  return c.json(result);
});

employeeRoutes.post('/', zValidator('json', createEmployeeSchema), async (c) => {
  await validateCsrfOrigin(c);
  const body = c.req.valid('json');
  const department = await getDefaultDepartment();
  const employee = await createEmployee(department.id, body);
  return c.json({ data: employee }, 201);
});

employeeRoutes.get('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: '无效的员工 ID' } }, 400);
  }
  const department = await getDefaultDepartment();
  const employee = await getEmployee(department.id, id);
  return c.json({ data: employee });
});

employeeRoutes.put('/:id', zValidator('json', updateEmployeeSchema), async (c) => {
  await validateCsrfOrigin(c);
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: '无效的员工 ID' } }, 400);
  }
  const body = c.req.valid('json');
  const department = await getDefaultDepartment();
  const employee = await updateEmployee(department.id, id, body);
  return c.json({ data: employee });
});

employeeRoutes.post('/:id/deactivate', async (c) => {
  await validateCsrfOrigin(c);
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: '无效的员工 ID' } }, 400);
  }
  const department = await getDefaultDepartment();
  const employee = await deactivateEmployee(department.id, id);
  return c.json({ data: employee });
});

employeeRoutes.post('/:id/binding-code', async (c) => {
  await validateCsrfOrigin(c);
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: '无效的员工 ID' } }, 400);
  }
  const authUser = c.get('authUser');
  const department = await getDefaultDepartment();
  const result = await generateBindingCode(department.id, id, authUser.id);
  return c.json({ data: result });
});

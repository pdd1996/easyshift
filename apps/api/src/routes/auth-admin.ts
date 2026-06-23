import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { departments, users } from '../db/schema/index.js';
import { AppError } from '../lib/errors.js';
import { signSession } from '../lib/jwt.js';
import {
  clearSessionCookie,
  loadAuthUser,
  requireAdmin,
  setSessionCookie,
  validateCsrfOrigin,
} from '../middleware/auth.js';

const loginSchema = z.object({
  phone: z.string().min(1),
  password: z.string().min(1),
});

export const authAdminRoutes = new Hono();

authAdminRoutes.post('/login', zValidator('json', loginSchema), async (c) => {
  const { phone, password } = c.req.valid('json');
  const [user] = await db.select().from(users).where(eq(users.phone, phone)).limit(1);

  if (!user || user.role !== 'admin' || !user.passwordHash) {
    throw new AppError(401, 'UNAUTHORIZED', '账号或密码错误');
  }
  if (user.status !== 'active') {
    throw new AppError(403, 'FORBIDDEN', '账号已停用');
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    throw new AppError(401, 'UNAUTHORIZED', '账号或密码错误');
  }

  const token = signSession({ sub: user.id, role: 'admin' });
  setSessionCookie(c, token);

  const [department] = await db.select().from(departments).limit(1);
  if (!department) {
    throw new AppError(500, 'INTERNAL_ERROR', '科室数据未初始化，请先执行 seed');
  }

  return c.json({
    data: {
      user: {
        id: user.id,
        phone: user.phone,
        role: user.role,
      },
      department: {
        id: department.id,
        name: department.name,
      },
    },
  });
});

authAdminRoutes.post('/logout', requireAdmin(), async (c) => {
  await validateCsrfOrigin(c);
  clearSessionCookie(c);
  return c.json({ data: { ok: true } });
});

authAdminRoutes.get('/me', requireAdmin(), async (c) => {
  const authUser = c.get('authUser');
  const [user] = await db.select().from(users).where(eq(users.id, authUser.id)).limit(1);
  const [department] = await db.select().from(departments).limit(1);

  if (!user || !department) {
    throw new AppError(404, 'NOT_FOUND', '用户或科室不存在');
  }

  return c.json({
    data: {
      user: {
        id: user.id,
        phone: user.phone,
        role: user.role,
      },
      department: {
        id: department.id,
        name: department.name,
      },
    },
  });
});

authAdminRoutes.get('/session-check', async (c) => {
  const user = await loadAuthUser(c);
  return c.json({ data: { authenticated: Boolean(user) } });
});

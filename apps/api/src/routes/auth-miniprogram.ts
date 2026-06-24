import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { notImplemented } from '../lib/errors.js';
import { requireStaff } from '../middleware/auth.js';
import { miniProgramBind, miniProgramLogin } from '../services/auth/miniprogram.js';

const loginSchema = z.object({
  code: z.string().min(1, '微信 code 不能为空'),
});

const bindSchema = z.object({
  code: z.string().min(1, '微信 code 不能为空'),
  bindingCode: z.string().min(1, '绑定码不能为空'),
  phoneLastFour: z.string().regex(/^\d{4}$/, '手机号后四位须为 4 位数字'),
});

export const authMiniappRoutes = new Hono();

authMiniappRoutes.post('/login', zValidator('json', loginSchema), async (c) => {
  const { code } = c.req.valid('json');
  const data = await miniProgramLogin(code);
  return c.json({ data });
});

authMiniappRoutes.post('/bind', zValidator('json', bindSchema), async (c) => {
  const { code, bindingCode, phoneLastFour } = c.req.valid('json');
  const data = await miniProgramBind(code, bindingCode, phoneLastFour);
  return c.json({ data });
});

authMiniappRoutes.post('/unbind', requireStaff(), async () =>
  notImplemented('POST /auth/miniprogram/unbind'),
);

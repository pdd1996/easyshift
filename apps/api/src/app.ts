import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { env } from './config/env.js';
import { AppError, errorResponse } from './lib/errors.js';
import { healthRoutes } from './routes/health.js';
import { authAdminRoutes } from './routes/auth-admin.js';
import { departmentRoutes } from './routes/department.js';
import { employeeRoutes } from './routes/employees.js';
import { shiftTypeRoutes } from './routes/shift-types.js';
import { scheduleRoutes } from './routes/schedule.js';
import { staffRoutes } from './routes/staff.js';
import { authMiniappRoutes } from './routes/auth-miniprogram.js';

export function createApp() {
  const app = new Hono();

  app.use(
    '*',
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    }),
  );

  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json(errorResponse(err), err.status);
    }
    console.error(err);
    return c.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: '服务器内部错误',
        },
      },
      500,
    );
  });

  app.route('/api/v1', healthRoutes);
  app.route('/api/v1/auth/admin', authAdminRoutes);
  app.route('/api/v1/auth/miniprogram', authMiniappRoutes);
  app.route('/api/v1/department', departmentRoutes);
  app.route('/api/v1/employees', employeeRoutes);
  app.route('/api/v1/shift-types', shiftTypeRoutes);
  app.route('/api/v1/schedule', scheduleRoutes);
  app.route('/api/v1/staff', staffRoutes);

  return app;
}

export type App = ReturnType<typeof createApp>;

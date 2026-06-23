import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { Context, Next } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema/index.js';
import { AppError } from '../lib/errors.js';
import { verifySession } from '../lib/jwt.js';
import { COOKIE_NAME, env } from '../config/env.js';

export type AuthUser = {
  id: number;
  role: 'admin' | 'staff';
  employeeId: number | null;
};

declare module 'hono' {
  interface ContextVariableMap {
    authUser: AuthUser;
  }
}

export async function loadAuthUser(c: Context): Promise<AuthUser | null> {
  const token = getCookie(c, COOKIE_NAME);
  if (!token) {
    const authHeader = c.req.header('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      return loadUserFromToken(authHeader.slice(7));
    }
    return null;
  }
  return loadUserFromToken(token);
}

async function loadUserFromToken(token: string): Promise<AuthUser | null> {
  try {
    const payload = verifySession(token);
    const [user] = await db.select().from(users).where(eq(users.id, payload.sub)).limit(1);
    if (!user || user.status !== 'active') {
      return null;
    }
    const tokenIssuedAt = new Date(payload.iat * 1000);
    const validAfter = new Date(user.tokenValidAfter);
    if (tokenIssuedAt < validAfter) {
      return null;
    }
    return {
      id: user.id,
      role: user.role,
      employeeId: user.employeeId,
    };
  } catch {
    return null;
  }
}

export function setSessionCookie(c: Context, token: string) {
  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'Lax',
    path: '/',
    maxAge: env.WEB_SESSION_TTL_DAYS * 24 * 60 * 60,
  });
}

export function clearSessionCookie(c: Context) {
  deleteCookie(c, COOKIE_NAME, { path: '/' });
}

export function requireAdmin() {
  return async (c: Context, next: Next) => {
    const user = await loadAuthUser(c);
    if (!user || user.role !== 'admin') {
      throw new AppError(401, 'UNAUTHORIZED', '未登录或会话已失效');
    }
    c.set('authUser', user);
    await next();
  };
}

export function requireStaff() {
  return async (c: Context, next: Next) => {
    const user = await loadAuthUser(c);
    if (!user || user.role !== 'staff') {
      throw new AppError(401, 'UNAUTHORIZED', '未登录或会话已失效');
    }
    c.set('authUser', user);
    await next();
  };
}

export async function validateCsrfOrigin(c: Context) {
  const origin = c.req.header('Origin') ?? c.req.header('Referer');
  if (!origin) {
    throw new AppError(403, 'FORBIDDEN', '缺少 Origin 校验信息');
  }
  if (!origin.startsWith(env.CORS_ORIGIN)) {
    throw new AppError(403, 'FORBIDDEN', 'Origin 不在白名单内');
  }
}

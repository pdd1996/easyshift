import { env } from '../config/env.js';

const LOCALHOST_ORIGIN = /^http:\/\/localhost:\d+$/;

/** 开发环境允许 Vite 自动切换端口（5174、5175…） */
export function isAllowedWebOrigin(origin: string): boolean {
  if (origin === env.CORS_ORIGIN) {
    return true;
  }
  return env.NODE_ENV === 'development' && LOCALHOST_ORIGIN.test(origin);
}

export function resolveCorsOrigin(origin: string | undefined): string | null {
  if (!origin) {
    return env.CORS_ORIGIN;
  }
  return isAllowedWebOrigin(origin) ? origin : null;
}

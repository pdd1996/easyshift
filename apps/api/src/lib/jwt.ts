import jwt from 'jsonwebtoken';
import type { UserRole } from '@easyshift/shared-types';
import { env } from '../config/env.js';

export interface SessionPayload {
  sub: number;
  role: UserRole;
  iat: number;
}

export function signSession(payload: Omit<SessionPayload, 'iat'>): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: `${env.WEB_SESSION_TTL_DAYS}d`,
  });
}

export function verifySession(token: string): SessionPayload {
  const payload = jwt.verify(token, env.JWT_SECRET);
  if (typeof payload === 'string' || !payload.sub || !payload.role || !payload.iat) {
    throw new Error('Invalid token payload');
  }
  return {
    sub: Number(payload.sub),
    role: payload.role as UserRole,
    iat: Number(payload.iat),
  };
}

export function signStaffToken(payload: Omit<SessionPayload, 'iat'>): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: `${env.MINIAPP_TOKEN_TTL_DAYS}d`,
  });
}

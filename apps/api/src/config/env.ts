import 'dotenv/config';
import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().default(3000),
    DATABASE_URL: z.string().min(1),
    JWT_SECRET: z.string().min(32),
    WEB_SESSION_TTL_DAYS: z.coerce.number().default(7),
    MINIAPP_TOKEN_TTL_DAYS: z.coerce.number().default(30),
    WX_APPID: z.string().default(''),
    WX_SECRET: z.string().default(''),
    WX_MOCK: z
      .string()
      .optional()
      .transform((v) => v === 'true'),
    CORS_ORIGIN: z.string().default('http://localhost:5173'),
    COOKIE_SECURE: z
      .string()
      .optional()
      .transform((v) => v === 'true'),
    SEED_ADMIN_PASSWORD: z.string().default('Admin@123456'),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV === 'production' && value.WX_MOCK) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['WX_MOCK'],
        message: 'WX_MOCK must be false in production',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);

export const COOKIE_NAME = 'easyshift_session';

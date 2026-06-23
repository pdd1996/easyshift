import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { env } from '../config/env.js';
import * as schema from './schema/index.js';

const pool = mysql.createPool(env.DATABASE_URL);

export const db = drizzle(pool, {
  schema,
  mode: 'default',
  logger: env.NODE_ENV === 'development',
});

export type Db = typeof db;

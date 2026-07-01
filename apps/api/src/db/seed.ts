import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { db } from './index.js';
import { departments, shiftTypes, users } from './schema/index.js';
import { env } from '../config/env.js';

const DEFAULT_SHIFTS = [
  {
    code: 'D',
    name: '白班',
    kind: 'day' as const,
    startTime: '08:00:00',
    durationMinutes: 480,
    color: '#4CAF50',
    minRequiredCount: 3,
    sortOrder: 1,
  },
  {
    code: 'E',
    name: '小夜班',
    kind: 'evening' as const,
    startTime: '16:00:00',
    durationMinutes: 480,
    color: '#FF9800',
    minRequiredCount: 2,
    sortOrder: 2,
  },
  {
    code: 'N',
    name: '大夜班',
    kind: 'night' as const,
    startTime: '20:00:00',
    durationMinutes: 720,
    color: '#3F51B5',
    minRequiredCount: 2,
    sortOrder: 3,
  },
  {
    code: 'OFF',
    name: '休息',
    kind: 'off' as const,
    startTime: null,
    durationMinutes: null,
    color: '#9E9E9E',
    minRequiredCount: 0,
    sortOrder: 4,
  },
  {
    code: 'SB',
    name: '备班',
    kind: 'standby' as const,
    startTime: null,
    durationMinutes: null,
    color: '#795548',
    minRequiredCount: 0,
    sortOrder: 5,
  },
] as const;

async function main() {
  const existingDept = await db.select().from(departments).limit(1);
  if (existingDept.length > 0) {
    console.log('Seed skipped: department already exists.');
    return;
  }

  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

  const [insertResult] = await db.insert(departments).values({ name: '心内科一病区' });
  const departmentId = Number(insertResult.insertId);
  const passwordHash = await bcrypt.hash(env.SEED_ADMIN_PASSWORD, 10);

  await db.insert(users).values({
    phone: '13800000000',
    passwordHash,
    role: 'admin',
    status: 'active',
    tokenValidAfter: now,
  });

  await db.insert(shiftTypes).values(
    DEFAULT_SHIFTS.map((shift) => ({
      departmentId,
      ...shift,
    })),
  );

  console.log('Seed completed.');
  console.log(`Department: 心内科一病区 (id=${departmentId})`);
  console.log('Admin phone: 13800000000');
  console.log(`Admin password: ${env.SEED_ADMIN_PASSWORD}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

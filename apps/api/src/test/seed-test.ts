import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import { env } from '../config/env.js';

const ADMIN_PHONE = '13800000000';
const ADMIN_PASSWORD = env.SEED_ADMIN_PASSWORD;

export interface TestFixtures {
  departmentId: number;
  adminPhone: string;
  adminPassword: string;
}

export async function ensureTestFixtures(): Promise<TestFixtures> {
  const connection = await mysql.createConnection(env.DATABASE_URL);
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  try {
    const [depts] = await connection.execute('SELECT id FROM departments LIMIT 1');
    let departmentId: number;

    if ((depts as Array<{ id: number }>).length === 0) {
      const [deptResult] = await connection.execute(
        'INSERT INTO departments (name) VALUES (?)',
        ['测试科室'],
      );
      departmentId = Number((deptResult as { insertId: number }).insertId);

      await connection.execute(
        `INSERT INTO users (phone, password_hash, role, status, token_valid_after)
         VALUES (?, ?, 'admin', 'active', ?)`,
        [ADMIN_PHONE, passwordHash, now],
      );
    } else {
      departmentId = (depts as Array<{ id: number }>)[0]!.id;

      const [admins] = await connection.execute(
        'SELECT id FROM users WHERE phone = ? AND role = ? LIMIT 1',
        [ADMIN_PHONE, 'admin'],
      );

      if ((admins as unknown[]).length === 0) {
        await connection.execute(
          `INSERT INTO users (phone, password_hash, role, status, token_valid_after)
           VALUES (?, ?, 'admin', 'active', ?)`,
          [ADMIN_PHONE, passwordHash, now],
        );
      }
    }

    return {
      departmentId,
      adminPhone: ADMIN_PHONE,
      adminPassword: ADMIN_PASSWORD,
    };
  } finally {
    await connection.end();
  }
}

export async function cleanupTestShiftTypes(shiftTypeIds: number[]) {
  if (shiftTypeIds.length === 0) {
    return;
  }

  const connection = await mysql.createConnection(env.DATABASE_URL);
  const placeholders = shiftTypeIds.map(() => '?').join(',');

  try {
    await connection.execute(
      `DELETE FROM schedule_entries WHERE shift_type_id IN (${placeholders})`,
      shiftTypeIds,
    );
    await connection.execute(`DELETE FROM shift_types WHERE id IN (${placeholders})`, shiftTypeIds);
  } finally {
    await connection.end();
  }
}

export async function cleanupTestEmployees(employeeIds: number[]) {
  if (employeeIds.length === 0) {
    return;
  }

  const connection = await mysql.createConnection(env.DATABASE_URL);
  const placeholders = employeeIds.map(() => '?').join(',');

  try {
    await connection.execute(
      `DELETE FROM employee_binding_codes WHERE employee_id IN (${placeholders})`,
      employeeIds,
    );
    await connection.execute(
      `DELETE FROM users WHERE employee_id IN (${placeholders})`,
      employeeIds,
    );
    await connection.execute(`DELETE FROM employees WHERE id IN (${placeholders})`, employeeIds);
  } finally {
    await connection.end();
  }
}

export async function isDatabaseAvailable(): Promise<boolean> {
  try {
    const connection = await mysql.createConnection(env.DATABASE_URL);
    await connection.ping();
    await connection.end();
    return true;
  } catch {
    return false;
  }
}

import bcrypt from 'bcryptjs';
import { and, eq, isNotNull } from 'drizzle-orm';
import { env } from '../../config/env.js';
import { db } from '../../db/index.js';
import {
  departments,
  employeeBindingCodes,
  employees,
  users,
} from '../../db/schema/index.js';
import { mysqlDatetime, toShanghaiISO } from '../../lib/binding-code.js';
import { AppError } from '../../lib/errors.js';
import { signStaffToken } from '../../lib/jwt.js';
import { exchangeCodeForOpenid } from '../../lib/wechat.js';

export interface BoundEmployeeInfo {
  id: number;
  name: string;
  employeeNo: string;
  departmentName: string;
}

function staffTokenExpiresAt(): string {
  const expires = new Date(Date.now() + env.MINIAPP_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  return toShanghaiISO(expires);
}

function issueStaffSession(userId: number) {
  return {
    token: signStaffToken({ sub: userId, role: 'staff' }),
    expiresAt: staffTokenExpiresAt(),
  };
}

async function loadBoundEmployeeInfo(employeeId: number): Promise<BoundEmployeeInfo> {
  const [row] = await db
    .select({
      id: employees.id,
      name: employees.name,
      employeeNo: employees.employeeNo,
      departmentName: departments.name,
      employeeStatus: employees.status,
    })
    .from(employees)
    .innerJoin(departments, eq(employees.departmentId, departments.id))
    .where(eq(employees.id, employeeId))
    .limit(1);

  if (!row) {
    throw new AppError(404, 'NOT_FOUND', '员工不存在');
  }
  if (row.employeeStatus !== 'active') {
    throw new AppError(403, 'FORBIDDEN', '员工账号已停用');
  }

  return {
    id: row.id,
    name: row.name,
    employeeNo: row.employeeNo,
    departmentName: row.departmentName,
  };
}

function isBindingCodeExpired(expiresAt: string | null): boolean {
  if (!expiresAt) {
    return false;
  }
  return new Date(expiresAt) <= new Date();
}

function affectedRows(result: unknown): number {
  if (
    typeof result === 'object' &&
    result !== null &&
    'affectedRows' in result &&
    typeof (result as { affectedRows: unknown }).affectedRows === 'number'
  ) {
    return (result as { affectedRows: number }).affectedRows;
  }
  return 0;
}

function isDuplicateEntryError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    ('code' in error || 'errno' in error) &&
    ((error as { code?: unknown }).code === 'ER_DUP_ENTRY' ||
      (error as { errno?: unknown }).errno === 1062)
  );
}

async function findActiveBindingCode(bindingCode: string) {
  const activeRows = await db
    .select()
    .from(employeeBindingCodes)
    .where(eq(employeeBindingCodes.status, 'active'));

  for (const row of activeRows) {
    if (isBindingCodeExpired(row.expiresAt)) {
      continue;
    }
    const matched = await bcrypt.compare(bindingCode, row.codeHash);
    if (matched) {
      return row;
    }
  }

  return null;
}

export async function miniProgramLogin(code: string) {
  const { openid } = await exchangeCodeForOpenid(code);

  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.wxOpenid, openid), eq(users.role, 'staff')))
    .limit(1);

  if (!user || !user.employeeId) {
    return { bound: false as const };
  }

  if (user.status !== 'active') {
    throw new AppError(403, 'FORBIDDEN', '账号已停用');
  }

  const employee = await loadBoundEmployeeInfo(user.employeeId);
  const session = issueStaffSession(user.id);

  return {
    bound: true as const,
    ...session,
    employee,
  };
}

export async function miniProgramBind(
  code: string,
  bindingCode: string,
  phoneLastFour: string,
) {
  const { openid } = await exchangeCodeForOpenid(code);

  const [existingByOpenid] = await db
    .select()
    .from(users)
    .where(and(eq(users.wxOpenid, openid), eq(users.role, 'staff')))
    .limit(1);

  if (existingByOpenid?.employeeId) {
    throw new AppError(422, 'ALREADY_BOUND', '该微信已绑定员工');
  }

  const matchedCode = await findActiveBindingCode(bindingCode);
  if (!matchedCode) {
    throw new AppError(422, 'BINDING_CODE_INVALID', '绑定码无效或已过期');
  }

  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, matchedCode.employeeId))
    .limit(1);

  if (!employee || employee.status !== 'active') {
    throw new AppError(422, 'BINDING_CODE_INVALID', '绑定码无效或已过期');
  }

  if (employee.phone.slice(-4) !== phoneLastFour) {
    throw new AppError(422, 'PHONE_MISMATCH', '手机号后四位不匹配');
  }

  const [existingByEmployee] = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.role, 'staff'),
        eq(users.employeeId, employee.id),
        isNotNull(users.wxOpenid),
      ),
    )
    .limit(1);

  if (existingByEmployee) {
    throw new AppError(422, 'ALREADY_BOUND', '该员工已被其他微信绑定');
  }

  const now = mysqlDatetime(new Date());
  let staffUserId = 0;

  await db
    .transaction(async (tx) => {
      const [codeRow] = await tx
        .select()
        .from(employeeBindingCodes)
        .where(
          and(
            eq(employeeBindingCodes.id, matchedCode.id),
            eq(employeeBindingCodes.status, 'active'),
          ),
        )
        .limit(1);

      if (!codeRow || isBindingCodeExpired(codeRow.expiresAt)) {
        throw new AppError(422, 'BINDING_CODE_INVALID', '绑定码无效或已过期');
      }

      const [employeeBound] = await tx
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            eq(users.role, 'staff'),
            eq(users.employeeId, employee.id),
            isNotNull(users.wxOpenid),
          ),
        )
        .limit(1);

      if (employeeBound) {
        throw new AppError(422, 'ALREADY_BOUND', '该员工已被其他微信绑定');
      }

      const [consumeResult] = await tx
        .update(employeeBindingCodes)
        .set({ status: 'used', usedAt: now })
        .where(
          and(
            eq(employeeBindingCodes.id, matchedCode.id),
            eq(employeeBindingCodes.status, 'active'),
          ),
        );

      if (affectedRows(consumeResult) !== 1) {
        throw new AppError(422, 'BINDING_CODE_INVALID', '绑定码无效或已过期');
      }

      if (existingByOpenid) {
        await tx
          .update(users)
          .set({ employeeId: employee.id })
          .where(eq(users.id, existingByOpenid.id));
        staffUserId = existingByOpenid.id;
      } else {
        const [result] = await tx.insert(users).values({
          role: 'staff',
          wxOpenid: openid,
          employeeId: employee.id,
          status: 'active',
          tokenValidAfter: now,
        });
        staffUserId = Number(result.insertId);
      }
    })
    .catch((error: unknown) => {
      if (error instanceof AppError) {
        throw error;
      }
      if (isDuplicateEntryError(error)) {
        throw new AppError(422, 'ALREADY_BOUND', '该微信或员工已完成绑定');
      }
      throw error;
    });

  const employeeInfo = await loadBoundEmployeeInfo(employee.id);
  const session = issueStaffSession(staffUserId);

  return {
    bound: true as const,
    ...session,
    employee: employeeInfo,
  };
}

export async function getStaffMe(employeeId: number) {
  const employee = await loadBoundEmployeeInfo(employeeId);
  return { employee };
}

export async function miniProgramUnbind(userId: number, employeeId: number | null) {
  if (!employeeId) {
    throw new AppError(403, 'FORBIDDEN', '账号未绑定员工');
  }

  const now = mysqlDatetime(new Date());

  await db.transaction(async (tx) => {
    const [user] = await tx
      .select({ id: users.id, employeeId: users.employeeId })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.role, 'staff')))
      .limit(1);

    if (!user?.employeeId) {
      throw new AppError(403, 'FORBIDDEN', '账号未绑定员工');
    }

    await tx.update(users).set({ tokenValidAfter: now }).where(eq(users.id, userId));

    const [deleteResult] = await tx
      .delete(users)
      .where(and(eq(users.id, userId), eq(users.role, 'staff')));

    if (affectedRows(deleteResult) !== 1) {
      throw new AppError(500, 'INTERNAL_ERROR', '解绑失败，请稍后重试');
    }
  });

  return { ok: true as const };
}

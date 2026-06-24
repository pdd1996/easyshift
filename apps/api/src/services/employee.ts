import type { EmployeeDto } from '@easyshift/shared-types';
import bcrypt from 'bcryptjs';
import { and, count, desc, eq, inArray, isNotNull, ne } from 'drizzle-orm';
import { db } from '../db/index.js';
import { employeeBindingCodes, employees, users } from '../db/schema/index.js';
import {
  generateBindingCodePlain,
  mysqlDatetime,
  toShanghaiISO,
} from '../lib/binding-code.js';
import { AppError } from '../lib/errors.js';

const BINDING_CODE_TTL_HOURS = 72;

export interface CreateEmployeeInput {
  employeeNo: string;
  name: string;
  title?: string | null;
  phone: string;
}

export interface UpdateEmployeeInput extends CreateEmployeeInput {
  status?: 'active' | 'inactive';
}

export interface ListEmployeesQuery {
  status?: 'active' | 'inactive';
  page: number;
  pageSize: number;
}

function toEmployeeDto(
  row: typeof employees.$inferSelect,
  bindingStatus: 'bound' | 'unbound',
): EmployeeDto {
  return {
    id: row.id,
    employeeNo: row.employeeNo,
    name: row.name,
    title: row.title,
    phone: row.phone,
    status: row.status,
    bindingStatus,
  };
}

async function getBoundEmployeeIds(employeeIds: number[]): Promise<Set<number>> {
  if (employeeIds.length === 0) {
    return new Set();
  }

  const rows = await db
    .select({ employeeId: users.employeeId })
    .from(users)
    .where(
      and(
        eq(users.role, 'staff'),
        isNotNull(users.wxOpenid),
        inArray(users.employeeId, employeeIds),
      ),
    );

  return new Set(rows.map((r) => r.employeeId!).filter(Boolean));
}

async function assertEmployeeNoUnique(
  departmentId: number,
  employeeNo: string,
  excludeId?: number,
) {
  const conditions = [eq(employees.departmentId, departmentId), eq(employees.employeeNo, employeeNo)];
  if (excludeId !== undefined) {
    conditions.push(ne(employees.id, excludeId));
  }

  const [existing] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(and(...conditions))
    .limit(1);

  if (existing) {
    throw new AppError(409, 'EMPLOYEE_NO_DUPLICATE', '工号已存在');
  }
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

function handleEmployeeNoDuplicate(error: unknown): never {
  if (isDuplicateEntryError(error)) {
    throw new AppError(409, 'EMPLOYEE_NO_DUPLICATE', '工号已存在');
  }
  throw error;
}

async function getEmployeeRow(departmentId: number, id: number) {
  const [row] = await db
    .select()
    .from(employees)
    .where(and(eq(employees.id, id), eq(employees.departmentId, departmentId)))
    .limit(1);

  if (!row) {
    throw new AppError(404, 'NOT_FOUND', '员工不存在');
  }

  return row;
}

export async function listEmployees(departmentId: number, query: ListEmployeesQuery) {
  const conditions = [eq(employees.departmentId, departmentId)];
  if (query.status) {
    conditions.push(eq(employees.status, query.status));
  }

  const whereClause = and(...conditions);

  const [totalRow] = await db.select({ total: count() }).from(employees).where(whereClause);
  const total = totalRow?.total ?? 0;

  const offset = (query.page - 1) * query.pageSize;
  const rows = await db
    .select()
    .from(employees)
    .where(whereClause)
    .orderBy(desc(employees.createdAt))
    .limit(query.pageSize)
    .offset(offset);

  const boundIds = await getBoundEmployeeIds(rows.map((r) => r.id));

  return {
    data: rows.map((row) =>
      toEmployeeDto(row, boundIds.has(row.id) ? 'bound' : 'unbound'),
    ),
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total,
    },
  };
}

export async function getEmployee(departmentId: number, id: number): Promise<EmployeeDto> {
  const row = await getEmployeeRow(departmentId, id);
  const boundIds = await getBoundEmployeeIds([row.id]);
  return toEmployeeDto(row, boundIds.has(row.id) ? 'bound' : 'unbound');
}

export async function createEmployee(
  departmentId: number,
  input: CreateEmployeeInput,
): Promise<EmployeeDto> {
  await assertEmployeeNoUnique(departmentId, input.employeeNo);

  const [result] = await db
    .insert(employees)
    .values({
      departmentId,
      employeeNo: input.employeeNo,
      name: input.name,
      title: input.title ?? null,
      phone: input.phone,
      status: 'active',
    })
    .catch(handleEmployeeNoDuplicate);

  const id = Number(result.insertId);
  return getEmployee(departmentId, id);
}

export async function updateEmployee(
  departmentId: number,
  id: number,
  input: UpdateEmployeeInput,
): Promise<EmployeeDto> {
  const existing = await getEmployeeRow(departmentId, id);
  await assertEmployeeNoUnique(departmentId, input.employeeNo, id);

  const now = mysqlDatetime(new Date());

  await db
    .transaction(async (tx) => {
      await tx
        .update(employees)
        .set({
          employeeNo: input.employeeNo,
          name: input.name,
          title: input.title ?? null,
          phone: input.phone,
          ...(input.status !== undefined ? { status: input.status } : {}),
        })
        .where(eq(employees.id, existing.id));

      if (existing.status === 'active' && input.status === 'inactive') {
        await tx
          .update(users)
          .set({ tokenValidAfter: now })
          .where(and(eq(users.employeeId, existing.id), eq(users.role, 'staff')));
      }
    })
    .catch(handleEmployeeNoDuplicate);

  return getEmployee(departmentId, id);
}

export async function deactivateEmployee(departmentId: number, id: number): Promise<EmployeeDto> {
  const existing = await getEmployeeRow(departmentId, id);

  if (existing.status === 'inactive') {
    return getEmployee(departmentId, id);
  }

  const now = mysqlDatetime(new Date());

  await db.transaction(async (tx) => {
    await tx.update(employees).set({ status: 'inactive' }).where(eq(employees.id, existing.id));

    await tx
      .update(users)
      .set({ tokenValidAfter: now })
      .where(and(eq(users.employeeId, existing.id), eq(users.role, 'staff')));
  });

  return getEmployee(departmentId, id);
}

export async function generateBindingCode(
  departmentId: number,
  employeeId: number,
  adminUserId: number,
) {
  const employee = await getEmployeeRow(departmentId, employeeId);
  if (employee.status !== 'active') {
    throw new AppError(422, 'BUSINESS_RULE_VIOLATION', '停用员工不能生成绑定码');
  }

  const plainCode = generateBindingCodePlain();
  const codeHash = await bcrypt.hash(plainCode, 10);
  const expiresAt = new Date(Date.now() + BINDING_CODE_TTL_HOURS * 60 * 60 * 1000);
  const expiresAtDb = mysqlDatetime(expiresAt);

  await db.transaction(async (tx) => {
    await tx
      .update(employeeBindingCodes)
      .set({ status: 'expired' })
      .where(
        and(
          eq(employeeBindingCodes.employeeId, employeeId),
          eq(employeeBindingCodes.status, 'active'),
        ),
      );

    await tx.insert(employeeBindingCodes).values({
      employeeId,
      codeHash,
      status: 'active',
      expiresAt: expiresAtDb,
      createdBy: adminUserId,
    });
  });

  return {
    bindingCode: plainCode,
    expiresAt: toShanghaiISO(expiresAt),
  };
}

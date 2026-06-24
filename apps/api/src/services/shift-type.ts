import type { ShiftTypeDto } from '@easyshift/shared-types';
import { and, asc, eq, ne } from 'drizzle-orm';
import { db } from '../db/index.js';
import { shiftTypes } from '../db/schema/index.js';
import { AppError } from '../lib/errors.js';

export interface ShiftTypeInput {
  code: string;
  name: string;
  startTime?: string | null;
  durationMinutes?: number | null;
  color: string;
  minRequiredCount: number;
  sortOrder: number;
}

function normalizeTime(value: string | null | undefined): string | null {
  if (value == null || value === '') {
    return null;
  }
  if (/^\d{2}:\d{2}$/.test(value)) {
    return `${value}:00`;
  }
  return value;
}

function toShiftTypeDto(row: typeof shiftTypes.$inferSelect): ShiftTypeDto {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    startTime: row.startTime,
    durationMinutes: row.durationMinutes,
    color: row.color,
    minRequiredCount: row.minRequiredCount,
    status: row.status,
    sortOrder: row.sortOrder,
  };
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

function handleCodeDuplicate(error: unknown): never {
  if (isDuplicateEntryError(error)) {
    throw new AppError(409, 'SHIFT_TYPE_CODE_DUPLICATE', '班次代码已存在');
  }
  throw error;
}

async function assertCodeUnique(departmentId: number, code: string, excludeId?: number) {
  const conditions = [eq(shiftTypes.departmentId, departmentId), eq(shiftTypes.code, code)];
  if (excludeId !== undefined) {
    conditions.push(ne(shiftTypes.id, excludeId));
  }

  const [existing] = await db
    .select({ id: shiftTypes.id })
    .from(shiftTypes)
    .where(and(...conditions))
    .limit(1);

  if (existing) {
    throw new AppError(409, 'SHIFT_TYPE_CODE_DUPLICATE', '班次代码已存在');
  }
}

async function getShiftTypeRow(departmentId: number, id: number) {
  const [row] = await db
    .select()
    .from(shiftTypes)
    .where(and(eq(shiftTypes.id, id), eq(shiftTypes.departmentId, departmentId)))
    .limit(1);

  if (!row) {
    throw new AppError(404, 'NOT_FOUND', '班次类型不存在');
  }

  return row;
}

export async function listShiftTypes(departmentId: number): Promise<ShiftTypeDto[]> {
  const rows = await db
    .select()
    .from(shiftTypes)
    .where(eq(shiftTypes.departmentId, departmentId))
    .orderBy(asc(shiftTypes.sortOrder), asc(shiftTypes.id));

  return rows.map(toShiftTypeDto);
}

export async function createShiftType(
  departmentId: number,
  input: ShiftTypeInput,
): Promise<ShiftTypeDto> {
  await assertCodeUnique(departmentId, input.code);

  const [result] = await db
    .insert(shiftTypes)
    .values({
      departmentId,
      code: input.code,
      name: input.name,
      startTime: normalizeTime(input.startTime),
      durationMinutes: input.durationMinutes ?? null,
      color: input.color,
      minRequiredCount: input.minRequiredCount,
      sortOrder: input.sortOrder,
      status: 'active',
    })
    .catch(handleCodeDuplicate);

  const id = Number(result.insertId);
  const row = await getShiftTypeRow(departmentId, id);
  return toShiftTypeDto(row);
}

export async function updateShiftType(
  departmentId: number,
  id: number,
  input: ShiftTypeInput,
): Promise<ShiftTypeDto> {
  await getShiftTypeRow(departmentId, id);
  await assertCodeUnique(departmentId, input.code, id);

  await db
    .update(shiftTypes)
    .set({
      code: input.code,
      name: input.name,
      startTime: normalizeTime(input.startTime),
      durationMinutes: input.durationMinutes ?? null,
      color: input.color,
      minRequiredCount: input.minRequiredCount,
      sortOrder: input.sortOrder,
    })
    .where(and(eq(shiftTypes.id, id), eq(shiftTypes.departmentId, departmentId)))
    .catch(handleCodeDuplicate);

  const row = await getShiftTypeRow(departmentId, id);
  return toShiftTypeDto(row);
}

export async function deactivateShiftType(departmentId: number, id: number): Promise<ShiftTypeDto> {
  const existing = await getShiftTypeRow(departmentId, id);

  if (existing.status === 'inactive') {
    return toShiftTypeDto(existing);
  }

  await db
    .update(shiftTypes)
    .set({ status: 'inactive' })
    .where(eq(shiftTypes.id, existing.id));

  const row = await getShiftTypeRow(departmentId, id);
  return toShiftTypeDto(row);
}

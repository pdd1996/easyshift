import type { DepartmentDto } from '@easyshift/shared-types';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { departments } from '../db/schema/index.js';
import { AppError } from '../lib/errors.js';
import { getDefaultDepartment } from '../lib/department.js';

function toDepartmentDto(row: typeof departments.$inferSelect): DepartmentDto {
  return {
    id: row.id,
    name: row.name,
  };
}

export async function getDepartment(): Promise<DepartmentDto> {
  const department = await getDefaultDepartment();
  return toDepartmentDto(department);
}

export async function updateDepartment(name: string): Promise<DepartmentDto> {
  const department = await getDefaultDepartment();

  await db.update(departments).set({ name }).where(eq(departments.id, department.id));

  const [updated] = await db
    .select()
    .from(departments)
    .where(eq(departments.id, department.id))
    .limit(1);

  if (!updated) {
    throw new AppError(500, 'INTERNAL_ERROR', '科室更新失败');
  }

  return toDepartmentDto(updated);
}

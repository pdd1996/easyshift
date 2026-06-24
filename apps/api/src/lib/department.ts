import { db } from '../db/index.js';
import { departments } from '../db/schema/index.js';
import { AppError } from './errors.js';

export async function getDefaultDepartment() {
  const [department] = await db.select().from(departments).limit(1);
  if (!department) {
    throw new AppError(500, 'INTERNAL_ERROR', '科室数据未初始化，请先执行 seed');
  }
  return department;
}

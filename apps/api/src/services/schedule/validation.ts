import { getScheduleGrid } from './grid.js';

export interface ScheduleWarning {
  code: string;
  workDate?: string;
  shiftTypeId?: number;
  message: string;
}

export interface ValidationResult {
  errors: ScheduleWarning[];
  warnings: ScheduleWarning[];
}

export async function validatePeriod(
  departmentId: number,
  periodId: number,
): Promise<ValidationResult> {
  const grid = await getScheduleGrid(departmentId, periodId);

  return {
    errors: [],
    warnings: grid.warnings,
  };
}

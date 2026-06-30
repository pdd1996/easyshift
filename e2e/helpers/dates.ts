import { weekStartFromDate } from '@easyshift/shared-types';
import dayjs from 'dayjs';

/** 为 E2E 选择远离日常数据的周一，避免与本地排班冲突。 */
export function e2eWeekStart(suffix: number): string {
  const baseMonday = dayjs('2099-01-05');
  return baseMonday.add(suffix * 7, 'day').format('YYYY-MM-DD');
}

/** 将 Playwright clock 固定在该周的周三，便于「本周」按钮命中目标周期。 */
export function e2eClockTime(weekStart: string): Date {
  return new Date(`${weekStart}T12:00:00+08:00`);
}

export function addDays(workDate: string, days: number): string {
  return dayjs(workDate).add(days, 'day').format('YYYY-MM-DD');
}

export { weekStartFromDate };

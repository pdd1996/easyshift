import dayjs from 'dayjs';

function formatWeekRange(weekStart: string): string {
  const end = dayjs(weekStart).add(6, 'day');
  return `${dayjs(weekStart).format('M月D日')}–${end.format('M月D日')}`;
}

function formatPublishedAt(publishedAt: string): string {
  return dayjs(publishedAt).format('YYYY-MM-DD HH:mm');
}

export function buildNotificationText(
  departmentName: string,
  weekStart: string,
  version: number,
  publishedAt: string,
): string {
  const weekLabel = formatWeekRange(weekStart);
  const timeLabel = formatPublishedAt(publishedAt);
  return `【${departmentName}】${weekLabel} 班表已更新（第 ${version} 版），请打开小程序查看。\n发布时间：${timeLabel}`;
}

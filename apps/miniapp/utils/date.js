const WEEKDAY_LABELS = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatYMD(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** 将 Date 转为 Asia/Shanghai 日历日（不含时分秒） */
function toShanghaiCalendarDate(date) {
  const ms = date.getTime();
  const shanghaiMs = ms + (480 + date.getTimezoneOffset()) * 60000;
  const sh = new Date(shanghaiMs);
  return new Date(sh.getFullYear(), sh.getMonth(), sh.getDate());
}

/** 计算 date 所在周的周一（Asia/Shanghai 日历日） */
function weekStartFromDate(date) {
  const d = toShanghaiCalendarDate(date || new Date());
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return formatYMD(d);
}

function parseYMD(ymd) {
  const [y, m, day] = ymd.split('-').map(Number);
  return new Date(y, m - 1, day);
}

function addWeeks(weekStart, weeks) {
  const d = parseYMD(weekStart);
  d.setDate(d.getDate() + weeks * 7);
  return formatYMD(d);
}

function weekdayLabel(weekday) {
  return WEEKDAY_LABELS[weekday] || '';
}

function formatMonthDay(workDate) {
  const d = parseYMD(workDate);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function formatWeekRange(weekStart) {
  const start = parseYMD(weekStart);
  const end = parseYMD(weekStart);
  end.setDate(end.getDate() + 6);
  const sameMonth = start.getMonth() === end.getMonth();
  if (sameMonth) {
    return `${start.getMonth() + 1}月${start.getDate()}日 - ${end.getDate()}日`;
  }
  return `${start.getMonth() + 1}月${start.getDate()}日 - ${end.getMonth() + 1}月${end.getDate()}日`;
}

function formatPublishedAt(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const sh = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
  return `${sh.getMonth() + 1}月${sh.getDate()}日 ${pad2(sh.getHours())}:${pad2(sh.getMinutes())}`;
}

function formatShiftTimeRange(startTime, durationMinutes) {
  if (!startTime || durationMinutes == null) return '';
  const parts = startTime.split(':');
  const h = Number(parts[0]);
  const m = Number(parts[1] || 0);
  const startTotal = h * 60 + m;
  const endTotal = startTotal + durationMinutes;
  const endH = Math.floor(endTotal / 60) % 24;
  const endM = endTotal % 60;
  return `${pad2(h)}:${pad2(m)} - ${pad2(endH)}:${pad2(endM)}`;
}

function isRestShift(shift) {
  if (!shift) return false;
  return shift.startTime == null && shift.durationMinutes == null;
}

module.exports = {
  weekStartFromDate,
  addWeeks,
  weekdayLabel,
  formatMonthDay,
  formatWeekRange,
  formatPublishedAt,
  formatShiftTimeRange,
  isRestShift,
};

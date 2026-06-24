import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';

dayjs.extend(utc);

export function nowShanghaiDatetime(): { mysql: string; iso: string } {
  const now = dayjs().utcOffset(8);
  return {
    mysql: now.format('YYYY-MM-DD HH:mm:ss'),
    iso: now.format('YYYY-MM-DDTHH:mm:ss+08:00'),
  };
}

export function mysqlDatetimeToIso(value: string): string {
  return dayjs.utc(value).utcOffset(8).format('YYYY-MM-DDTHH:mm:ss+08:00');
}

import { randomBytes } from 'node:crypto';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** 生成 6 位绑定码（不含易混淆字符） */
export function generateBindingCodePlain(): string {
  const bytes = randomBytes(6);
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[bytes[i]! % CODE_CHARS.length];
  }
  return code;
}

export function mysqlDatetime(date: Date): string {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

export function toShanghaiISO(date: Date): string {
  const formatted = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
  return `${formatted.replace(' ', 'T')}+08:00`;
}

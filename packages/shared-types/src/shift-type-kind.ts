export type ShiftTypeKind = 'day' | 'evening' | 'night' | 'off' | 'standby' | 'other';

export const SHIFT_TYPE_KINDS: ShiftTypeKind[] = [
  'day',
  'evening',
  'night',
  'off',
  'standby',
  'other',
];

/** 规则语义标签（管理端中文展示；code/name 仍可按科室习惯自由配置） */
export const SHIFT_TYPE_KIND_LABELS: Record<ShiftTypeKind, string> = {
  day: '白班',
  evening: '小夜班',
  night: '大夜班',
  off: '休息',
  standby: '备班',
  other: '其他（不参与规则）',
};

const LEGACY_CODE_KIND_MAP: Record<string, ShiftTypeKind> = {
  D: 'day',
  DAY: 'day',
  白: 'day',
  日: 'day',
  E: 'evening',
  EVENING: 'evening',
  N: 'night',
  NIGHT: 'night',
  夜: 'night',
  OFF: 'off',
  REST: 'off',
  休: 'off',
  SB: 'standby',
  STANDBY: 'standby',
  备: 'standby',
};

/** 迁移/兼容：按常见历史 code/显示短码推断 kind */
export function inferShiftTypeKindFromCode(code: string): ShiftTypeKind {
  return LEGACY_CODE_KIND_MAP[code.toUpperCase()] ?? 'other';
}

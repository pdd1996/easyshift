import { describe, expect, it } from 'vitest';
import { buildNotificationText } from './notification-text.js';

describe('buildNotificationText', () => {
  it('[u1] includes department, week range, version and publish time (AC-09)', () => {
    const text = buildNotificationText(
      '心内科一病区',
      '2026-06-22',
      2,
      '2026-06-20T10:00:00+08:00',
    );

    expect(text).toContain('【心内科一病区】');
    expect(text).toContain('6月22日');
    expect(text).toContain('第 2 版');
    expect(text).toContain('发布时间');
  });
});

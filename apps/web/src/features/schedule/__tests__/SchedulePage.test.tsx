import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SchedulePage } from '../SchedulePage';
import {
  buildMockScheduleGrid,
  mockScheduleWarnings,
} from '@/test/fixtures';
import { TEST_API_BASE } from '@/test/constants';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';

const FIXED_NOW = new Date('2026-06-24T12:00:00+08:00');

describe('SchedulePage', () => {
  beforeEach(() => {
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('[c1] 初次进入不展示 warnings 摘要，点击「检查排班」后展示', async () => {
    server.use(
      http.get(`${TEST_API_BASE}/schedule/periods/:periodId/grid`, () => {
        return HttpResponse.json({
          data: buildMockScheduleGrid({ warnings: mockScheduleWarnings }),
        });
      }),
    );

    renderWithProviders(<SchedulePage />);

    const checkButton = await screen.findByRole('button', { name: '检查排班（1）' });
    expect(screen.queryByText('排班警告')).not.toBeInTheDocument();

    fireEvent.click(checkButton);

    expect(await screen.findByText('排班警告')).toBeInTheDocument();
    expect(screen.getByText(mockScheduleWarnings[0]!.message)).toBeInTheDocument();
  });

  it('[s3] 排班表 grid 接口失败时显示加载失败错误态', async () => {
    server.use(
      http.get(`${TEST_API_BASE}/schedule/periods/:periodId/grid`, () => {
        return HttpResponse.json(
          { error: { code: 'INTERNAL_ERROR', message: '服务器错误' } },
          { status: 500 },
        );
      }),
    );

    renderWithProviders(<SchedulePage />);

    await waitFor(() => {
      expect(screen.getByText('排班表加载失败')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /重\s*试/ })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: '员工' })).not.toBeInTheDocument();
  });
});

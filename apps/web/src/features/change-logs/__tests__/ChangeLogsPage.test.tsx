import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ChangeLogsPage } from '../ChangeLogsPage';
import { mockChangeLogs, mockChangeLogFilterOptions } from '@/test/handlers';
import { mockEmployees, mockShiftTypes } from '@/test/fixtures';
import { TEST_API_BASE } from '@/test/constants';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';

const FIXED_NOW = new Date('2026-06-24T12:00:00+08:00');
let listRequests: URL[] = [];

function renderPage() {
  return renderWithProviders(
    <MemoryRouter>
      <ChangeLogsPage />
    </MemoryRouter>,
  );
}

describe('ChangeLogsPage', () => {
  beforeEach(() => {
    vi.setSystemTime(FIXED_NOW);
    listRequests = [];
    server.use(
      http.get(`${TEST_API_BASE}/schedule/change-logs`, ({ request }) => {
        listRequests.push(new URL(request.url));
        return HttpResponse.json({
          data: mockChangeLogs,
          meta: { page: 1, pageSize: 20, total: mockChangeLogs.length },
        });
      }),
      http.get(`${TEST_API_BASE}/schedule/change-logs/filter-options`, () => {
        return HttpResponse.json({ data: mockChangeLogFilterOptions });
      }),
      http.get(`${TEST_API_BASE}/employees`, () => {
        return HttpResponse.json({
          data: mockEmployees,
          meta: { page: 1, pageSize: 100, total: mockEmployees.length },
        });
      }),
      http.get(`${TEST_API_BASE}/shift-types`, () => {
        return HttpResponse.json({ data: mockShiftTypes });
      }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('[log2] 展示操作记录列表并支持查看详情', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: '操作记录' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '时间' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '操作' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '操作人' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '排班周' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '摘要' })).toBeInTheDocument();

    expect(await screen.findByText('保存排班')).toBeInTheDocument();

    fireEvent.click(screen.getByText('保存排班'));

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: '操作详情' })).toBeInTheDocument();
    });
    expect(screen.getByText('明细')).toBeInTheDocument();
  });

  it('[log2] 默认查询最近 7 天，并按时间范围切换参数', async () => {
    renderPage();

    await waitFor(() => {
      expect(listRequests.length).toBeGreaterThan(0);
    });
    expect(listRequests.at(-1)?.searchParams.get('from')).toBe('2026-06-18');
    expect(listRequests.at(-1)?.searchParams.get('to')).toBe('2026-06-24');
    expect(listRequests.at(-1)?.searchParams.get('page')).toBe('1');
    expect(listRequests.at(-1)?.searchParams.get('pageSize')).toBe('20');

    fireEvent.click(screen.getByText('最近 30 天'));
    await waitFor(() => {
      expect(listRequests.at(-1)?.searchParams.get('from')).toBe('2026-05-26');
    });
    expect(listRequests.at(-1)?.searchParams.get('to')).toBe('2026-06-24');

    fireEvent.click(screen.getByText('不限'));
    await waitFor(() => {
      expect(listRequests.at(-1)?.searchParams.has('from')).toBe(false);
    });
    expect(listRequests.at(-1)?.searchParams.has('to')).toBe(false);
  });

  it('[log2] 组合筛选会传递排班周、操作类型和操作人参数', async () => {
    renderPage();

    await screen.findByText('保存排班');

    const [periodSelect, actionSelect, operatorSelect] = screen.getAllByRole('combobox');
    fireEvent.mouseDown(periodSelect!);
    const periodOptions = await screen.findAllByText('6月22日 – 6月28日');
    fireEvent.click(periodOptions.at(-1)!);

    fireEvent.mouseDown(actionSelect!);
    const actionOptions = await screen.findAllByText('清除排班');
    fireEvent.click(actionOptions.at(-1)!);

    fireEvent.mouseDown(operatorSelect!);
    const operatorOptions = await screen.findAllByText('13800138000');
    fireEvent.click(operatorOptions.at(-1)!);

    await waitFor(() => {
      const latestParams = listRequests.at(-1)?.searchParams;
      expect(latestParams?.get('periodId')).toBe('1');
      expect(latestParams?.get('action')).toBe('entry_delete');
      expect(latestParams?.get('operatorId')).toBe('1');
    });
  });
});

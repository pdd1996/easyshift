import type { ScheduleEntryDto } from '@easyshift/shared-types';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SchedulePage } from '../../SchedulePage';
import { ScheduleGrid } from '../ScheduleGrid';
import {
  buildMockScheduleGrid,
  MOCK_WEEK_START,
  mockShiftTypes,
  mockTenEmployees,
} from '@/test/fixtures';
import { TEST_API_BASE } from '@/test/constants';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';

const FIXED_NOW = new Date('2026-06-24T12:00:00+08:00');
const WEEKDAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

describe('ScheduleGrid', () => {
  it('[r1] 渲染 10 行员工 × 7 列周一至周日', () => {
    const { container } = renderWithProviders(
      <ScheduleGrid
        weekStart={MOCK_WEEK_START}
        employees={mockTenEmployees}
        shiftTypes={mockShiftTypes}
        entries={[]}
        onAssignShift={vi.fn()}
        onClearShift={vi.fn()}
        isSaving={false}
      />,
    );

    expect(screen.getByRole('columnheader', { name: '员工' })).toBeInTheDocument();
    for (const label of WEEKDAY_LABELS) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }

    const bodyRows = container.querySelectorAll('tbody tr');
    expect(bodyRows).toHaveLength(10);

    for (const employee of mockTenEmployees) {
      expect(screen.getByText(employee.name)).toBeInTheDocument();
    }

    const interactiveCells = container.querySelectorAll('tbody button[type="button"]');
    expect(interactiveCells).toHaveLength(70);
  });
});

describe('SchedulePage schedule grid assignment', () => {
  beforeEach(() => {
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('[i1] 点击空单元格选择班次后保存并刷新显示', async () => {
    const entries: ScheduleEntryDto[] = [];
    let savedPayload: ScheduleEntryDto[] | null = null;

    server.use(
      http.get(`${TEST_API_BASE}/schedule/periods/:periodId/grid`, () => {
        return HttpResponse.json({
          data: buildMockScheduleGrid({ employees: mockTenEmployees, entries }),
        });
      }),
      http.put(`${TEST_API_BASE}/schedule/periods/:periodId/entries`, async ({ request }) => {
        const body = (await request.json()) as {
          entries: Array<{
            employeeId: number;
            workDate: string;
            shiftTypeId: number;
            note?: string | null;
          }>;
        };

        savedPayload = body.entries.map((entry) => ({
          employeeId: entry.employeeId,
          workDate: entry.workDate,
          shiftTypeId: entry.shiftTypeId,
          note: entry.note ?? null,
        }));

        entries.splice(0, entries.length, ...savedPayload);

        return HttpResponse.json({ data: savedPayload });
      }),
    );

    renderWithProviders(<SchedulePage />);

    await screen.findByText('员工1');

    const gridTable = screen.getAllByRole('table')[0]!;
    const firstEmployeeRow = within(gridTable).getByText('员工1').closest('tr')!;
    const mondayCellButton = within(firstEmployeeRow).getAllByRole('button')[0]!;

    fireEvent.click(mondayCellButton);

    const picker = await screen.findByText('选择班次');
    const shiftPicker = picker.closest('.ant-popover') ?? document.body;
    fireEvent.click(within(shiftPicker).getByRole('button', { name: mockShiftTypes[0]!.code }));

    await waitFor(() => {
      expect(savedPayload).toEqual([
        {
          employeeId: 1,
          workDate: MOCK_WEEK_START,
          shiftTypeId: mockShiftTypes[0]!.id,
          note: null,
        },
      ]);
    });

    await waitFor(() => {
      const mondayCellButton = within(firstEmployeeRow).getAllByRole('button')[0]!;
      expect(within(mondayCellButton).getByText(mockShiftTypes[0]!.code)).toBeInTheDocument();
    });
  });
});

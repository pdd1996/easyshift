import type { ScheduleEntryDto } from '@easyshift/shared-types';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
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

function getDateColumnHeader(headerRow: HTMLElement, monthDay: string): HTMLElement {
  const dateHeader = within(headerRow)
    .getAllByRole('columnheader')
    .find((header) => within(header).queryByText(monthDay));

  expect(dateHeader).toBeDefined();
  return dateHeader!;
}

function expectDateHeaderTag(headerRow: HTMLElement, monthDay: string, tagText: string) {
  expect(within(getDateColumnHeader(headerRow, monthDay)).getByText(tagText)).toBeInTheDocument();
}

function expectDateHeaderWithoutTag(headerRow: HTMLElement, monthDay: string, tagText: string) {
  expect(within(getDateColumnHeader(headerRow, monthDay)).queryByText(tagText)).not.toBeInTheDocument();
}

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

  it('[r6] 日期表头展示周末、法定节假日、调休/放假标记', () => {
    const { unmount: unmountHolidayWeek } = renderWithProviders(
      <ScheduleGrid
        weekStart="2026-06-15"
        employees={mockTenEmployees.slice(0, 1)}
        shiftTypes={mockShiftTypes}
        entries={[]}
        onAssignShift={vi.fn()}
        onClearShift={vi.fn()}
        isSaving={false}
      />,
    );

    const holidayHeaderRow = screen.getByRole('columnheader', { name: '员工' }).closest('tr') as HTMLElement;

    expectDateHeaderTag(holidayHeaderRow, '06/19', '端午');
    expectDateHeaderTag(holidayHeaderRow, '06/20', '端午');
    expectDateHeaderTag(holidayHeaderRow, '06/21', '端午');
    expectDateHeaderWithoutTag(holidayHeaderRow, '06/18', '端午');
    expectDateHeaderWithoutTag(holidayHeaderRow, '06/20', '休');
    unmountHolidayWeek();

    const { unmount: unmountWeekendWeek } = renderWithProviders(
      <ScheduleGrid
        weekStart={MOCK_WEEK_START}
        employees={mockTenEmployees.slice(0, 1)}
        shiftTypes={mockShiftTypes}
        entries={[]}
        onAssignShift={vi.fn()}
        onClearShift={vi.fn()}
        isSaving={false}
      />,
    );

    const weekendHeaderRow = screen.getByRole('columnheader', { name: '员工' }).closest('tr') as HTMLElement;

    expectDateHeaderTag(weekendHeaderRow, '06/27', '休');
    expectDateHeaderTag(weekendHeaderRow, '06/28', '休');
    expectDateHeaderWithoutTag(weekendHeaderRow, '06/26', '休');
    unmountWeekendWeek();

    renderWithProviders(
      <ScheduleGrid
        weekStart="2026-02-09"
        employees={mockTenEmployees.slice(0, 1)}
        shiftTypes={mockShiftTypes}
        entries={[]}
        onAssignShift={vi.fn()}
        onClearShift={vi.fn()}
        isSaving={false}
      />,
    );

    const adjustedHeaderRow = screen.getByRole('columnheader', { name: '员工' }).closest('tr') as HTMLElement;

    expectDateHeaderTag(adjustedHeaderRow, '02/14', '班');
    expectDateHeaderTag(adjustedHeaderRow, '02/15', '春节');
    expectDateHeaderWithoutTag(adjustedHeaderRow, '02/13', '班');
    expectDateHeaderWithoutTag(adjustedHeaderRow, '02/14', '春节');
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

    renderWithProviders(
      <MemoryRouter>
        <SchedulePage />
      </MemoryRouter>,
    );

    await screen.findByText('员工1');

    const gridTable = screen.getAllByRole('table')[0]!;
    const firstEmployeeRow = within(gridTable).getByText('员工1').closest('tr')!;
    const mondayCellButton = within(firstEmployeeRow).getAllByRole('button')[0]!;

    fireEvent.click(mondayCellButton);

    const picker = await screen.findByText('选择班次');
    const shiftPicker = (picker.closest('.ant-popover') as HTMLElement | null) ?? document.body;
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

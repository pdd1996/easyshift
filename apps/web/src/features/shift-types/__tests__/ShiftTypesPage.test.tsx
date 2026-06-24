import { SHIFT_TYPE_KIND_LABELS } from '@easyshift/shared-types';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ShiftTypesPage } from '../ShiftTypesPage';
import { mockShiftTypes } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';

describe('ShiftTypesPage', () => {
  it('[r1] 列表含名称、代码、规则类型、时间段、颜色', async () => {
    renderWithProviders(<ShiftTypesPage />);

    expect(await screen.findByRole('columnheader', { name: '规则类型' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '代码' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '名称' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '时间段' })).toBeInTheDocument();

    expect(await screen.findByText('日班')).toBeInTheDocument();
    const codeItem = screen.getByText(mockShiftTypes[0]!.code).closest('.ant-space-item');
    const colorDot = codeItem?.previousElementSibling?.firstElementChild;
    expect(colorDot).toHaveStyle({
      backgroundColor: mockShiftTypes[0]!.color,
    });

    for (const shiftType of mockShiftTypes) {
      expect(screen.getByText(SHIFT_TYPE_KIND_LABELS[shiftType.kind])).toBeInTheDocument();
    }
  });
});

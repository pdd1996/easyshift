import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { DepartmentPage } from '../DepartmentPage';
import { TEST_API_BASE } from '@/test/constants';
import { server } from '@/test/server';
import { renderWithProviders } from '@/test/render';

const mockDepartment = { id: 1, name: '心内科一病区' };

describe('DepartmentPage', () => {
  it('[WEB-DEPT-01] 展示科室名称并支持编辑保存', async () => {
    let savedName = mockDepartment.name;
    let putCalled = false;

    server.use(
      http.get(`${TEST_API_BASE}/department`, () => {
        return HttpResponse.json({ data: { ...mockDepartment, name: savedName } });
      }),
      http.put(`${TEST_API_BASE}/department`, async ({ request }) => {
        const body = (await request.json()) as { name: string };
        putCalled = true;
        savedName = body.name;
        return HttpResponse.json({ data: { ...mockDepartment, name: savedName } });
      }),
    );

    renderWithProviders(<DepartmentPage />);

    const input = await screen.findByPlaceholderText('例如：心内科一病区');

    await waitFor(() => {
      expect(input).toHaveValue('心内科一病区');
    });

    fireEvent.change(input, { target: { value: '测试科室' } });
    fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }));

    await waitFor(() => {
      expect(putCalled).toBe(true);
      expect(savedName).toBe('测试科室');
    });
  });
});

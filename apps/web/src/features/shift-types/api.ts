import type { ShiftTypeDto } from '@easyshift/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, type ApiErrorBody } from '@/lib/api-client';
import type { AxiosError } from 'axios';

export interface ShiftTypeListResponse {
  data: ShiftTypeDto[];
}

export interface ShiftTypeFormValues {
  code: string;
  name: string;
  startTime?: string | null;
  durationMinutes?: number | null;
  color: string;
  minRequiredCount: number;
  sortOrder: number;
}

export function useShiftTypes() {
  return useQuery({
    queryKey: ['shift-types'],
    queryFn: async () => {
      const { data } = await apiClient.get<ShiftTypeListResponse>('/shift-types');
      return data.data;
    },
  });
}

export function useCreateShiftType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: ShiftTypeFormValues) => {
      const { data } = await apiClient.post<{ data: ShiftTypeDto }>('/shift-types', values);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-types'] });
    },
  });
}

export function useUpdateShiftType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...values }: ShiftTypeFormValues & { id: number }) => {
      const { data } = await apiClient.put<{ data: ShiftTypeDto }>(`/shift-types/${id}`, values);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-types'] });
    },
  });
}

export function useDeactivateShiftType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await apiClient.post<{ data: ShiftTypeDto }>(
        `/shift-types/${id}/deactivate`,
      );
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-types'] });
    },
  });
}

export function getApiErrorMessage(error: unknown, fallback = '操作失败'): string {
  const axiosError = error as AxiosError<ApiErrorBody>;
  return axiosError.response?.data?.error?.message ?? fallback;
}

export function formatShiftTimeRange(
  startTime: string | null,
  durationMinutes: number | null,
): string {
  if (!startTime) {
    return '—';
  }
  if (durationMinutes == null) {
    return startTime.slice(0, 5);
  }
  const [h, m] = startTime.split(':').map(Number);
  const totalMinutes = h! * 60 + m! + durationMinutes;
  const endH = Math.floor(totalMinutes / 60) % 24;
  const endM = totalMinutes % 60;
  const end = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
  return `${startTime.slice(0, 5)}–${end}`;
}

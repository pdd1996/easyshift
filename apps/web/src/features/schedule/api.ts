import type { PeriodEditStatus, ScheduleEntryDto, ScheduleGridDto } from '@easyshift/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, type ApiErrorBody } from '@/lib/api-client';
import type { AxiosError } from 'axios';

export interface PeriodDto {
  id: number;
  weekStart: string;
  editStatus: PeriodEditStatus;
  hasUnpublishedChanges: boolean;
  latestPublishedVersion: number | null;
  lastPublishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertEntryInput {
  employeeId: number;
  workDate: string;
  shiftTypeId: number;
  note?: string | null;
}

export function useSchedulePeriods(params: { fromWeekStart?: string; toWeekStart?: string }) {
  return useQuery({
    queryKey: ['schedule', 'periods', params],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: PeriodDto[] }>('/schedule/periods', {
        params,
      });
      return data.data;
    },
  });
}

export function useCreatePeriod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (weekStart: string) => {
      const { data } = await apiClient.post<{ data: PeriodDto }>('/schedule/periods', {
        weekStart,
      });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule', 'periods'] });
    },
  });
}

export function useScheduleGrid(periodId: number | null) {
  return useQuery({
    queryKey: ['schedule', 'grid', periodId],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: ScheduleGridDto }>(
        `/schedule/periods/${periodId}/grid`,
      );
      return data.data;
    },
    enabled: periodId != null,
  });
}

export function useUpsertEntries(periodId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (entries: UpsertEntryInput[]) => {
      const { data } = await apiClient.put<{ data: ScheduleEntryDto[] }>(
        `/schedule/periods/${periodId}/entries`,
        { entries },
      );
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule', 'grid', periodId] });
      queryClient.invalidateQueries({ queryKey: ['schedule', 'periods'] });
    },
  });
}

export function useDeleteEntry(periodId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { employeeId: number; workDate: string }) => {
      await apiClient.delete(`/schedule/periods/${periodId}/entries`, { data: payload });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule', 'grid', periodId] });
      queryClient.invalidateQueries({ queryKey: ['schedule', 'periods'] });
    },
  });
}

export function getApiErrorMessage(error: unknown, fallback = '操作失败'): string {
  const axiosError = error as AxiosError<ApiErrorBody>;
  return axiosError.response?.data?.error?.message ?? fallback;
}

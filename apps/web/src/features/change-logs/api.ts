import type {
  ScheduleChangeLogDto,
  ScheduleChangeLogFilterOptionsDto,
} from '@easyshift/shared-types';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface ChangeLogListParams {
  page: number;
  pageSize: number;
  from?: string;
  to?: string;
  periodId?: number;
  action?: string;
  operatorId?: number;
}

export interface ChangeLogListResponse {
  data: ScheduleChangeLogDto[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
  };
}

export function useChangeLogs(params: ChangeLogListParams) {
  return useQuery({
    queryKey: ['change-logs', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ChangeLogListResponse>('/schedule/change-logs', {
        params,
      });
      return data;
    },
  });
}

export function useChangeLogFilterOptions() {
  return useQuery({
    queryKey: ['change-logs', 'filter-options'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: ScheduleChangeLogFilterOptionsDto }>(
        '/schedule/change-logs/filter-options',
      );
      return data.data;
    },
  });
}

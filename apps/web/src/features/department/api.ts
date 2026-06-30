import type { DepartmentDto } from '@easyshift/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, type ApiErrorBody } from '@/lib/api-client';
import type { AxiosError } from 'axios';

export function useDepartment() {
  return useQuery({
    queryKey: ['department'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: DepartmentDto }>('/department');
      return data.data;
    },
  });
}

export function useUpdateDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { data } = await apiClient.put<{ data: DepartmentDto }>('/department', { name });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['department'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'me'] });
    },
  });
}

export function getApiErrorMessage(error: unknown, fallback = '操作失败'): string {
  const axiosError = error as AxiosError<ApiErrorBody>;
  return axiosError.response?.data?.error?.message ?? fallback;
}

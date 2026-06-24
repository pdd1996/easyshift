import type { EmployeeDto, EmployeeStatus } from '@easyshift/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, type ApiErrorBody } from '@/lib/api-client';
import type { AxiosError } from 'axios';

export interface EmployeeListResponse {
  data: EmployeeDto[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
  };
}

export interface EmployeeFormValues {
  employeeNo: string;
  name: string;
  title?: string;
  phone: string;
}

export interface BindingCodeResult {
  bindingCode: string;
  expiresAt: string;
}

export function useEmployees(params: { status?: EmployeeStatus; page: number; pageSize: number }) {
  return useQuery({
    queryKey: ['employees', params],
    queryFn: async () => {
      const { data } = await apiClient.get<EmployeeListResponse>('/employees', { params });
      return data;
    },
  });
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: EmployeeFormValues) => {
      const { data } = await apiClient.post<{ data: EmployeeDto }>('/employees', values);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...values }: EmployeeFormValues & { id: number }) => {
      const { data } = await apiClient.put<{ data: EmployeeDto }>(`/employees/${id}`, values);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

export function useDeactivateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await apiClient.post<{ data: EmployeeDto }>(`/employees/${id}/deactivate`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

export function useGenerateBindingCode() {
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await apiClient.post<{ data: BindingCodeResult }>(
        `/employees/${id}/binding-code`,
      );
      return data.data;
    },
  });
}

export function getApiErrorMessage(error: unknown, fallback = '操作失败'): string {
  const axiosError = error as AxiosError<ApiErrorBody>;
  return axiosError.response?.data?.error?.message ?? fallback;
}

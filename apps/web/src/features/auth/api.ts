import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface AdminSession {
  user: {
    id: number;
    phone: string;
    role: 'admin';
  };
  department: {
    id: number;
    name: string;
  };
}

export function useAdminSession() {
  return useQuery({
    queryKey: ['admin', 'me'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: AdminSession }>('/auth/admin/me');
      return data.data;
    },
    retry: false,
  });
}

export async function loginAdmin(phone: string, password: string) {
  const { data } = await apiClient.post<{ data: AdminSession }>('/auth/admin/login', {
    phone,
    password,
  });
  return data.data;
}

export async function logoutAdmin() {
  await apiClient.post('/auth/admin/logout');
}

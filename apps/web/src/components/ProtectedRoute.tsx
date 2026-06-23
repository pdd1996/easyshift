import { Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import { useAdminSession } from '@/features/auth/api';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { data, isLoading, isError } = useAdminSession();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  if (isError || !data) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

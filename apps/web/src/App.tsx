import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { EmployeesPage } from '@/features/employees/EmployeesPage';
import { ShiftTypesPage } from '@/features/shift-types/ShiftTypesPage';
import { SchedulePage } from '@/features/schedule/SchedulePage';
import { ChangeLogsPage } from '@/features/change-logs/ChangeLogsPage';
import { DepartmentPage } from '@/features/department/DepartmentPage';
import { LoginPage } from '@/features/auth/LoginPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="employees" element={<EmployeesPage />} />
          <Route path="shift-types" element={<ShiftTypesPage />} />
          <Route path="department" element={<DepartmentPage />} />
          <Route path="schedule" element={<SchedulePage />} />
          <Route path="change-logs" element={<ChangeLogsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

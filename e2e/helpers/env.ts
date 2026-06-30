export const E2E_CONFIG = {
  apiBaseUrl: process.env.E2E_API_BASE_URL ?? 'http://localhost:3000/api/v1',
  webOrigin: process.env.E2E_WEB_ORIGIN ?? 'http://localhost:5173',
  adminPhone: process.env.E2E_ADMIN_PHONE ?? '13800000000',
  adminPassword: process.env.E2E_ADMIN_PASSWORD ?? 'Admin@123456',
  wxMockCode: process.env.E2E_WX_MOCK_CODE ?? 'e2e_wx_code',
} as const;

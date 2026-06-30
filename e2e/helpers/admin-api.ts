import { E2E_CONFIG } from './env';

type ApiEnvelope<T> = { data: T };
type ApiError = { error: { code: string; message: string } };

export interface EmployeeRecord {
  id: number;
  name: string;
  employeeNo: string;
  phone: string;
  status: 'active' | 'inactive';
}

export interface ShiftTypeRecord {
  id: number;
  code: string;
  name: string;
  status: 'active' | 'inactive';
  kind?: string;
}

export interface SchedulePeriodRecord {
  id: number;
  weekStart: string;
  editStatus: 'draft' | 'published';
  latestPublishedVersion: number | null;
}

export interface PublishRecord {
  version: number;
  publishedAt: string;
}

export interface StaffScheduleRecord {
  version: number | null;
  status: 'not_published' | 'published';
  days: Array<{ workDate: string; shift: { code: string } | null }>;
}

async function parseJson<T>(res: Response): Promise<T> {
  const body = (await res.json()) as T | ApiError;
  if (!res.ok) {
    const message =
      typeof body === 'object' && body !== null && 'error' in body
        ? (body as ApiError).error.message
        : `HTTP ${res.status}`;
    throw new Error(message);
  }
  return body as T;
}

export class AdminApiClient {
  private cookie = '';

  async login(
    phone = E2E_CONFIG.adminPhone,
    password = E2E_CONFIG.adminPassword,
  ): Promise<void> {
    const res = await fetch(`${E2E_CONFIG.apiBaseUrl}/auth/admin/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: E2E_CONFIG.webOrigin,
      },
      body: JSON.stringify({ phone, password }),
    });

    const body = await parseJson<ApiEnvelope<unknown>>(res);
    const setCookie = res.headers.get('set-cookie');
    if (!setCookie) {
      throw new Error('Admin login missing Set-Cookie');
    }
    this.cookie = setCookie.split(';')[0]!;
    void body;
  }

  private adminHeaders(): Record<string, string> {
    if (!this.cookie) {
      throw new Error('AdminApiClient.login() must be called first');
    }
    return {
      'Content-Type': 'application/json',
      Origin: E2E_CONFIG.webOrigin,
      Cookie: this.cookie,
    };
  }

  async createEmployee(input: {
    employeeNo: string;
    name: string;
    phone: string;
    title?: string;
  }): Promise<EmployeeRecord> {
    const res = await fetch(`${E2E_CONFIG.apiBaseUrl}/employees`, {
      method: 'POST',
      headers: this.adminHeaders(),
      body: JSON.stringify(input),
    });
    const body = await parseJson<ApiEnvelope<EmployeeRecord>>(res);
    return body.data;
  }

  async createPeriod(weekStart: string): Promise<SchedulePeriodRecord> {
    const res = await fetch(`${E2E_CONFIG.apiBaseUrl}/schedule/periods`, {
      method: 'POST',
      headers: this.adminHeaders(),
      body: JSON.stringify({ weekStart }),
    });
    const body = await parseJson<ApiEnvelope<SchedulePeriodRecord>>(res);
    return body.data;
  }

  async listShiftTypes(): Promise<ShiftTypeRecord[]> {
    const res = await fetch(`${E2E_CONFIG.apiBaseUrl}/shift-types`, {
      headers: this.adminHeaders(),
    });
    const body = await parseJson<ApiEnvelope<ShiftTypeRecord[]>>(res);
    return body.data;
  }

  async createShiftType(input: {
    code: string;
    name: string;
    kind: 'day' | 'evening' | 'night' | 'off' | 'standby' | 'other';
    startTime?: string | null;
    durationMinutes?: number | null;
    color: string;
    minRequiredCount: number;
    sortOrder: number;
  }): Promise<ShiftTypeRecord> {
    const res = await fetch(`${E2E_CONFIG.apiBaseUrl}/shift-types`, {
      method: 'POST',
      headers: this.adminHeaders(),
      body: JSON.stringify(input),
    });
    const body = await parseJson<ApiEnvelope<ShiftTypeRecord>>(res);
    return body.data;
  }

  async ensureDayShiftType(code = 'D'): Promise<ShiftTypeRecord> {
    const shiftTypes = await this.listShiftTypes();
    const existing = shiftTypes.find((item) => item.code === code && item.status === 'active');
    if (existing) {
      return existing;
    }

    return this.createShiftType({
      code,
      name: '白班',
      kind: 'day',
      startTime: '08:00:00',
      durationMinutes: 480,
      color: '#4CAF50',
      minRequiredCount: 0,
      sortOrder: 99,
    });
  }

  async upsertEntries(
    periodId: number,
    entries: Array<{ employeeId: number; workDate: string; shiftTypeId: number }>,
  ): Promise<void> {
    const res = await fetch(`${E2E_CONFIG.apiBaseUrl}/schedule/periods/${periodId}/entries`, {
      method: 'PUT',
      headers: this.adminHeaders(),
      body: JSON.stringify({ entries }),
    });
    await parseJson<ApiEnvelope<unknown>>(res);
  }

  async publish(
    periodId: number,
    options?: { acknowledgeWarnings?: boolean },
  ): Promise<PublishRecord> {
    const res = await fetch(`${E2E_CONFIG.apiBaseUrl}/schedule/periods/${periodId}/publish`, {
      method: 'POST',
      headers: this.adminHeaders(),
      body: JSON.stringify(options ?? {}),
    });
    const body = await parseJson<ApiEnvelope<PublishRecord>>(res);
    return body.data;
  }

  async generateBindingCode(employeeId: number): Promise<string> {
    const res = await fetch(`${E2E_CONFIG.apiBaseUrl}/employees/${employeeId}/binding-code`, {
      method: 'POST',
      headers: this.adminHeaders(),
    });
    const body = await parseJson<ApiEnvelope<{ bindingCode: string }>>(res);
    return body.data.bindingCode;
  }

  async bindStaffEmployee(employee: EmployeeRecord, wxCode = E2E_CONFIG.wxMockCode): Promise<string> {
    const bindingCode = await this.generateBindingCode(employee.id);
    const res = await fetch(`${E2E_CONFIG.apiBaseUrl}/auth/miniprogram/bind`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: wxCode,
        bindingCode,
        phoneLastFour: employee.phone.slice(-4),
      }),
    });
    const body = await parseJson<ApiEnvelope<{ token: string }>>(res);
    return body.data.token;
  }

  async unbindStaff(token: string): Promise<void> {
    const res = await fetch(`${E2E_CONFIG.apiBaseUrl}/auth/miniprogram/unbind`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ confirm: true }),
    });
    await parseJson<ApiEnvelope<unknown>>(res);
  }

  async miniProgramLogin(wxCode = E2E_CONFIG.wxMockCode): Promise<
    | { bound: false }
    | { bound: true; token: string; employee: { id: number } }
  > {
    const res = await fetch(`${E2E_CONFIG.apiBaseUrl}/auth/miniprogram/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: wxCode }),
    });
    const body = await parseJson<
      ApiEnvelope<
        | { bound: false }
        | { bound: true; token: string; employee: { id: number } }
      >
    >(res);
    return body.data;
  }

  async getStaffSchedule(token: string, weekStart: string): Promise<StaffScheduleRecord> {
    const res = await fetch(
      `${E2E_CONFIG.apiBaseUrl}/staff/schedule?weekStart=${encodeURIComponent(weekStart)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    const body = await parseJson<ApiEnvelope<StaffScheduleRecord>>(res);
    return body.data;
  }

  async getStaffToken(employee: EmployeeRecord, wxCode = E2E_CONFIG.wxMockCode): Promise<string> {
    let loginState = await this.miniProgramLogin(wxCode);
    if (loginState.bound) {
      if (loginState.employee.id === employee.id) {
        return loginState.token;
      }
      await this.unbindStaff(loginState.token);
      loginState = await this.miniProgramLogin(wxCode);
    }

    try {
      return await this.bindStaffEmployee(employee, wxCode);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('该微信已绑定员工')) {
        throw new Error(
          `${message}。请停止现有 API 后执行 pnpm test:e2e（Playwright 会以 WX_MOCK_OPENID=e2e_playwright_openid 启动），或手动设置该环境变量后重启 API。`,
        );
      }
      throw error;
    }
  }
}

export async function waitForApiHealth(timeoutMs = 60_000): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`${E2E_CONFIG.apiBaseUrl}/health`);
      if (res.ok) {
        return;
      }
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`API health check timed out: ${E2E_CONFIG.apiBaseUrl}/health`);
}

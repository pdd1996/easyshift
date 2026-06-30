# EasyShift API 接口文档

| 项目 | 内容 |
|------|------|
| 文档版本 | v1.5 |
| 关联文档 | [PRD.md](./PRD.md) · [DATABASE.md](./DATABASE.md) · [SECURITY.md](./SECURITY.md) |

---

## 1. 总则

### 1.1 基础信息

| 项 | 值 |
|----|-----|
| Base URL | `/api/v1` |
| 协议 | HTTPS（生产）；本地开发可用 HTTP |
| 数据格式 | JSON，`Content-Type: application/json` |
| 字符编码 | UTF-8 |
| 时区 | 东八区（`Asia/Shanghai`），日期字段 `YYYY-MM-DD`，时间 `HH:mm:ss` |

### 1.2 鉴权

| 端 | 方式 | 说明 |
|----|------|------|
| Web 管理端 | HttpOnly Cookie | 登录成功后 Set-Cookie；后续请求自动携带；`withCredentials: true` |
| 小程序 | Bearer Token | `Authorization: Bearer <token>` |

未鉴权或 Token 无效返回 `401`。权限不足返回 `403`。

### 1.3 统一响应格式

**成功**（单资源）：

```json
{
  "data": { ... }
}
```

**成功**（列表，带分页）：

```json
{
  "data": [ ... ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 100
  }
}
```

**失败**：

```json
{
  "error": {
    "code": "EMPLOYEE_NO_DUPLICATE",
    "message": "工号已存在",
    "details": {}
  }
}
```

### 1.4 通用错误码

| HTTP | code | 说明 |
|------|------|------|
| 400 | `VALIDATION_ERROR` | 参数校验失败 |
| 401 | `UNAUTHORIZED` | 未登录或 Token 无效 |
| 403 | `FORBIDDEN` | 无权限 |
| 404 | `NOT_FOUND` | 资源不存在 |
| 409 | `CONFLICT` | 唯一约束冲突（工号、同天双班等） |
| 422 | `BUSINESS_RULE_VIOLATION` | 业务规则（如绑定码无效） |
| 429 | `RATE_LIMITED` | 限流 |
| 500 | `INTERNAL_ERROR` | 服务器错误 |

业务子码示例：`EMPLOYEE_NO_DUPLICATE`、`SCHEDULE_ENTRY_CONFLICT`、`BINDING_CODE_INVALID`、`PERIOD_NOT_PUBLISHED`。

### 1.5 写操作 CSRF（Web）

涉及状态变更的 Web 接口校验 `Origin` / `Referer` 与 `CORS_ORIGIN` 白名单一致。Cookie 设置 `SameSite=Lax`（或更严格）。

---

## 2. 认证 — Web 管理端

### POST `/auth/admin/login`

管理员登录。

**请求体**：

```json
{
  "phone": "13800000000",
  "password": "your_password"
}
```

**响应**：`200`，Set-Cookie +：

```json
{
  "data": {
    "user": {
      "id": 1,
      "phone": "13800000000",
      "role": "admin"
    },
    "department": {
      "id": 1,
      "name": "心内科一病区"
    }
  }
}
```

**错误**：`401` 账号或密码错误；`403` 账号已停用。

---

### POST `/auth/admin/logout`

登出，清除 Cookie。`200`。

---

### GET `/auth/admin/me`

当前登录管理员信息与科室。需 Cookie 鉴权。

---

## 3. 认证 — 小程序

### POST `/auth/miniprogram/login`

微信 `wx.login` 获取的 `code` 换 openid；已绑定员工返回 Token。

**请求体**：

```json
{
  "code": "wx_login_code"
}
```

**响应**（已绑定）：

```json
{
  "data": {
    "bound": true,
    "token": "eyJ...",
    "expiresAt": "2026-07-23T10:00:00+08:00",
    "employee": {
      "id": 1,
      "name": "张三",
      "employeeNo": "N001",
      "departmentName": "心内科一病区"
    }
  }
}
```

**响应**（未绑定）：`bound: false`，无 Token。

以下情况均返回 `bound: false`（HTTP `200`，非错误）：

- 微信 openid 无对应 staff 用户，或 `employee_id` 为空
- 关联员工 `employees.status = inactive`（Web 已停用）
- staff 用户 `users.status = disabled`

已停用员工的 wx 绑定关系可能仍保留在库中，但不再签发 Token。

---

### POST `/auth/miniprogram/bind`

绑定码 + 手机号后四位完成绑定并签发 Token。

**请求体**：

```json
{
  "code": "wx_login_code",
  "bindingCode": "A8K2M9",
  "phoneLastFour": "9000"
}
```

**错误**：`422` + `BINDING_CODE_INVALID` / `PHONE_MISMATCH` / `ALREADY_BOUND`。

---

### POST `/auth/miniprogram/unbind`

解绑当前微信与员工关系，作废 Token。需 Bearer 鉴权 + 二次确认参数。

**请求体**：`{ "confirm": true }`

**服务端行为**：先更新 `token_valid_after`，再**删除** staff `users` 行（不是仅清空绑定字段）。

**响应**：`200`，`{ "data": { "ok": true } }`

**后续**：旧 Token 访问任意 staff 接口 → `401`。

---

## 4. 科室

### GET `/department`

获取当前科室信息。Web admin。

**响应**：`200`

```json
{
  "data": {
    "id": 1,
    "name": "心内科一病区"
  }
}
```

---

### PUT `/department`

更新科室名称。Web admin。需 CSRF Origin 校验。

**请求体**：`{ "name": "心内科一病区" }`

**校验**：`name` 去首尾空格后 1–100 字符。

**响应**：`200`，字段同 GET。

**错误**：`400` 校验失败；`401` 未登录。

---

## 5. 员工管理

路径前缀 `/employees`。均需 Web admin 鉴权。

### GET `/employees`

员工列表。

**查询参数**：`status`（`active`/`inactive`）、`page`、`pageSize`

**响应项字段**：`id`、`employeeNo`、`name`、`title`、`phone`、`status`、`bindingStatus`（`bound`/`unbound`）

---

### POST `/employees`

新增员工。

**请求体**：

```json
{
  "employeeNo": "N001",
  "name": "张三",
  "title": "护士",
  "phone": "13900139000"
}
```

**错误**：`409` `EMPLOYEE_NO_DUPLICATE`

---

### GET `/employees/:id`

员工详情。

---

### PUT `/employees/:id`

更新员工。v1 允许修改 `employeeNo`，但必须保持科室内唯一；重复时返回 `409 EMPLOYEE_NO_DUPLICATE`。

**请求体**：

```json
{
  "employeeNo": "N001",
  "name": "张三",
  "title": "护士",
  "phone": "13900139000",
  "status": "active"
}
```

---

### POST `/employees/:id/deactivate`

停用员工。停用后不可新排班，历史保留。

**服务端行为**：

- 设置 `employees.status = inactive`
- 更新关联 staff 用户的 `token_valid_after = 当前时间`
- **保留** `wx_openid` / `employee_id`（Web 列表 `bindingStatus` 仍为 `bound`）

**小程序影响**：

- 再次调用 `/auth/miniprogram/login` → `bound: false`，不签发 Token
- 旧 Token 访问 `/staff/me` 或 `/staff/schedule`：
  - 默认 `401`（`iat < token_valid_after`，鉴权层拒绝）
  - 若 Token 仍通过鉴权但员工已 inactive → `403`（业务层拒绝）
- 客户端应清本地 session 并回到绑定页

**说明**：停用不等于解绑。v1 无 Web 管理员强制解绑接口；换手机需小程序自助解绑（P2）或运维手动处理。

---

### POST `/employees/:id/binding-code`

生成绑定码（使旧 active 码失效）。仅允许为在职且未绑定微信的员工生成。

**响应**：

```json
{
  "data": {
    "bindingCode": "A8K2M9",
    "expiresAt": "2026-06-27T10:00:00+08:00"
  }
}
```

明文绑定码仅在此响应中出现一次。

**错误**：

- `422 BUSINESS_RULE_VIOLATION`：员工已停用，不能生成绑定码。
- `422 ALREADY_BOUND`：员工已绑定微信，不能再次生成绑定码。

---

## 6. 班次类型

路径前缀 `/shift-types`。Web admin。

### GET `/shift-types`

列表，默认按 `sortOrder` 排序。

### POST `/shift-types`

创建班次类型。

**请求体**：

```json
{
  "code": "D",
  "name": "白班",
  "kind": "day",
  "startTime": "08:00:00",
  "durationMinutes": 480,
  "color": "#4CAF50",
  "minRequiredCount": 3,
  "sortOrder": 1
}
```

`kind` 为规则语义字段（`day` / `evening` / `night` / `off` / `standby` / `other`），决定排班校验如何识别大夜、白班等；`code` / `name` 可按科室习惯自由显示（中文、英文均可）。

### PUT `/shift-types/:id`

更新（被历史引用时不可删，只能停用）。请求体字段同 POST，含必填 `kind`。

### POST `/shift-types/:id/deactivate`

停用班次类型。

---

## 7. 排班周期与条目

### GET `/schedule/periods`

按周查询周期列表。Web admin。

**查询参数**：`fromWeekStart`、`toWeekStart`（date）

---

### POST `/schedule/periods`

创建排班周期（若已存在同周返回现有或 `409`）。

**请求体**：`{ "weekStart": "2026-06-22" }` — 必须为周一

---

### GET `/schedule/periods/:periodId`

周期详情 + 元数据：`editStatus`、`hasUnpublishedChanges`、`latestPublishedVersion`、`lastPublishedAt`

---

### GET `/schedule/periods/:periodId/grid`

Web 排班表整表数据。

**响应**：

```json
{
  "data": {
    "period": { ... },
    "employees": [ ... ],
    "shiftTypes": [ ... ],
    "entries": [
      {
        "employeeId": 1,
        "workDate": "2026-06-22",
        "shiftTypeId": 1,
        "note": null
      }
    ],
    "dailyCoverage": [ ... ],
    "warnings": [ ... ]
  }
}
```

`warnings` 与 [`GET /validation`](#get-scheduleperiodsperiodidvalidation) 使用同一套规则，见下方「排班警告代码」。

---

### PUT `/schedule/periods/:periodId/entries`

批量 upsert 排班条目（单元格保存）。

**请求体**：

```json
{
  "entries": [
    {
      "employeeId": 1,
      "workDate": "2026-06-22",
      "shiftTypeId": 1,
      "note": null
    }
  ]
}
```

`PUT` 仅用于设置或更新班次，`shiftTypeId` 必须为有效班次类型 ID；不接受 `null`。清空排班格子统一使用 `DELETE /schedule/periods/:periodId/entries`。

**错误**：

- `400 VALIDATION_ERROR`：`shiftTypeId` 为空或不是有效班次类型 ID
- `409 SCHEDULE_ENTRY_CONFLICT`：同员工同天重复（WEB-VAL-01）

**副作用**：已发布周期写入后 `hasUnpublishedChanges = true`。

---

### DELETE `/schedule/periods/:periodId/entries`

清空指定排班格子。

**请求体**：`{ "employeeId": 1, "workDate": "2026-06-22" }`

若指定格子原本不存在，返回 `204 No Content`，保持幂等。

**副作用**：已发布周期删除后 `hasUnpublishedChanges = true`。

---

### POST `/schedule/periods/:periodId/copy-from-previous-week`

复制上周草稿到当前周期（覆盖目标周已有草稿）。PRD AC-04。

**请求体**：无或 `{ "sourceWeekStart": "2026-06-15" }`（默认上周）

---

### GET `/schedule/periods/:periodId/validation`

校验警告摘要（不阻断保存，供「检查排班」与发布弹窗展示）。

**响应**：

```json
{
  "data": {
    "errors": [],
    "warnings": [
      {
        "code": "COVERAGE_BELOW_MIN",
        "workDate": "2026-06-22",
        "shiftTypeId": 1,
        "message": "D 仅 2 人，低于最低 3 人"
      },
      {
        "code": "CONSECUTIVE_NIGHT",
        "workDate": "2026-06-22",
        "message": "张三 连续 3 天大夜班（06-22–06-24），超过上限 2 天"
      },
      {
        "code": "REST_VIOLATION",
        "workDate": "2026-06-23",
        "shiftTypeId": 1,
        "message": "张三 在大夜班（06-22）结束后 0 小时内又排白班（06-23）"
      }
    ]
  }
}
```

#### 排班警告代码

v1 软警告均不阻断保存；发布时若存在任意 warning，需传 `acknowledgeWarnings: true` 确认。

| code | PRD | 说明 |
|------|-----|------|
| `COVERAGE_BELOW_MIN` | WEB-VAL-04 | 某天某班次已排人数低于 `minRequiredCount` |
| `CONSECUTIVE_NIGHT` | WEB-VAL-03 | 员工连续大夜班（`kind = night`）超过 2 天（默认阈值 2，即 3 天连排才警告） |
| `REST_VIOLATION` | WEB-VAL-02 | 大夜班（`kind = night`）结束后 24 小时内又排白班（`kind = day`） |

`errors` 数组保留供未来硬错误扩展；v1 同天双班（WEB-VAL-01）在保存时以 `409 SCHEDULE_ENTRY_CONFLICT` 返回，不走此接口。

---

### GET `/schedule/periods/:periodId/stats`

公平性统计：每人大夜班次数、总班次数等。Web 侧栏。

---

## 8. 发布

### POST `/schedule/periods/:periodId/publish`

发布本周期。事务内：锁定 period → 递增 version → 写入 snapshot → 更新 period → 写 change_log。

**请求体**（可选）：`{ "acknowledgeWarnings": true }` — 存在排班 warnings（覆盖不足 + 规则警告）时需确认

**响应**：

```json
{
  "data": {
    "version": 2,
    "publishedAt": "2026-06-20T10:00:00+08:00",
    "notificationText": "【心内科一病区】下周班表已更新..."
  }
}
```

**错误**：

- `422 UNACKNOWLEDGED_WARNINGS`：存在排班 warnings 且未传 `acknowledgeWarnings: true`；`error.details.warnings` 含完整警告列表
- `409 PUBLISH_CONFLICT`：并发发布冲突（客户端可重试）

---

### GET `/schedule/periods/:periodId/notification-text`

生成微信群通知文案（不发布也可预览上一版）。Web admin。

---

## 9. 操作日志

科室维度查询操作记录。Web admin。

### GET `/schedule/change-logs`

**查询参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `page` | number | 默认 1 |
| `pageSize` | number | 默认 20，最大 100 |
| `from` | date | 可选；时间范围起始（含），如最近 7 天由前端计算传入 |
| `to` | date | 可选；时间范围结束（含）；「不限」时不传 `from`/`to` |
| `periodId` | number | 可选；筛选某排班周期 |
| `weekStart` | date | 可选；与 `periodId` 二选一即可 |
| `action` | enum | 可选：`entry_upsert` / `entry_delete` / `copy_from_week` / `publish` / `period_create` |
| `operatorId` | number | 可选 |

**响应**：

```json
{
  "data": [
    {
      "id": 1,
      "periodId": 10,
      "weekStart": "2026-06-22",
      "action": "entry_upsert",
      "operator": { "id": 1, "phone": "13800138000" },
      "detail": {
        "entries": [
          { "employeeId": 1, "workDate": "2026-06-22", "shiftTypeId": 1, "note": null }
        ]
      },
      "createdAt": "2026-06-24T10:00:00+08:00"
    }
  ],
  "meta": { "page": 1, "pageSize": 20, "total": 42 }
}
```

**说明**：

- 数据范围限定为当前科室（`schedule_periods.department_id`）
- 按 `created_at DESC, id DESC` 排序
- 无效 `periodId`（非本科室或不存在）返回 `404`

### GET `/schedule/change-logs/filter-options`

返回筛选下拉选项：

```json
{
  "data": {
    "operators": [{ "id": 1, "phone": "13800138000" }],
    "periods": [{ "id": 10, "weekStart": "2026-06-22" }],
    "actions": ["period_create", "entry_upsert", "entry_delete", "copy_from_week", "publish"]
  }
}
```

- `operators`：本科室日志中出现过的操作人
- `periods`：有日志记录的排班周期，按 `weekStart` 倒序
- `actions`：固定枚举列表

---

## 10. 小程序 — 员工班表

均需 Bearer + `staff` 角色。

### GET `/staff/me`

个人资料：姓名、工号、科室。

---

### GET `/staff/schedule`

我的班表（只读最新发布快照）。

**查询参数**：`weekStart`（date，周一）— 默认当前周

**响应**（已发布）：

```json
{
  "data": {
    "weekStart": "2026-06-22",
    "publishedAt": "2026-06-20T10:00:00+08:00",
    "version": 2,
    "days": [
      {
        "workDate": "2026-06-22",
        "weekday": 1,
        "shift": {
          "code": "D",
          "name": "白班",
          "startTime": "08:00:00",
          "durationMinutes": 480,
          "color": "#4CAF50"
        },
        "note": null
      }
    ]
  }
}
```

**响应**（未发布）：`publishedAt: null`，`days` 为空或带 `status: "not_published"`。

---

### GET `/staff/schedule/summary`

本周班次类型数量汇总（P2）。MP-STAT-01。

---

## 11. 健康检查

### GET `/health`

无需鉴权。`{ "status": "ok" }`

---

## 12. 共享类型（packages/shared-types/src）

以下类型由 `packages/shared-types/src` 导出，Web / 小程序 / API 共用：

| 类型 | 说明 |
|------|------|
| `UserRole` | `admin` \| `staff` |
| `EmployeeStatus` | `active` \| `inactive` |
| `PeriodEditStatus` | `draft` \| `published` |
| `ShiftTypeKind` | `day` \| `evening` \| `night` \| `off` \| `standby` \| `other` — 规则语义 |
| `SHIFT_TYPE_KIND_LABELS` | kind 中文展示标签（管理端） |
| `ShiftTypeDto` | 班次类型 API 形状（含 `kind`；`code`/`name` 为展示字段） |
| `ScheduleEntryDto` | 排班条目 |
| `ScheduleGridDto` | 整表响应 |
| `ScheduleChangeLogDto` | 操作记录条目（含 `periodId`、`weekStart`） |
| `ScheduleChangeLogFilterOptionsDto` | 操作记录筛选选项 |
| `StaffScheduleDayDto` | 员工端单日班表 |
| `ApiError` | 统一错误体 |
| `weekStartFromDate(date)` | 计算所在周周一 |

跨日班次：存储 `startTime` + `durationMinutes`；展示结束时间由客户端或 API 按 T-02 规则计算。

---

## 13. OpenAPI（后续）

v1 以本文档 + `shared-types` 为契约源。实现稳定后可导出 `docs/openapi.yaml` 供 MSW handler 与外部工具对齐。MSW handlers 路径：`apps/web/src/test/handlers.ts`。

---

## 14. 文档修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.5 | 2026-06-30 | 操作记录改为科室级 `GET /schedule/change-logs`；新增 filter-options |
| v1.3 | 2026-06-27 | 明确 login 未绑定条件、解绑删行、停用保留绑定及 401/403 语义 |
| v1.2 | 2026-06-24 | 班次类型新增 `kind` 规则语义字段；排班 warnings 基于 kind 而非 code |
| v1.1 | 2026-06-24 | 补充排班 warnings 代码表（WEB-VAL-02～04）、发布 `UNACKNOWLEDGED_WARNINGS` 说明 |
| v1.0 | 2026-06-23 | 初版 REST 契约 |

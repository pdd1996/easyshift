# EasyShift 数据库设计


| 项目   | 内容                                                                              |
| ---- | ------------------------------------------------------------------------------- |
| 文档版本 | v1.0                                                                            |
| 关联文档 | [PRD.md](./PRD.md) 第 7节 · [API.md](./API.md) · [TECH_STACK.md](./TECH_STACK.md) |


本文档在 PRD 数据模型概要基础上，补充索引、迁移策略、快照 JSON 结构及实现约束，作为 Drizzle schema 与 migration 的落地依据。

---

## 1. 设计原则


| 原则      | 说明                                                                       |
| ------- | ------------------------------------------------------------------------ |
| 主键      | `bigint unsigned` 自增，不用 UUID                                             |
| 租户边界    | v1 单科室，`department_id` 作为业务隔离字段                                          |
| 草稿与快照分离 | 员工端只读 `schedule_publish_snapshots`，不读 `schedule_entries`                 |
| 约束落库    | 唯一性、一人一天一班等必须数据库或事务内强保证                                                  |
| 外键      | 业务关系在 PRD 已定义；物理外键可选，v1 推荐 Drizzle 声明 + migration 中 `ON DELETE RESTRICT` |


---

## 2. ER 关系

```text
departments 1 ── * employees
departments 1 ── * shift_types
departments 1 ── * schedule_periods
schedule_periods 1 ── * schedule_entries
schedule_periods 1 ── * schedule_publish_snapshots
schedule_periods 1 ── * schedule_change_logs
employees 1 ── * schedule_entries
shift_types 1 ── * schedule_entries
employees 1 ── 0..1 users (staff, via users.employee_id)
employees 1 ── * employee_binding_codes
users (admin) ── * employee_binding_codes.created_by
users (admin) ── * schedule_periods.last_published_by
users (admin) ── * schedule_publish_snapshots.published_by
users (admin) ── * schedule_change_logs.operator_id
```

---

## 3. 表定义

字段类型约定见 PRD 第 7.4 节。下表「索引」列列出建议落库的索引名（实现时可微调）。

### 3.1 departments


| 字段         | 类型              | 约束       | 说明   |
| ---------- | --------------- | -------- | ---- |
| id         | bigint unsigned | PK, AI   |      |
| name       | varchar(100)    | NOT NULL | 科室名称 |
| created_at | datetime        | NOT NULL |      |
| updated_at | datetime        | NOT NULL |      |


**索引**：无额外唯一约束（v1 单科室）。

---

### 3.2 users

登录账号，非员工档案。

v1 中一条 `users` 记录只表示一种登录身份。现实中的同一个人如果既是管理员又是被排班员工，应拥有两条 `users` 记录：一条 `admin` 账号用于 Web 管理端，一条 `staff` 账号用于小程序员工端。`staff` 记录通过 `employee_id` 关联员工档案。


| 字段                | 类型              | 约束                         | 说明                            |
| ----------------- | --------------- | -------------------------- | ----------------------------- |
| id                | bigint unsigned | PK, AI                     |                               |
| phone             | varchar(20)     | NULL, UNIQUE               | 管理员手机号                        |
| password_hash     | varchar(255)    | NULL                       | bcrypt                        |
| role              | enum            | NOT NULL                   | `admin` / `staff`             |
| employee_id       | bigint unsigned | NULL, UNIQUE, FK→employees | staff 关联                      |
| wx_openid         | varchar(64)     | NULL, UNIQUE               | 微信 openid                     |
| status            | enum            | NOT NULL                   | `active` / `disabled`         |
| token_valid_after | datetime        | NOT NULL                   | 早于该时间签发的 Token / Web JWT 会话无效 |
| created_at        | datetime        | NOT NULL                   |                               |
| updated_at        | datetime        | NOT NULL                   |                               |


**业务约束**（服务层 + 可选 CHECK）：

- `role = admin` → `phone`、`password_hash` 必填，`employee_id`、`wx_openid` 为空
- `role = staff` → `employee_id`、`wx_openid` 必填，`phone`、`password_hash` 为空
- 登录、绑定成功时签发的 Token / Web JWT 会话必须包含签发时间 `iat`
- 服务端校验时必须读取用户当前状态，并拒绝 `iat < users.token_valid_after` 的旧凭证
- 员工停用、员工解绑、员工重新绑定、管理员停用、管理员改密时，必须更新对应用户的 `token_valid_after = 当前时间`

**索引**：

- `UNIQUE uk_users_phone (phone)`
- `UNIQUE uk_users_wx_openid (wx_openid)`
- `UNIQUE uk_users_employee_id (employee_id)`
- `INDEX idx_users_role_status (role, status)`

---

### 3.3 employees


| 字段            | 类型              | 约束                       | 说明                    |
| ------------- | --------------- | ------------------------ | --------------------- |
| id            | bigint unsigned | PK, AI                   |                       |
| department_id | bigint unsigned | NOT NULL, FK→departments |                       |
| employee_no   | varchar(20)     | NOT NULL                 | 工号                    |
| name          | varchar(20)     | NOT NULL                 |                       |
| title         | varchar(50)     | NULL                     | 岗位                    |
| phone         | varchar(20)     | NOT NULL                 | 11 位手机号               |
| status        | enum            | NOT NULL                 | `active` / `inactive` |
| created_at    | datetime        | NOT NULL                 |                       |
| updated_at    | datetime        | NOT NULL                 |                       |


**索引**：

- `UNIQUE uk_employees_dept_no (department_id, employee_no)`
- `INDEX idx_employees_dept_status (department_id, status)`

---

### 3.4 shift_types


| 字段                 | 类型              | 约束                  | 说明                    |
| ------------------ | --------------- | ------------------- | --------------------- |
| id                 | bigint unsigned | PK, AI              |                       |
| department_id      | bigint unsigned | NOT NULL, FK        |                       |
| code               | varchar(10)     | NOT NULL            | 显示简称，如 D、夜、DAY（科室内唯一） |
| name               | varchar(50)     | NOT NULL            | 显示名                   |
| kind               | enum            | NOT NULL, DEFAULT other | 规则语义：`day` / `evening` / `night` / `off` / `standby` / `other` |
| start_time         | time            | NULL                | 休息班可空                 |
| duration_minutes   | int unsigned    | NULL                | 持续分钟数                 |
| color              | varchar(20)     | NOT NULL            | 如 `#4CAF50`           |
| min_required_count | int unsigned    | NOT NULL, DEFAULT 0 | 每日最低覆盖                |
| status             | enum            | NOT NULL            | `active` / `inactive` |
| sort_order         | int             | NOT NULL, DEFAULT 0 |                       |
| created_at         | datetime        | NOT NULL            |                       |
| updated_at         | datetime        | NOT NULL            |                       |


**索引**：

- `UNIQUE uk_shift_types_dept_code (department_id, code)`
- `INDEX idx_shift_types_dept_status (department_id, status, sort_order)`

---

### 3.5 schedule_periods


| 字段                       | 类型              | 约束                  | 说明                    |
| ------------------------ | --------------- | ------------------- | --------------------- |
| id                       | bigint unsigned | PK, AI              |                       |
| department_id            | bigint unsigned | NOT NULL, FK        |                       |
| week_start               | date            | NOT NULL            | 周一日期                  |
| edit_status              | enum            | NOT NULL            | `draft` / `published` |
| has_unpublished_changes  | tinyint(1)      | NOT NULL, DEFAULT 0 |                       |
| latest_published_version | int unsigned    | NULL                | 员工端可见版本               |
| last_published_at        | datetime        | NULL                |                       |
| last_published_by        | bigint unsigned | NULL, FK→users      |                       |
| created_at               | datetime        | NOT NULL            |                       |
| updated_at               | datetime        | NOT NULL            |                       |


**索引**：

- `UNIQUE uk_periods_dept_week (department_id, week_start)`
- `INDEX idx_periods_dept_week (department_id, week_start DESC)`

**并发发布**：事务内对目标行执行 `SELECT ... FOR UPDATE`，再递增 `latest_published_version` 并写入快照。

---

### 3.6 schedule_entries

管理员编辑中的草稿排班明细。


| 字段            | 类型              | 约束                            | 说明        |
| ------------- | --------------- | ----------------------------- | --------- |
| id            | bigint unsigned | PK, AI                        |           |
| period_id     | bigint unsigned | NOT NULL, FK→schedule_periods |           |
| employee_id   | bigint unsigned | NOT NULL, FK→employees        |           |
| work_date     | date            | NOT NULL                      | 班次开始所在日历日 |
| shift_type_id | bigint unsigned | NOT NULL, FK→shift_types      |           |
| note          | varchar(255)    | NULL                          |           |
| created_at    | datetime        | NOT NULL                      |           |
| updated_at    | datetime        | NOT NULL                      |           |


**索引**：

- `UNIQUE uk_entries_period_emp_date (period_id, employee_id, work_date)`
- `INDEX idx_entries_period_date (period_id, work_date)`
- `INDEX idx_entries_period_shift (period_id, shift_type_id, work_date)` — 覆盖人数统计

---

### 3.7 schedule_publish_snapshots


| 字段            | 类型              | 约束                 | 说明     |
| ------------- | --------------- | ------------------ | ------ |
| id            | bigint unsigned | PK, AI             |        |
| period_id     | bigint unsigned | NOT NULL, FK       |        |
| version       | int unsigned    | NOT NULL           | 从 1 递增 |
| snapshot_data | json            | NOT NULL           | 全量快照   |
| published_at  | datetime        | NOT NULL           |        |
| published_by  | bigint unsigned | NOT NULL, FK→users |        |


**索引**：

- `UNIQUE uk_snapshots_period_version (period_id, version)`
- `INDEX idx_snapshots_period (period_id, version DESC)`

---

### 3.8 employee_binding_codes


| 字段          | 类型              | 约束                     | 说明                            |
| ----------- | --------------- | ---------------------- | ----------------------------- |
| id          | bigint unsigned | PK, AI                 |                               |
| employee_id | bigint unsigned | NOT NULL, FK→employees |                               |
| code_hash   | varchar(255)    | NOT NULL               | bcrypt 哈希，不明文存库               |
| status      | enum            | NOT NULL               | `active` / `used` / `expired` |
| expires_at  | datetime        | NULL                   | 可空表示不过期                       |
| used_at     | datetime        | NULL                   |                               |
| created_by  | bigint unsigned | NOT NULL, FK→users     |                               |
| created_at  | datetime        | NOT NULL               |                               |


**索引**：

- `INDEX idx_binding_employee_status (employee_id, status)`
- 条件唯一：同一 `employee_id` 仅一个 `active` — 服务层事务内先将旧 `active` 标为 `expired`，或使用生成列 + 唯一索引（实现二选一，结果须一致）

---

### 3.9 schedule_change_logs


| 字段          | 类型              | 约束                 | 说明  |
| ----------- | --------------- | ------------------ | --- |
| id          | bigint unsigned | PK, AI             |     |
| period_id   | bigint unsigned | NOT NULL, FK       |     |
| operator_id | bigint unsigned | NOT NULL, FK→users |     |
| action      | varchar(32)     | NOT NULL           | 见下表 |
| detail      | json            | NULL               |     |
| created_at  | datetime        | NOT NULL           |     |


**action 枚举（v1）**：`period_create`、`entry_upsert`、`entry_delete`、`copy_from_week`、`publish`

**索引**：

- `INDEX idx_change_logs_period (period_id, created_at DESC)`

---

### 3.10 swap_requests（v1.5 预留）

v1 migration 可建表但不实现业务；字段见 PRD 第 7.2 节。

---

## 4. 快照 JSON 结构（snapshot_data）

发布时由服务端从 `schedule_entries` + 关联表组装，冗余历史展示所需字段。

```json
{
  "meta": {
    "departmentId": 1,
    "departmentName": "心内科一病区",
    "weekStart": "2026-06-22",
    "version": 2,
    "publishedAt": "2026-06-20T10:00:00+08:00"
  },
  "shiftTypes": [
    {
      "id": 1,
      "code": "D",
      "name": "白班",
      "startTime": "08:00:00",
      "durationMinutes": 480,
      "color": "#4CAF50",
      "minRequiredCount": 3
    }
  ],
  "employees": [
    {
      "id": 1,
      "employeeNo": "N001",
      "name": "张三",
      "title": "护士"
    }
  ],
  "entries": [
    {
      "employeeId": 1,
      "workDate": "2026-06-22",
      "shiftTypeId": 1,
      "note": null
    }
  ],
  "dailyCoverage": [
    {
      "workDate": "2026-06-22",
      "byShiftType": [
        {
          "shiftTypeId": 1,
          "code": "D",
          "assignedCount": 4,
          "minRequiredCount": 3
        }
      ]
    }
  ]
}
```

员工端「我的班表」从快照中过滤 `entries` 中 `employeeId = 当前员工` 的记录，并 JOIN 快照内冗余的 `shiftTypes`。

---

## 5. 迁移策略

### 5.1 工具链

- Schema：`apps/api/src/db/schema/`
- 配置：`apps/api/drizzle.config.ts`
- 命令：`pnpm db:generate` → `pnpm db:migrate`

### 5.2 流程

1. 修改 Drizzle schema
2. `pnpm db:generate` 生成 SQL migration
3. **人工审查** migration 文件（索引、默认值、枚举变更）
4. 本地 `pnpm db:migrate` 验证
5. 提交 schema + migration 一并入库

### 5.3 环境


| 环境                   | 说明                                             |
| -------------------- | ---------------------------------------------- |
| development          | 可重建库；seed 脚本初始化                                |
| staging / production | 仅 forward migration；禁止 `drizzle-kit push` 直推生产 |


### 5.4 种子数据（seed）

首次 migrate 后执行 `pnpm db:seed`：

- 1 条 `departments`
- 1 条 `users`（admin）
- 默认 `shift_types`：D、E、N、OFF、SB（见 PRD 第 4.1.4 节），含对应 `kind` 回填

**迁移 `0002_shift_type_kind`**：为 `shift_types` 增加 `kind` 列，并按常见历史显示短码/名称回填（如 `D` / `DAY` / `白` → `day`，`N` / `NIGHT` / `夜` → `night`）。无法识别的班次保留为 `other`，升级后管理员应在班次配置页确认规则类型。已有库升级后需执行 `pnpm db:migrate`；开发库与 `easyshift_test` 测试库均需迁移。

---

## 6. 查询要点


| 场景      | 表                                            | 说明                                                 |
| ------- | -------------------------------------------- | -------------------------------------------------- |
| Web 排班表 | `schedule_entries` + employees + shift_types | 按 `period_id` 拉全量                                  |
| 覆盖人数    | `schedule_entries`                           | `GROUP BY work_date, shift_type_id`                |
| 员工班表    | `schedule_publish_snapshots`                 | `period_id` + `version = latest_published_version` |
| 绑定校验    | `employee_binding_codes` + `employees`       | 哈希比对 + 手机号后四位                                      |


---

## 7. 备份建议

见 [DEPLOYMENT.md](./DEPLOYMENT.md)。业务数据以 MySQL 全量 + 定期快照为主；`snapshot_data` JSON 体积随历史版本增长，v1 可接受（单科室周版本数量有限）。

---

## 8. 文档修订记录


| 版本   | 日期         | 说明               |
| ---- | ---------- | ---------------- |
| v1.1 | 2026-06-24 | `shift_types` 新增 `kind` 规则语义字段及迁移 0002 |
| v1.0 | 2026-06-23 | 初版，自 PRD 第 7 节展开 |



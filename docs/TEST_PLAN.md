# EasyShift 测试计划（v1.0）

| 项目 | 内容 |
|------|------|
| 文档版本 | v1.1 |
| 创建日期 | 2026-06-20 |
| 关联文档 | [PRD.md](./PRD.md) · [TECH_STACK.md](./TECH_STACK.md) |
| 适用范围 | v1.0 MVP（Web 管理端 + Hono API + 微信小程序） |

---

## 1. 目标与原则

### 1.1 为什么要测

EasyShift 的 bug 代价集中在：**排班规则算错、发布快照不一致、绑定越权、大夜班跨日展示混乱**。测试优先覆盖这些路径，而不是追求覆盖率数字。

### 1.2 分层原则

```text
单元测试（多）     → 纯逻辑：校验、统计、跨日、文案
API 集成测试（中） → 真 MySQL：发布事务、绑定、权限、唯一约束
Web 组件单测（少） → 排班表、覆盖统计等复杂 UI（MSW mock API）
Playwright E2E（少）→ Web 关键用户路径（5～8 条）
手工验收（小程序） → 真机微信，AC-10～13 清单
```

### 1.3 AI 时代的工作流

1. **propose 阶段**：根据 PRD / 本计划，在对应模块下维护 `test-spec.md`（或本节表格），产出 `[r*] [i*] [s*]` 断言 ID。
2. **apply 阶段**：生成测试时 `it('[i1] …')` 必须以 ID 开头；失败时可追溯 PRD 条目。
3. **维护**：UI 变更时优先改 test-spec 与 MSW handler，由 AI 同步更新测试。

### 1.4 断言 ID 约定

| 前缀 | 含义 | 示例 |
|------|------|------|
| `[rN]` | Render 渲染 | 表格列、状态徽章、空态文案 |
| `[iN]` | Interaction 交互 | 点击、提交、切换周 |
| `[sN]` | State 状态 | 错误提示、loading、接口失败态 |

每条 ID 在表格中关联：**PRD 需求 ID**、**AC 编号**（如有）、**测试类型**、**实现位置**。

### 1.5 测试类型代号

| 代号 | 含义 |
|------|------|
| `UNIT` | 纯函数单元测试，无 IO |
| `COMP` | React 组件测试（Vitest + Testing Library + MSW） |
| `API` | Hono 路由 + 真 MySQL 集成测试 |
| `E2E` | Playwright 端到端 |
| `MANUAL` | 手工验收（ mainly 小程序） |

---

## 2. 工具与目录

### 2.1 工具栈

| 层级 | 工具 |
|------|------|
| 单元 / 组件 / API | Vitest |
| 组件渲染 | `@testing-library/react` + `jsdom` |
| Mock HTTP | MSW（`setupServer` 用于组件测试） |
| API 测试 | Hono `app.request()` + Testcontainers MySQL 或 docker-compose test DB |
| E2E | Playwright（CI 内 headless，不用真实用户 Chrome / osascript） |
| 时间 mock | `vi.setSystemTime()` |
| 微信 API mock | 测试注入 `WeChatClient` fake 实现 |

Ant Design 组件测试默认使用 `jsdom`，并在测试 setup 中统一 polyfill `ResizeObserver`、`matchMedia`、`scrollIntoView` 等浏览器 API。后续如验证 `happy-dom` 兼容性足够，再评估切换。

### 2.2 目录结构（目标）

```text
easyshift/
├── apps/api/src/
│   ├── services/
│   │   ├── validation/
│   │   │   ├── schedule-validator.ts
│   │   │   └── __tests__/schedule-validator.test.ts    # UNIT
│   │   ├── stats/
│   │   └── publish/
│   └── __tests__/                                       # API
│       ├── setup.ts
│       ├── publish.test.ts
│       └── binding.test.ts
├── apps/web/src/
│   ├── features/schedule/
│   │   ├── ScheduleGrid.tsx
│   │   ├── test-spec.md                                 # 模块规格
│   │   └── __tests__/ScheduleGrid.test.tsx              # COMP
│   └── test/
│       ├── server.ts                                    # MSW setupServer
│       └── handlers.ts                                  # 组件测试 mock
├── packages/shared-types/src/
│   └── shift-time/__tests__/                            # UNIT 跨端
├── e2e/
│   ├── ui-test-spec.md                                  # E2E 行为 + 路由
│   └── *.spec.ts
├── docs/TEST_PLAN.md                                    # 本文档
└── vitest.workspace.ts
```

### 2.3 MSW 组件测试约定

- `apps/web/src/test/handlers.ts`：定义组件测试使用的 REST mock，与 [API.md](./API.md) / `packages/shared-types/src` 对齐。
- 组件单测：默认 handlers；用例内 `server.use()` 临时覆盖，跑完自动恢复。
- **不** 手 stub axios；**不** mock 组件内部业务函数。
- E2E 默认真 Web + 真 API + 真 MySQL，不默认启用 MSW；只有离线 UI smoke 场景才允许单独配置 Service Worker mock。

---

## 3. Mock 策略

| 对象 | 策略 | 原因 |
|------|------|------|
| MySQL + Drizzle | **不 mock**，用 test DB | 唯一约束、发布事务、行锁 |
| 微信 `code2session` | **mock** | CI 无法调真微信 |
| `Date.now()` | **mock**（按需） | 绑定码过期、跨日边界 |
| 绑定码随机数 | **mock seed**（按需） | 确定性断言 |
| Web 组件 API | **MSW** | 隔离 UI 与后端 |
| 排班校验纯函数 | **不 mock** | 直接测输入输出 |
| Ant Design 内部 | **不 mock** | 测真实交互 |

---

## 4. AC 验收标准 → 测试映射总表

| AC | 描述 | UNIT | COMP | API | E2E | MANUAL |
|----|------|:----:|:----:|:---:|:---:|:------:|
| AC-01 | 员工管理，工号唯一 | — | ✓ | ✓ | — | — |
| AC-02 | 班次配置 | ✓ | ✓ | ✓ | — | — |
| AC-03 | 10×7 排班编辑保存 | — | ✓ | ✓ | ✓ | — |
| AC-04 | 复制上周 | — | — | ✓ | — | — |
| AC-05 | 冲突检测 | ✓ | ✓ | ✓ | ✓ | — |
| AC-06 | 覆盖统计 | ✓ | ✓ | ✓ | — | — |
| AC-07 | 发布快照 | — | ✓ | ✓ | ✓ | — |
| AC-08 | 修改已发布可见性 | — | ✓ | ✓ | ✓ | — |
| AC-09 | 发布通知文案 | ✓ | ✓ | — | — | — |
| AC-10 | 绑定 | — | — | ✓ | — | ✓ |
| AC-11 | 草稿不可见 | — | — | ✓ | — | ✓ |
| AC-12 | 班表展示 | ✓ | — | ✓ | — | ✓ |
| AC-13 | 员工隔离 | — | — | ✓ | — | ✓ |

---

## 5. 模块 test-spec

以下各节为 **test-spec 骨架**。实现时在对应 feature 目录创建 `test-spec.md`，表格内容与本文保持同步。

---

### 5.1 认证（Web）

**PRD**：WEB-AUTH-01～04 · **文件**：`apps/web/src/features/auth/test-spec.md`

| ID | 类型 | PRD | 断言 | 测试 |
|----|------|-----|------|------|
| r1 | 渲染 | WEB-AUTH-03 | 未登录访问 `/schedule` 重定向登录页 | COMP |
| i1 | 交互 | WEB-AUTH-01 | 正确手机号+密码提交后进入首页 | COMP + E2E |
| s1 | 状态 | WEB-AUTH-01 | 错误密码显示明确错误文案 | COMP |
| s2 | 状态 | WEB-AUTH-02 | 登录响应 Set-Cookie 含 HttpOnly | API |

---

### 5.2 员工管理

**PRD**：WEB-EMP-01～07 · **AC**：AC-01 · **文件**：`apps/web/src/features/employees/test-spec.md`

| ID | 类型 | PRD | 断言 | 测试 |
|----|------|-----|------|------|
| r1 | 渲染 | WEB-EMP-01 | 表格列：姓名、工号、岗位、手机号、状态 | COMP |
| r2 | 渲染 | WEB-EMP-05 | 绑定状态列显示「已绑定」/「未绑定」 | COMP |
| i1 | 交互 | WEB-EMP-02 | 点「新增员工」打开表单 | COMP |
| i2 | 交互 | WEB-EMP-02 | 提交合法表单后列表刷新含新员工 | COMP + API |
| i3 | 交互 | WEB-EMP-06 | 点「生成绑定码」展示码并提供复制 | COMP + API |
| s1 | 状态 | WEB-EMP-02 / AC-01 | 工号重复 → 表单错误「工号已存在」 | COMP + API |
| s2 | 状态 | WEB-EMP-04 | 停用员工后状态为 inactive | API |
| s3 | 状态 | — | POST 重复工号返回 409 | API |

---

### 5.3 班次类型

**PRD**：WEB-SHIFT-01～05 · **AC**：AC-02 · **文件**：`apps/web/src/features/shift-types/test-spec.md`

| ID | 类型 | PRD | 断言 | 测试 |
|----|------|-----|------|------|
| r1 | 渲染 | WEB-SHIFT-01 | 列表含名称、代码、时间段、颜色 | COMP |
| i1 | 交互 | WEB-SHIFT-02 | 编辑大夜班开始时间与时长并保存 | COMP + API |
| i2 | 交互 | WEB-SHIFT-05 | 修改某班次最低覆盖人数 | COMP + API |
| s1 | 状态 | WEB-SHIFT-04 | 「休息」班次时间段可为空 | UNIT + API |
| s2 | 状态 | — | 代码重复返回 409 | API |
| u1 | 逻辑 | WEB-SHIFT 默认 N | 大夜班 20:00 + 720min → 展示跨至次日 08:00 | UNIT |

**UNIT 位置**：`packages/shared-types/src/shift-time/__tests__/`

---

### 5.4 排班表（核心）

**PRD**：WEB-SCH-01～10 · **AC**：AC-03、AC-06 · **文件**：`apps/web/src/features/schedule/test-spec.md`

| ID | 类型 | PRD | 断言 | 测试 |
|----|------|-----|------|------|
| r1 | 渲染 | WEB-SCH-01 / AC-03 | 10 行员工 × 7 列（周一至周日） | COMP + E2E |
| r2 | 渲染 | WEB-SCH-03 | 顶部展示周期起止日期与状态徽章 | COMP |
| r3 | 渲染 | WEB-SCH-09 | 单元格展示班次简称与配置颜色 | COMP |
| r4 | 渲染 | WEB-SCH-10 / AC-06 | 每日各班次「已排/最低」统计行 | COMP |
| r5 | 渲染 | WEB-STAT-03 / AC-06 | 未达标单元格/行高亮 | COMP |
| i1 | 交互 | WEB-SCH-02 / AC-03 | 点击空格弹出班次选择，选中后格内更新 | COMP + E2E |
| i2 | 交互 | WEB-SCH-02 | 支持清空单元格班次 | COMP |
| i3 | 交互 | WEB-SCH-04 | 「创建下周排班」生成空草稿周期 | COMP + API |
| i4 | 交互 | WEB-DEPT-03 | 切换上一周/下一周加载对应周期 | COMP |
| i5 | 交互 | WEB-SCH-05 | 已发布周期编辑首格时弹出二次确认 | COMP |
| s1 | 状态 | WEB-SCH-06 / AC-08 | 已发布周期改草稿后徽章「有未发布变更」 | COMP + API + E2E |
| s2 | 状态 | WEB-SCH-08 | 停用员工不出现在新周期行中 | API |
| s3 | 状态 | — | 接口 500 时排班表显示「加载失败」 | COMP |

---

### 5.5 冲突与校验

**PRD**：WEB-VAL-01～05 · **AC**：AC-05 · **文件**：`apps/api/src/services/validation/test-spec.md`

| ID | 类型 | PRD | 断言 | 测试 |
|----|------|-----|------|------|
| u1 | 逻辑 | WEB-VAL-01 / AC-05 | 同员工同天两班次 → `errors` 含 duplicate-day | UNIT |
| u2 | 逻辑 | WEB-VAL-02 | 大夜结束后 24h 内白班 → `warnings` 含 rest-violation | UNIT |
| u3 | 逻辑 | WEB-VAL-03 | 连续 3 天大夜 → `warnings` 含 consecutive-night | UNIT |
| u4 | 逻辑 | WEB-VAL-04 / AC-05 | 白班最低 3 人只排 2 人 → `warnings` 含 under-coverage | UNIT |
| u5 | 逻辑 | WEB-VAL-05 | 大夜次数 > 均值+1 → `warnings` 含 fairness | UNIT |
| s1 | 状态 | WEB-VAL-01 | 保存含 hard error 时 API 返回 422 | API |
| s2 | 状态 | WEB-VAL-04 | 仅 warnings 时保存成功但响应带 warnings | API |
| i1 | 交互 | AC-05 | 同天双班时 UI 阻止保存并展示错误 | COMP + E2E |

**UNIT 位置**：`apps/api/src/services/validation/__tests__/schedule-validator.test.ts`

---

### 5.6 覆盖人数统计

**PRD**：WEB-STAT-03 · **AC**：AC-06 · **文件**：`apps/api/src/services/stats/test-spec.md`

| ID | 类型 | PRD | 断言 | 测试 |
|----|------|-----|------|------|
| u1 | 逻辑 | AC-06 | 某日白班 3 人、最低 3 → 不标记 under | UNIT |
| u2 | 逻辑 | AC-06 | 某日大夜 0 人、最低 1 → 标记 under | UNIT |
| u3 | 逻辑 | — | 「休息」班次不计入当班覆盖（除非业务定义计入） | UNIT |
| u4 | 逻辑 | — | 停用班次不可新排，历史快照计数不变 | API |

---

### 5.7 发布

**PRD**：WEB-PUB-01～05 · **AC**：AC-07、AC-08、AC-09 · **文件**：`apps/web/src/features/publish/test-spec.md`

| ID | 类型 | PRD | 断言 | 测试 |
|----|------|-----|------|------|
| r1 | 渲染 | WEB-PUB-04 / AC-07 | 已发布周期显示版本号与发布时间 | COMP + E2E |
| i1 | 交互 | WEB-PUB-01 / AC-07 | 草稿态「发布本周期」可点击 | COMP + E2E |
| i2 | 交互 | WEB-PUB-02 | 发布前弹窗展示 warnings 摘要 | COMP + E2E |
| i3 | 交互 | WEB-PUB-05 / AC-09 | 发布成功后「复制通知文案」可用 | COMP |
| s1 | 状态 | WEB-PUB-01 | 无未发布变更的已发布周期按钮 disabled | COMP |
| s2 | 状态 | AC-07 | 发布后 `latest_published_version` 递增 | API |
| s3 | 状态 | AC-08 | 改草稿后员工 API 仍返回旧 snapshot version | API + E2E |
| s4 | 状态 | AC-08 | 再次发布后员工 API 返回新 snapshot version | API + E2E |
| s5 | 状态 | PRD 5.4 | 并发两次发布不产生重复 version | API |
| u1 | 逻辑 | WEB-PUB-05 / AC-09 | 通知文案含周期、版本、发布时间 | UNIT |

**API 位置**：`apps/api/src/__tests__/publish.test.ts`（最高优先级集成测试）

---

### 5.8 复制上周

**PRD**：WEB-SCH-07 · **AC**：AC-04 · **文件**：`apps/api/src/__tests__/schedule-copy.test.ts`

| ID | 类型 | PRD | 断言 | 测试 |
|----|------|-----|------|------|
| u1 | 逻辑 | AC-04 | 源周条目日期 +7 天映射到目标周 | UNIT |
| s1 | 状态 | AC-04 | 复制后目标周草稿条目数 = 源周非空条目数 | API |
| s2 | 状态 | WEB-SCH-07 | 复制覆盖目标周已有草稿 | API |

---

### 5.9 小程序绑定

**PRD**：MP-AUTH-01～08 · **AC**：AC-10 · **文件**：`apps/api/src/__tests__/binding.test.ts`

| ID | 类型 | PRD | 断言 | 测试 |
|----|------|-----|------|------|
| s1 | 状态 | AC-10 | 正确绑定码 + 手机号后四位 → 200，签发 Bearer Token | API |
| s2 | 状态 | MP-AUTH-06 | 错误绑定码 → 4xx + 明确 error code | API |
| s3 | 状态 | MP-AUTH-06 | 手机号后四位不匹配 → 4xx | API |
| s4 | 状态 | MP-AUTH-07 | 绑定成功后码 status=used | API |
| s5 | 状态 | MP-AUTH-04 | 已绑定员工再次绑定 → 4xx | API |
| s6 | 状态 | MP-AUTH-04 | 同一 openid 绑第二人 → 4xx | API |
| s7 | 状态 | A-03 | 解绑后旧 Token → 401 | API |

---

### 5.10 小程序班表

**PRD**：MP-SCH-01～07 · **AC**：AC-11、AC-12、AC-13

| ID | 类型 | PRD | 断言 | 测试 |
|----|------|-----|------|------|
| s1 | 状态 | AC-11 / MP-SCH-04 | 仅草稿无发布 → 空态「班表尚未发布」 | API + MANUAL |
| s2 | 状态 | AC-11 / MP-SCH-03 | 有发布快照 → 返回 entries | API + MANUAL |
| s3 | 状态 | AC-12 | 条目含班次名、日期、时间段、published_at | API + MANUAL |
| s4 | 状态 | MP-SCH-06 | OFF 休息班次显式展示，非空白 | API + MANUAL |
| s5 | 状态 | AC-13 | 员工 A token 查员工 B schedule → 403 | API |
| u1 | 逻辑 | MP-SCH / 风险表 | 大夜班跨日展示文案正确 | UNIT + MANUAL |

---

## 6. Playwright E2E 场景

**文件**：`e2e/ui-test-spec.md` + `e2e/*.spec.ts`

v1 **不做**多模态视觉 diff；仅行为断言。CI 内 headless Chromium + docker-compose 全栈。

| 场景 ID | 关联 AC | 步骤 | 期望 |
|---------|---------|------|------|
| E2E-01 | AC-03 | 登录 → 创建下周 → 为 10 人排满 7 天 → 保存 | 刷新后格子内容保留 |
| E2E-02 | AC-05、AC-06 | 故意少排大夜 → 点发布 | 确认弹窗含 coverage warning |
| E2E-03 | AC-05、AC-06 | 排班表存在覆盖不足 | 页面统计区高亮未达标班次 |
| E2E-04 | AC-07 | 发布成功 | 页面显示 version=1 与发布时间 |
| E2E-05 | AC-08 | 发布后改一格 → 查员工 API | 仍为 v1；再发布后 API 为 v2 |
| E2E-06 | AC-09 | 发布成功 → 点复制文案 | 剪贴板/textarea 含周期信息 |

同员工同天多班属于数据层异常，正常 10×7 UI 不应制造该状态；该规则由 `schedule-validator.test.ts` 与保存 API 的 422 集成测试覆盖，不进入 E2E。

**E2E interactions 示例**（YAML 风格，供生成脚本）：

```yaml
path: /schedule
interactions:
  - label: open-shift-picker
    action: click
    target: { byRole: cell, name: "周一-张三" }
    expect: popover-visible

  - label: publish-period
    action: click
    target: { byText: "发布本周期" }
    expect: dialog-with-warnings
```

---

## 7. API 集成测试清单（优先 implement）

| 文件 | 覆盖 | 优先级 |
|------|------|--------|
| `publish.test.ts` | AC-07、AC-08、并发版本、事务 | P0 |
| `binding.test.ts` | AC-10、AC-13、Token 失效 | P0 |
| `schedule-validator.integration.test.ts` | AC-05 保存 422/200+warnings | P0 |
| `employees.test.ts` | AC-01 工号唯一 | P0 |
| `shift-types.test.ts` | AC-02 | P1 |
| `schedule-copy.test.ts` | AC-04 | P1 |
| `staff-schedule.test.ts` | AC-11、AC-12 | P0 |
| `auth.test.ts` | Cookie、CSRF Origin 校验 | P1 |

**setup 要求**：

- 每个测试文件 `beforeAll` migrate + seed（1 科室、10 员工、默认班次、1 管理员）。
- 每个 Vitest worker 使用独立 test database；若使用共享 MySQL 实例，则数据库名带 worker id。
- 每个测试用例使用唯一 `department_id` / `week_start`，或在 `afterEach` 事务性清理，避免唯一约束互相污染。
- 并发发布测试单独串行执行，避免与其他发布用例共享同一 `schedule_periods` 行。

---

## 8. 单元测试清单（纯函数）

| 模块 | 文件 | 覆盖 ID |
|------|------|---------|
| 排班校验 | `schedule-validator.test.ts` | u1～u5（第 5.5 节） |
| 覆盖统计 | `coverage-counter.test.ts` | u1～u3（第 5.6 节） |
| 班次跨日 | `shift-time.test.ts` | u1（第 5.3 节）、u1（第 5.10 节） |
| 复制上周日期映射 | `copy-week.test.ts` | u1（第 5.8 节） |
| 通知文案 | `notify-text.test.ts` | u1（第 5.7 节） |

---

## 9. CI 与执行策略

```yaml
# 目标：PR 必过 fast path；main 跑全量

on: pull_request
  - pnpm test:unit          # 无 DB，< 30s
  - pnpm test:integration   # MySQL service container

on: push main / release
  - pnpm test:unit
  - pnpm test:integration
  - pnpm test:e2e           # docker-compose up + Playwright
```

| 失败后果 | 策略 |
|----------|------|
| UNIT / API 失败 | **阻塞** merge |
| E2E 失败 | **阻塞** release；PR 可选仅 warning |
| 小程序 MANUAL | 发版前 checklist 全勾 |

---

## 10. 手工验收清单（小程序）

发版前在真机微信完成：

- [ ] **AC-10** 正确绑定码 + 后四位成功；错误码、错后四位、已绑定均有明确提示
- [ ] **AC-11** 管理员未发布时小程序显示「班表尚未发布」
- [ ] **AC-11** 管理员发布后刷新可见班表
- [ ] **AC-12** 班次名、日期、时间段、最新发布时间与 Web 一致
- [ ] **AC-12** 大夜班跨日展示正确（不混乱）
- [ ] **AC-13** 两名员工各看各的，互不串数据
- [ ] **AC-08** 管理员改班未再发布时，员工仍看旧版；再发布后看新版

---

## 11. 实施顺序

| 阶段 | 内容 | 产出 |
|------|------|------|
| Phase 1 | Vitest workspace + 第一个 validator 单测 | `schedule-validator.test.ts` 绿 |
| Phase 2 | Testcontainers + migration + seed | `publish.test.ts` 绿 |
| Phase 3 | MSW handlers + ScheduleGrid 组件 3 条 | `[r1][i1][s3]` 绿 |
| Phase 4 | binding + staff-schedule API | AC-10、AC-11、AC-13 绿 |
| Phase 5 | Playwright E2E-01～05 | 发版前回归 |
| Phase 6 | 小程序手工清单 | 上线签字 |

---

## 12. 文档修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.1 | 2026-06-20 | 修正 E2E 边界、MSW 范围、DB 隔离与组件测试环境 |
| v1.0 | 2026-06-20 | 初版：AC 映射、test-spec 骨架、分层与 Mock 约定 |

# EasyShift 测试计划（v1.0）

| 项目 | 内容 |
|------|------|
| 文档版本 | v1.9 |
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

### 1.3 AI 时代的工作流（方案 A）

1. **拆解阶段**：新需求在 [.doc/specs/active/](../.doc/specs/active/) 生成 `spec.md` → `plan.md` → `tasks.md`；详见 [.doc/README.md](../.doc/README.md)。
2. **propose 阶段**：在对应模块 `test-spec.md` 维护 `[r*] [i*] [s*] [u*]` 断言 ID（见 §5 索引）。
3. **apply 阶段**：生成测试时 `it('[i1] …')` 必须以 ID 开头；失败时可追溯 PRD 条目。
4. **维护**：UI 变更时优先改 test-spec 与 MSW handler，由 AI 同步更新测试。

### 1.4 断言 ID 约定

| 前缀 | 含义 | 示例 |
|------|------|------|
| `[rN]` | Render 渲染 | 表格列、状态徽章、空态文案 |
| `[iN]` | Interaction 交互 | 点击、提交、切换周 |
| `[sN]` | State 状态 | 错误提示、loading、接口失败态 |
| `[uN]` | Unit / Logic 逻辑 | 纯函数、规则、格式化、统计 |

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

### 2.2 目录结构（方案 A）

```text
easyshift/
├── .doc/                                                # SDD 执行区（变更 spec/plan/tasks）
│   ├── prd/
│   ├── specs/active/                                    # 进行中的 feature spec
│   ├── specs/archive/
│   └── runs/
├── docs/                                                # 长期权威文档（PRD、API、本计划）
├── apps/api/src/services/
│   ├── schedule/test-spec.md                            # 校验、覆盖、复制上周
│   ├── auth/test-spec.md                                # 小程序绑定
│   └── staff/test-spec.md                               # 小程序班表 API
├── apps/web/src/features/
│   ├── auth/test-spec.md
│   ├── employees/test-spec.md
│   ├── shift-types/test-spec.md
│   └── schedule/test-spec.md                            # 排班表 + 发布 UI
├── apps/miniapp/test-spec.md                            # 小程序手工验收
├── e2e/ui-test-spec.md
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

## 5. 模块 test-spec 索引

断言详情维护在模块旁 `test-spec.md`；本节仅作索引，**勿在此重复表格**（避免双写漂移）。

| 模块 | PRD | AC | test-spec | SDD feature-id（新变更时） |
|------|-----|-----|-----------|---------------------------|
| 认证（Web） | WEB-AUTH-01～04 | — | [auth/test-spec.md](../apps/web/src/features/auth/test-spec.md) | `auth-web` |
| 员工管理 | WEB-EMP-01～07 | AC-01 | [employees/test-spec.md](../apps/web/src/features/employees/test-spec.md) | `employees` |
| 班次类型 | WEB-SHIFT-01～06 | AC-02 | [shift-types/test-spec.md](../apps/web/src/features/shift-types/test-spec.md) | `shift-types` |
| 排班表 + 发布 UI | WEB-SCH、WEB-PUB | AC-03、06～09 | [schedule/test-spec.md](../apps/web/src/features/schedule/test-spec.md) | `schedule-editor`、`schedule-publish` |
| 排班校验 / 覆盖 / 复制 | WEB-VAL、WEB-STAT、WEB-SCH-07 | AC-04～06 | [schedule/test-spec.md（API）](../apps/api/src/services/schedule/test-spec.md) | `schedule-validation` |
| 发布服务 | WEB-PUB | AC-07～09 | [schedule/test-spec.md（API）](../apps/api/src/services/schedule/test-spec.md) | `schedule-publish` |
| 小程序绑定 | MP-AUTH | AC-10 | [auth/test-spec.md（API）](../apps/api/src/services/auth/test-spec.md) | `miniapp-binding` |
| 小程序班表 | MP-SCH | AC-11～13 | [staff/test-spec.md](../apps/api/src/services/staff/test-spec.md) | `miniapp-my-schedule` |
| 小程序手工验收 | — | AC-10～13 | [miniapp/test-spec.md](../apps/miniapp/test-spec.md) | — |
| E2E | — | AC-03～09 | [e2e/ui-test-spec.md](../e2e/ui-test-spec.md) | — |

新功能拆解与执行包见 [.doc/specs/active/](../.doc/specs/active/)。

---

## 6. Playwright E2E 场景

场景表与实现状态见 [e2e/ui-test-spec.md](../e2e/ui-test-spec.md)。

v1 **不做**多模态视觉 diff；仅行为断言。E2E 通过 Playwright `webServer` 自动启动 Web + API，默认使用真 MySQL 与微信 mock。测试周次使用远期隔离周，避免与日常排班数据冲突；长期仍应补充 teardown 或测试库重置，避免 E2E 数据持续堆积。

**首发范围**：E2E-01 / 02 / 04 / 05 / 06 已实现；E2E-03 与 02 重叠，**不做**。E2E-02 / 06 对应逻辑亦在 API 单测（`publish.test.ts`、`validation.test.ts`、`notify-text.test.ts` 等）覆盖。

同员工同天多班属于数据层异常，正常 10×7 UI 不应制造该状态；该规则由 `schedule.test.ts`（409）与 `rule-warnings.test.ts` 覆盖，不进入 E2E。

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
| `schedule.test.ts` | AC-03、AC-05、AC-06、WEB-VAL-01 | P0 |
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
| 排班校验 | `rule-warnings.test.ts`、`validation.test.ts` | 见 `services/schedule/test-spec.md` |
| 覆盖统计 | `coverage-counter.test.ts` | 同上 |
| 班次跨日 | `shift-time.test.ts` | 见 `shift-types/test-spec.md`、staff test-spec |
| 复制上周日期映射 | `copy-week.test.ts` | 见 `services/schedule/test-spec.md` |
| 通知文案 | `notify-text.test.ts` | 见 `services/schedule/test-spec.md` |

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
  - pnpm test:e2e           # Playwright webServer 启动 Web + API
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
- [ ] **MP-UI-02** 系统 / 微信切换深色模式后，绑定页与班表页文字、背景、组件样式正确
- [ ] **AC-13** 两名员工各看各的，互不串数据
- [ ] **AC-08** 管理员改班未再发布时，员工仍看旧版；再发布后看新版
- [ ] **A-03 / WEB-EMP-04** Web 停用已绑定员工后，小程序重新进入班表 / 我的页应清 session 并回绑定页，不能继续查看已发布班表
- [ ] **WEB-EMP-06 / WEB-EMP-07** Web 已绑定员工不显示「绑定码」操作；直接调用生成绑定码接口返回 `ALREADY_BOUND`

---

## 11. 实施顺序

| 阶段 | 内容 | 产出 |
|------|------|------|
| Phase 1 | Vitest workspace + 排班规则单测 | `rule-warnings.test.ts` 绿 |
| Phase 2 | Testcontainers + migration + seed | `publish.test.ts` 绿 |
| Phase 3 | MSW handlers + ScheduleGrid 组件 3 条 | `[r1][i1][s3]` 绿 |
| Phase 4 | binding + staff-schedule API | AC-10、AC-11、AC-13 绿 |
| Phase 5 | Playwright E2E-01 / 02 / 04 / 05 / 06 | 发版前回归 |
| Phase 6 | 小程序手工清单 | 上线签字 |

---

## 12. 文档修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.9 | 2026-07-01 | 方案 A：`.doc/` SDD 工作区；§5 断言迁出至各模块 `test-spec.md` |
| v1.8 | 2026-06-30 | 补 Playwright E2E-02（覆盖 warning 弹窗）、E2E-06（复制通知文案） |
| v1.7 | 2026-06-30 | 明确 E2E 首发范围：01/04/05 已实现；02/03/06 不阻塞上线，后补 02+06 |
| v1.6 | 2026-06-30 | WEB-SCH-12 r6 已实现；补充日历单测路径与断言说明 |
| v1.5 | 2026-06-30 | 同步首批 Playwright E2E 实现：E2E-01/04/05、webServer 启动方式与隔离周次约定 |
| v1.4 | 2026-06-24 | 补充小程序 TDesign 与深色模式手工验收项 |
| v1.3 | 2026-06-24 | 班次类型 `kind`、规则校验与 code 解耦；迁移 0002 说明 |
| v1.2 | 2026-06-24 | 同步排班警告实现：warning 代码、测试文件路径、WEB-VAL-05 未实现标注 |
| v1.1 | 2026-06-20 | 修正 E2E 边界、MSW 范围、DB 隔离与组件测试环境 |
| v1.0 | 2026-06-20 | 初版：AC 映射、test-spec 骨架、分层与 Mock 约定 |

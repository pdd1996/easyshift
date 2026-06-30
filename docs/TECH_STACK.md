# EasyShift 技术栈定稿

| 项目 | 内容 |
|------|------|
| 文档版本 | v1.5 |
| 创建日期 | 2026-06-20 |
| 文档状态 | 已定稿 |
| 关联文档 | [PRD.md](./PRD.md) |

---

## 1. 总览

```text
Web 管理端：React + TypeScript + Vite + Ant Design + Tailwind CSS
小程序：     微信原生 + TypeScript + TDesign Miniprogram（深色模式）
后端 API：   Hono + Drizzle + MySQL 8
数据库工具： Navicat
Monorepo：   pnpm workspace
```

---

## 2. 选型原则

| 原则 | 说明 |
|------|------|
| AI 友好 | 优先选择 AI 生成代码成功率高、文档和示例丰富的技术 |
| SQL 可审查 | 使用 Drizzle 而非 Prisma；关键查询可通过 `.toSQL()` 审查 |
| 轻后端 | 不使用 NestJS；Hono 足够承载 v1 API |
| B 端优先 | Web 端以排班表为核心，Ant Design 表格/表单生态成熟 |
| 双端分离 | Web 与小程序 UI 分开实现，共享 API 与类型定义 |
| 主题一致 | 小程序 v1 适配系统深色模式；Web v1 保持浅色，深色模式后续评估 |
| 版本不过度锁死 | 新项目初始化时优先使用当时最新稳定版，仅在兼容性需要时锁定小版本 |

---

## 3. 各层技术选型

### 3.1 Web 管理端

| 技术 | 版本建议 | 用途 |
|------|----------|------|
| React | 最新稳定版 | UI 框架 |
| TypeScript | 最新稳定版 | 类型安全 |
| Vite | 最新稳定版 | 构建工具 |
| Ant Design | 最新稳定版 | 表格、表单、弹窗、布局等 B 端组件 |
| Tailwind CSS | 最新稳定版 | 页面布局、间距、局部样式 |
| React Router | 最新稳定版 | 路由 |
| TanStack Query | 最新稳定版 | 服务端状态、缓存、请求管理 |
| axios | 最新稳定版 | HTTP 客户端 |
| dayjs | 最新稳定版 | 日期处理 |
| zod | 最新稳定版 | 前端表单/接口数据校验（可选，与后端共用类型时） |

**不采用**

- shadcn/ui：v1 以排班表效率为先，表格体系需额外拼装
- Refine：核心页面为自定义排班表，框架收益有限

### 3.2 微信小程序（员工端）

| 技术 | 版本建议 | 说明 |
|------|----------|------|
| 微信原生小程序 | 基础库 ≥ 2.11.0 | v1 功能简单（绑定 + 看班表），原生最稳 |
| TypeScript | 最新稳定版 | 类型安全，与 Web/API 共享类型 |
| TDesign Miniprogram | 最新稳定版 | UI 组件库（`tdesign-miniprogram`），按需引入 |
| npm 构建 | — | 在微信开发者工具中「构建 npm」 |

**UI 组件库定稿：TDesign Miniprogram**

- v1 页面以表单、列表、空态、反馈为主，TDesign 覆盖完整。
- 与 Web 端 Ant Design 分工明确：Web 管 B 端排班，小程序管员工查看，不要求两端 UI 库一致。

**深色模式（Dark Mode）**

v1 要求小程序适配系统深色模式，默认跟随微信 / 系统主题切换。

| 层级 | 实现方式 |
|------|----------|
| 小程序框架 | `app.json` 配置 `"darkmode": true`；`theme.json` 定义导航栏、tabBar 等原生区域深浅色变量 |
| TDesign 组件 | 引入 `miniprogram_npm/tdesign-miniprogram/common/style/theme/_index.wxss`；组件通过 Design Token（`--td-*`）与 `prefers-color-scheme: dark` 自动切换 |
| 自定义页面 | 自定义 WXSS 使用 TDesign 颜色变量（如 `--td-bg-color-page`、`--td-text-color-primary`），避免硬编码 `#fff` / `#000` |
| 调试 | 微信开发者工具模拟器顶部切换「深色 / 浅色」；真机需在系统或微信中切换主题验收 |

**v1 范围**

- **包含**：跟随系统 / 微信主题的深浅色自动切换。
- **不包含**：小程序内独立「深色 / 浅色」开关（可留 v1.5；实现方式为根节点挂 `.light` / `.dark` 并覆盖 `--td-*` 变量，移除对媒体查询的依赖）。

**接入约定**

```text
apps/miniapp/
├── app.json              # darkmode: true
├── theme.json            # 原生区域 light / dark 变量
├── app.wxss              # @import TDesign theme
├── package.json          # 依赖 tdesign-miniprogram
└── pages/
```

```bash
pnpm miniapp:install
# 微信开发者工具 → 工具 → 构建 npm
```

组件按需引入示例：

```json
{
  "usingComponents": {
    "t-button": "tdesign-miniprogram/button/button",
    "t-input": "tdesign-miniprogram/input/input"
  }
}
```

官方文档：[TDesign 小程序](https://tdesign.tencent.com/miniprogram) · [深色模式](https://tdesign.tencent.com/miniprogram/dark-mode)

**不采用**

- Taro / uni-app：v1 小程序功能轻量，跨端框架增加复杂度，收益有限
- Vant Weapp：社区成熟，但**无官方深色模式适配**；v1 需深色模式时定制成本高

### 3.3 后端 API

| 技术 | 版本建议 | 用途 |
|------|----------|------|
| Hono | 最新稳定版 | 轻量 HTTP 框架、路由、中间件 |
| TypeScript | 最新稳定版 | 类型安全 |
| Drizzle ORM | 最新稳定版 | 类型安全数据库访问，SQL 风格查询 |
| mysql2 | 最新稳定版 | MySQL 驱动 |
| drizzle-kit | 最新稳定版 | Schema 管理与 migration |
| zod | 最新稳定版 | 请求体验证 |
| jsonwebtoken | 最新稳定版 | JWT 鉴权 |
| bcryptjs | 最新稳定版 | 管理员密码哈希 |
| dayjs | 最新稳定版 | 日期处理 |
| tsx | 最新稳定版 | 开发环境运行 TypeScript |

**鉴权承载方式**

| 客户端 | 承载方式 | 说明 |
|--------|----------|------|
| Web 管理端 | HttpOnly Cookie | 服务端设置 Cookie，前端不直接读写令牌，降低 XSS 窃取风险 |
| 微信小程序 | Bearer Token | 小程序没有浏览器 Cookie 同站策略，使用请求头 `Authorization: Bearer <token>` |

两端使用同一套服务端身份校验与权限模型，只是客户端保存和发送凭证的方式不同。

Web Cookie 需设置 `HttpOnly`、`Secure`、`SameSite=Lax` 或更严格策略；对发布、编辑、解绑等写操作接口增加 CSRF 防护。

**Token 生命周期**

| 场景 | 规则 |
|------|------|
| Web 管理端 | 会话默认 7 天有效；管理员停用或密码重置后旧会话失效 |
| 微信小程序 | Bearer Token 默认 30 天有效；员工停用、解绑、重新绑定后旧 Token 失效 |

**CSRF 防护**

v1 对 Web 写操作接口采用 `SameSite=Lax` Cookie + `Origin` / `Referer` 校验。后续如引入跨站嵌入、第三方域名或更复杂部署，再评估 CSRF Token 方案。

**不采用**

- NestJS：v1 过重
- Prisma：SQL 不可见，不利于审查 AI 生成代码
- Kysely / 纯手写 SQL：AI 成熟度与开发效率不如 Drizzle

### 3.4 数据库

| 技术 | 说明 |
|------|------|
| MySQL | 8.x，关系型存储，支持事务、JSON 字段、唯一约束 |
| Navicat | 可视化查看表结构、索引、数据；手工执行 SQL 验证 |

**说明**：Drizzle 对 PostgreSQL 支持更完整，但结合团队习惯与部署环境，v1 选用 MySQL 8，功能上完全满足 PRD 需求。

---

## 4. 系统架构

```text
┌──────────────────────────┐     ┌──────────────────────────┐
│  Web 管理端               │     │  微信小程序（员工端）      │
│  React + Ant Design      │     │  微信原生 + TDesign       │
│  + Tailwind              │     │  + 深色模式               │
└────────────┬─────────────┘     └────────────┬─────────────┘
             │                              │
             └──────────────┬───────────────┘
                            │ HTTPS / REST API
             ┌──────────────▼───────────────┐
             │  Hono API                    │
             │  认证 · 排班 · 发布 · 绑定    │
             │  Drizzle ORM + mysql2        │
             └──────────────┬───────────────┘
                            │
             ┌──────────────▼───────────────┐
             │  MySQL 8                     │
             └──────────────────────────────┘

开发辅助：Navicat（连接 MySQL，审查表结构与数据）
```

---

## 5. Monorepo 目录结构

```text
easyshift/
├── apps/
│   ├── web/                     # React 管理端
│   │   ├── src/
│   │   ├── index.html
│   │   └── package.json
│   ├── miniapp/                 # 微信小程序
│   │   ├── pages/
│   │   ├── app.json             # darkmode: true
│   │   ├── theme.json           # 原生区域深浅色变量
│   │   ├── app.wxss             # TDesign theme 引入
│   │   ├── package.json         # tdesign-miniprogram
│   │   └── project.config.json
│   └── api/                     # Hono 后端
│       ├── src/
│       │   ├── app.ts           # 入口
│       │   ├── routes/          # 路由
│       │   ├── services/        # 业务逻辑
│       │   ├── middleware/      # 鉴权等中间件
│       │   └── db/
│       │       ├── index.ts     # Drizzle 连接
│       │       └── schema/      # 表定义
│       ├── drizzle.config.ts
│       └── package.json
├── packages/
│   └── shared-types/            # 共享类型、枚举、常量
├── docs/
│   ├── PRD.md
│   ├── TECH_STACK.md
│   ├── TEST_PLAN.md
│   ├── DEV_GUIDE.md
│   ├── DATABASE.md
│   ├── API.md
│   ├── SECURITY.md
│   └── DEPLOYMENT.md
├── pnpm-workspace.yaml
└── package.json
```

---

## 6. 后端模块与 PRD 对应

| API 模块 | 技术落点 | PRD 对应 |
|----------|----------|----------|
| 认证 | Hono middleware + Web HttpOnly Cookie + 小程序 Bearer Token | Web 登录、小程序绑定 |
| 员工 | Drizzle `employees` + 绑定码表 | 4.1.3 员工管理 |
| 班次 | Drizzle `shift_types` | 4.1.4 班次类型 |
| 排班 | Drizzle `schedule_entries` | 4.1.5 排班表 |
| 发布 | Drizzle transaction + `schedule_publish_snapshots` | 4.1.8 发布 |
| 校验 | Service 层规则函数 | 4.1.6 冲突校验 |
| 审计 | Drizzle `schedule_change_logs` | 4.1.9 操作记录 |

---

## 7. SQL 审查约定

使用 Drizzle 时，遵循以下约定以便审查 AI 生成代码：

1. **开发环境开启 SQL 日志**：Drizzle `logger: true`
2. **关键查询使用 `.toSQL()`**：发布、快照、覆盖人数统计等
3. **migration 文件必须可审查**：通过 `drizzle-kit generate` 生成，提交前人工检查 SQL
4. **Navicat 对照验证**：新表/新索引在 Navicat 中确认结构正确
5. **关键查询留痕**：发布、快照、覆盖人数统计等查询需要在测试快照或开发记录中保留生成 SQL，便于人工复核
6. **数据库约束优先**：工号、班次代码、排班周期、发布版本、微信绑定等唯一性必须落到数据库约束或事务内强校验
7. **发布事务留痕**：发布流程必须在事务内锁定 `schedule_periods` 行，避免并发发布生成重复版本号
8. **禁止 Prisma**：不在项目中引入 Prisma

---

## 8. 环境要求

| 环境 | 要求 |
|------|------|
| Node.js | 20 LTS 或以上 |
| pnpm | 9.x |
| MySQL | 8.0 或以上 |
| 微信开发者工具 | 最新稳定版（小程序开发） |
| Navicat | 用于 MySQL 可视化管理 |
| 浏览器 | Chrome / Edge 最新两个大版本 |

---

## 9. 部署（v1 参考）

| 组件 | 部署方式 |
|------|----------|
| Web | 静态资源部署（Nginx / 对象存储 + CDN） |
| API | Node 进程（Docker / PM2） |
| MySQL | 云服务器自建或云数据库 MySQL |
| 小程序 | 微信公众平台提交审核 |

v1 不要求 Kubernetes 或微服务拆分。

---

## 10. 版本规划与栈边界

### v1.0 使用本栈实现

- Web：Ant Design 排班表 + 员工/班次管理
- API：Hono + Drizzle 完整 REST API
- 小程序：TDesign + 深色模式 + 绑定 + 看班表
- DB：MySQL + Navicat 管理

### v1 不在栈内扩展

- 不换 Refine / shadcn 重做 Web
- 不引入 NestJS
- 不引入 Prisma
- 不换 Taro/uni-app 做小程序
- 不换 Vant Weapp（无官方深色模式）

### v2 可评估

- 半自动排班算法（独立 service 或 Python 脚本）
- 导出 Excel
- 微信订阅消息
- 若 UI 全面重做，再评估 shadcn

---

## 11. 测试约定

完整用例与 AC 映射见 [TEST_PLAN.md](./TEST_PLAN.md)。

### 11.1 分层

| 层级 | 工具 | 测什么 |
|------|------|--------|
| 单元测试 | Vitest | 校验规则、覆盖统计、跨日时间、通知文案等纯函数 |
| API 集成 | Vitest + Hono + 真 MySQL | 发布快照、绑定、权限、唯一约束、事务 |
| Web 组件 | Vitest + Testing Library + jsdom + MSW | 排班表、覆盖高亮、发布弹窗 |
| E2E | Playwright（CI headless） | Web 关键路径 5～8 条 |
| 小程序 | API 集成 + 手工清单 | 不做 UI 自动化 |

### 11.2 规格驱动

- 功能开发 **propose** 阶段：维护模块 `test-spec.md`，断言拆为 `[rN]` 渲染、`[iN]` 交互、`[sN]` 状态。
- **apply** 阶段：`it('[i1] …')` 描述以 ID 开头，失败可追溯 PRD。
- MSW handler 放在 `apps/web/src/test/handlers.ts`，用于组件测试；E2E 默认真 Web + 真 API + 真 MySQL，并由 Playwright `webServer` 启动本地 Web/API。

### 11.3 Mock 规则

| Mock | 不 Mock |
|------|---------|
| 微信 API、时钟、随机数 | MySQL / Drizzle、排班校验纯函数 |
| Web 层 HTTP（MSW） | Ant Design 组件 internals |

Ant Design 组件测试默认使用 `jsdom`，测试 setup 中统一 polyfill `ResizeObserver`、`matchMedia`、`scrollIntoView`。

### 11.4 CI

- PR：`test:unit` + `test:integration` 必过。
- main / 发版：追加 `test:e2e`。
- 不追求覆盖率 KPI；P0 规则与 AC 条目必须有对应自动化或手工项。

---

## 12. 文档修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.6 | 2026-06-30 | 补充 Playwright E2E webServer 启动约定 |
| v1.5 | 2026-06-24 | 小程序 UI 定稿为 TDesign Miniprogram；明确深色模式适配方案与 v1 范围 |
| v1.4 | 2026-06-20 | 修正测试约定中的 E2E、MSW 与组件测试环境说明 |
| v1.3 | 2026-06-20 | 新增测试约定章节，关联 TEST_PLAN.md |
| v1.2 | 2026-06-20 | 补充 Token 生命周期、CSRF 方案、数据库约束与发布事务要求 |
| v1.1 | 2026-06-20 | 统一鉴权承载方式、版本策略与 SQL 审查留痕规则 |
| v1.0 | 2026-06-20 | 技术栈定稿：Hono + Drizzle + MySQL + React + Ant Design + 微信原生 + Navicat |

# EasyShift 本地开发指南

| 项目 | 内容 |
|------|------|
| 文档版本 | v1.0 |
| 关联文档 | [TECH_STACK.md](./TECH_STACK.md) · [DATABASE.md](./DATABASE.md) · [API.md](./API.md) |

---

## 1. 环境要求

| 工具 | 版本 |
|------|------|
| Node.js | 20 LTS 或以上 |
| pnpm | 9.x |
| MySQL | 8.0 或以上 |
| 微信开发者工具 | 最新稳定版（小程序开发） |
| 浏览器 | Chrome / Edge 最新两个大版本 |

可选：Navicat（审查表结构与数据）、Docker（本地 MySQL）。

---

## 2. 首次安装

### 2.1 克隆与依赖

```bash
git clone <repo-url> easyshift
cd easyshift
pnpm install
```

### 2.2 MySQL

**方式 A：本机 MySQL**

```sql
CREATE DATABASE easyshift_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'easyshift'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON easyshift_dev.* TO 'easyshift'@'localhost';
FLUSH PRIVILEGES;
```

**方式 B：Docker**

```bash
docker run -d --name easyshift-mysql \
  -e MYSQL_ROOT_PASSWORD=root \
  -e MYSQL_DATABASE=easyshift_dev \
  -e MYSQL_USER=easyshift \
  -e MYSQL_PASSWORD=easyshift \
  -p 3306:3306 \
  mysql:8.0
```

### 2.3 环境变量

复制 `apps/api/.env.example` 为 `apps/api/.env`，按需修改：

| 变量 | 说明 | 示例 |
|------|------|------|
| `NODE_ENV` | 运行环境 | `development` |
| `PORT` | API 端口 | `3000` |
| `DATABASE_URL` | MySQL 连接串 | `mysql://easyshift:pass@localhost:3306/easyshift_dev` |
| `JWT_SECRET` | 会话签名密钥（≥32 字符随机串） | — |
| `WEB_SESSION_TTL_DAYS` | Web Cookie 有效期（天） | `7` |
| `MINIAPP_TOKEN_TTL_DAYS` | 小程序 Token 有效期（天） | `30` |
| `WX_APPID` | 微信小程序 AppID | — |
| `WX_SECRET` | 微信小程序 Secret | — |
| `CORS_ORIGIN` | Web 开发地址 | `http://localhost:5173` |
| `COOKIE_SECURE` | Cookie Secure（本地 false） | `false` |

Web 端可选 `apps/web/.env.local`：

| 变量 | 说明 | 示例 |
|------|------|------|
| `VITE_API_BASE_URL` | API 根路径 | `http://localhost:3000/api/v1` |

小程序 `apps/miniapp/config/dev.ts`（或环境配置）：

| 变量 | 说明 |
|------|------|
| `apiBaseUrl` | 开发 API 地址；微信开发者工具需勾选「不校验合法域名」 |

### 2.4 数据库迁移与种子

```bash
pnpm db:migrate    # drizzle-kit migrate，应用 migration
pnpm db:seed       # 写入：单科室、初始管理员、默认班次类型
```

种子数据默认管理员（**仅开发环境**，生产部署后必须修改）：

- 手机号：`13800000000`
- 密码：见 seed 脚本输出或 `SEED_ADMIN_PASSWORD` 环境变量

### 2.5 启动

```bash
pnpm dev           # api + web 并行
pnpm dev:api       # 仅 API
pnpm dev:web       # 仅 Web
```

---

## 3. 小程序联调

1. 用微信开发者工具打开 `apps/miniapp`。
2. 填写小程序 AppID（测试号亦可）。
3. **详情 → 本地设置**：勾选「不校验合法域名、web-view、TLS 版本」。
4. 确保 `apiBaseUrl` 指向本机 API（如 `http://localhost:3000/api/v1`）。
5. 绑定流程：Web 端为员工生成绑定码 → 小程序输入绑定码 + 手机号后四位。

本地调试微信 `code2session` 时，API 可配置 `WX_MOCK=true` 使用假 openid（仅 development）。

---

## 4. 常用命令

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 开发模式（api + web） |
| `pnpm build` | 构建全部应用 |
| `pnpm test` | Vitest 单元 / 组件 / API 测试 |
| `pnpm test:api` | 仅 API 集成测试 |
| `pnpm test:e2e` | Playwright E2E（headless） |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript 检查 |
| `pnpm db:generate` | 根据 Drizzle schema 生成 migration |
| `pnpm db:migrate` | 应用 migration |
| `pnpm db:studio` | Drizzle Studio（若已配置） |

---

## 5. 开发约定

### 5.1 分支与提交

- `main`：可发布分支
- 功能分支：`feat/<模块>`、`fix/<问题>`
- 提交信息：简短说明「为什么」，如 `feat(schedule): add copy-from-previous-week`

### 5.2 代码位置

| 模块 | 路径 |
|------|------|
| API 路由 | `apps/api/src/routes/` |
| 业务逻辑 | `apps/api/src/services/` |
| Drizzle schema | `apps/api/src/db/schema/` |
| Web 功能页 | `apps/web/src/features/` |
| 共享类型 | `packages/shared-types/src/` |
| MSW handlers | `apps/web/src/test/handlers.ts` |

### 5.3 规格驱动测试

功能开发时在模块目录维护 `test-spec.md`，测试用例 ID 与 PRD 可追溯。详见 [TEST_PLAN.md](./TEST_PLAN.md)。

### 5.4 SQL 审查

- 开发环境 Drizzle `logger: true`
- 新 migration 提交前人工阅读 SQL
- 发布、快照、覆盖统计等关键查询保留 `.toSQL()` 复核记录

---

## 6. 故障排查

| 现象 | 可能原因 | 处理 |
|------|----------|------|
| API 连不上 DB | `DATABASE_URL` 错误、MySQL 未启动 | 检查连接串与端口 |
| Web 登录后 401 | Cookie 未带上、`CORS_ORIGIN` 不匹配 | 确认 axios `withCredentials`、API CORS |
| 小程序绑定失败 | 合法域名、AppID/Secret 错误 | 开发环境关闭域名校验；检查 `.env` |
| migration 失败 | 与现有表冲突 | 开发库可 `drop` 重建；勿对生产库随意 drop |
| 发布重复版本号 | 并发发布 | 见 [DATABASE.md](./DATABASE.md) 发布事务说明 |

---

## 7. 文档修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0 | 2026-06-23 | 初版 |

# EasyShift（易排班）

面向医院小型科室的轻量排班工具：Web 管理端排班发布，微信小程序查看个人班表。

## 文档索引

| 文档 | 说明 |
|------|------|
| [docs/PRD.md](./docs/PRD.md) | 产品需求、功能范围、验收标准 |
| [docs/TECH_STACK.md](./docs/TECH_STACK.md) | 技术选型、Monorepo 结构 |
| [docs/TEST_PLAN.md](./docs/TEST_PLAN.md) | 测试策略、AC 映射 |
| [docs/DEV_GUIDE.md](./docs/DEV_GUIDE.md) | 本地开发、环境变量、常用命令 |
| [docs/DATABASE.md](./docs/DATABASE.md) | 数据库表结构、索引、迁移 |
| [docs/API.md](./docs/API.md) | REST 接口契约、错误码 |
| [docs/SECURITY.md](./docs/SECURITY.md) | 鉴权、权限、安全约定 |
| [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) | 部署、备份、运维 |

## 技术栈（v1）

- **Web**：React + TypeScript + Vite + Ant Design + Tailwind CSS
- **小程序**：微信原生 + TypeScript + TDesign Miniprogram（深色模式）
- **API**：Hono + Drizzle + MySQL 8
- **Monorepo**：pnpm workspace

## 快速开始

> 代码仓库初始化后，完整步骤见 [docs/DEV_GUIDE.md](./docs/DEV_GUIDE.md)。

```bash
# 前置：Node 20+、pnpm 9+、MySQL 8+

pnpm install
cp apps/api/.env.example apps/api/.env   # 填写数据库与密钥
pnpm db:migrate                          # 初始化表结构
pnpm db:seed                             # 种子数据（科室、管理员、默认班次）
pnpm dev                                 # 并行启动 api + web
```

- Web 管理端：http://localhost:5173
- API：http://localhost:3000

## 仓库结构（目标）

```text
easyshift/
├── apps/
│   ├── web/          # React 管理端
│   ├── miniapp/      # 微信小程序
│   └── api/          # Hono 后端
├── packages/
│   └── shared-types/ # 跨端共享类型
├── docs/
└── e2e/              # Playwright E2E
```

## 许可证

待定（商用前需确认）。

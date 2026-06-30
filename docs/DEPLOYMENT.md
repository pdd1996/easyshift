# EasyShift 部署与运维

| 项目 | 内容 |
|------|------|
| 文档版本 | v1.0 |
| 关联文档 | [TECH_STACK.md](./TECH_STACK.md) 第 9 节 · [DEV_GUIDE.md](./DEV_GUIDE.md) · [SECURITY.md](./SECURITY.md) |

v1 采用简单部署：静态 Web + 单进程 API + MySQL，不要求 Kubernetes。

**可执行骨架**（Docker Compose + GitHub Actions）：见仓库根目录 [deploy/README.md](../deploy/README.md)。

---

## 1. 环境划分

| 环境 | 用途 | 数据 |
|------|------|------|
| development | 本地开发 | 可重建 |
| staging | 联调、预发布 | 脱敏或副本 |
| production | 正式服务 | 真实业务数据 |

各环境使用独立数据库与微信配置（staging 可用独立小程序测试号）。

---

## 2. 架构拓扑（生产）

```text
                    ┌─────────────┐
  用户浏览器 ────────►│ Nginx       │
                    │ 静态 Web    │
                    │ 反代 /api   │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │ Hono API    │  PM2 / Docker
                    │ (Node 20)   │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │ MySQL 8     │  云 RDS 或自建
                    └─────────────┘

  微信用户 ─────────► 微信小程序 ──HTTPS──► API（合法域名）
```

---

## 3. 组件部署

### 3.1 Web 管理端

```bash
pnpm build --filter web
# 产物：apps/web/dist/
```

部署方式（二选一）：

- Nginx 托管 `dist/`，`try_files` 回退 `index.html`（SPA）
- 对象存储 + CDN，配置 SPA 404 → `index.html`

构建时注入 `VITE_API_BASE_URL=https://api.example.com/api/v1`。

### 3.2 API

```bash
pnpm build --filter api
# 启动：node apps/api/dist/index.js
```

推荐 **PM2** 或 **Docker**：

```bash
pm2 start apps/api/dist/index.js --name easyshift-api
pm2 save
```

Docker 示例要点：

- 镜像基于 `node:20-alpine`
- 非 root 用户运行
- 健康检查：`GET /health`
- 环境变量自 `.env` 或编排注入

### 3.3 MySQL

| 选项 | 说明 |
|------|------|
| 云 RDS | 自动备份、主从可选 |
| 自建 | 需自行备份与监控 |

字符集：`utf8mb4` / `utf8mb4_unicode_ci`。

首次部署：

```bash
pnpm db:migrate    # 在 API 容器/主机执行
pnpm db:seed       # 仅首次；生产 seed 后立刻改密
```

### 3.4 微信小程序

1. 微信公众平台配置 **request 合法域名**：`https://api.example.com`
2. 上传代码 → 提交审核 → 发布
3. 体验版供科室试点

详见后续可补充的 `MINIAPP_RELEASE.md`（审核文案、类目选择）。

---

## 4. Nginx 参考配置

```nginx
server {
    listen 443 ssl http2;
    server_name admin.example.com;

    ssl_certificate     /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    root /var/www/easyshift/web;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}

server {
    listen 443 ssl http2;
    server_name api.example.com;

    ssl_certificate     /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Web 与 API 可同域（`/api` 反代）以简化 Cookie 域；若跨子域须配置 Cookie `Domain` 与 CORS。

---

## 5. 环境变量（生产）

在 [DEV_GUIDE.md](./DEV_GUIDE.md) 基础上，生产必须调整：

| 变量 | 生产值 |
|------|--------|
| `NODE_ENV` | `production` |
| `COOKIE_SECURE` | `true` |
| `CORS_ORIGIN` | `https://admin.example.com` |
| `JWT_SECRET` | 强随机，与开发环境不同 |
| `DATABASE_URL` | 生产库连接串，最小权限账号 |

---

## 6. 备份与恢复

### 6.1 MySQL

| 策略 | 频率 | 保留 |
|------|------|------|
| 全量备份 | 每日凌晨 | 30 天 |
|  binlog | 开启 | 7 天 |

```bash
mysqldump -u backup -p --single-transaction easyshift_prod > backup_$(date +%F).sql
```

恢复：停 API → 还原 dump → `pnpm db:migrate`（若有新 migration）→ 启 API。

### 6.2 应用配置

- 环境变量清单存档（不含密钥明文）
- SSL 证书到期提醒

### 6.3 快照数据

`schedule_publish_snapshots` 随发布增长；v1 单科室数据量小，与主库一并备份即可。

---

## 7. 监控与告警

| 项 | 方式 |
|----|------|
| 进程存活 | PM2 / 容器健康检查 |
| API 可用 | 外部探测 `GET /health` |
| 错误率 | 应用日志聚合（可选：Sentry） |
| MySQL | 连接数、磁盘、慢查询 |
| 磁盘 | 日志与备份目录 |

告警渠道：邮件 / 企业微信（v1 人工配置即可）。

---

## 8. 日志

| 类型 | 位置 | 轮转 |
|------|------|------|
| API 访问/错误 | PM2 logs 或 `/var/log/easyshift/` | logrotate 按日 |
| Nginx | `/var/log/nginx/` | 系统默认 |
| MySQL 慢查询 | 按需开启 | — |

生产日志级别：`info`；调试时临时 `debug`，勿长期开启。

---

## 9. 发布流程

```text
1. staging 验证：migrate + 冒烟测试 + E2E 关键路径
2. 生产备份数据库
3. 部署 API（先）
4. 执行 db:migrate（若有）
5. 部署 Web 静态资源
6. 验证 health + 登录 + 发布冒烟
7. 小程序若有接口变更：先发布 API，再提审小程序
```

回滚：恢复上一版 API/Web 产物；数据库仅 forward migrate，回滚需提前评估 migration 可逆性。

---

## 10. 常见故障

| 现象 | 排查 |
|------|------|
| Web 登录循环 | Cookie Secure/CORS/反代 HTTPS 头 |
| 小程序请求失败 | 合法域名、TLS 证书、API 可达 |
| 发布失败 409 | 并发发布；重试或查 DB 锁 |
| DB 连接耗尽 | 调连接池、查慢查询 |
| 磁盘满 | 日志与备份清理 |

---

## 11. 文档修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.1 | 2026-06-30 | 补充 Docker Compose + GitHub Actions 部署骨架链接 |
| v1.0 | 2026-06-23 | 初版 |

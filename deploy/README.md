# EasyShift 部署（Docker Compose）

一台阿里云 ECS + Compose（Nginx / API / MySQL），`git push` 后 GitHub Actions 自动部署。

## 暂无域名时

| 能测什么 | 说明 |
|----------|------|
| Web 管理端 | `http://ECS公网IP` 打开，`.env` 里 `CORS_ORIGIN` 填同一地址 |
| API | 同域 `/api/v1/...`，无需改 CORS |
| 微信小程序 | **不行** — 须备案域名 + HTTPS + 微信公众平台合法域名 |

有域名后：Nginx 加 443 + 证书（推荐 Certbot），`CORS_ORIGIN` / `COOKIE_SECURE=true`，小程序配置 `https://你的域名`。`NODE_ENV=production` 时 `WX_MOCK` 必须保持 `false`。

本地开发（本机 MySQL + `pnpm dev`）见 [docs/DEV_GUIDE.md](../docs/DEV_GUIDE.md)，**不需要 Docker**。

---

## 1. ECS 一次性准备

1. 买 ECS（2 核 4G 够用），安全组放行 **80**（暂 HTTP）；**不要**放行 3306。
2. 安装 Docker + Compose 插件（阿里云镜像文档即可）。
3. 克隆仓库：

```bash
sudo mkdir -p /opt/easyshift
sudo chown "$USER":"$USER" /opt/easyshift
git clone <repo-url> /opt/easyshift
cd /opt/easyshift
```

4. 配置环境变量：

```bash
cp deploy/.env.example .env
# 编辑 .env：MYSQL_*、JWT_SECRET、CORS_ORIGIN=http://你的公网IP
# 暂无域名时保持 WX_MOCK=false，只测 Web/API
```

5. 执行 [§2 首次部署](#2-部署命令) 中的命令。

浏览器访问 `http://ECS公网IP`，默认管理员密码见 `.env` 的 `SEED_ADMIN_PASSWORD`。

---

## 2. 部署命令

在服务器上进入项目目录后执行（默认路径 `/opt/easyshift`）。

### 首次部署

空库、从未执行过 seed 时使用（含建表 + 初始数据）：

```bash
cd /opt/easyshift

docker compose build
docker compose run --rm api /app/apps/api/node_modules/.bin/tsx src/db/migrate.ts
docker compose run --rm api /app/apps/api/node_modules/.bin/tsx src/db/seed.ts
docker compose up -d

docker compose ps
curl http://127.0.0.1/api/v1/health
```

### 日常更新

已有数据、之前 seed 成功过时使用（**不要**再跑 seed）：

```bash
cd /opt/easyshift
git pull --ff-only origin main

docker compose build
docker compose run --rm api /app/apps/api/node_modules/.bin/tsx src/db/migrate.ts
docker compose up -d

docker compose ps
curl http://127.0.0.1/api/v1/health
```

也可一条命令（等价于上面 `git pull` 至 health 检查，不含 seed）：

```bash
cd /opt/easyshift && bash scripts/deploy-remote.sh
```

### 步骤说明

| 步骤 | 首次 | 日常 | 说明 |
|------|:----:|:----:|------|
| `git pull` | 可选 | ✅ | 克隆后首次可跳过；日常更新必做 |
| `docker compose build` | ✅ | ✅ | 代码打进镜像，代码变更后必须重建 |
| `migrate.ts` | ✅ | ✅ | 只应用未执行过的 migration，无新 migration 时几乎空跑 |
| `seed.ts` | ✅ | ❌ | 仅首次；库里已有科室时会自动跳过，但日常不应依赖此行为 |
| `docker compose up -d` | ✅ | ✅ | 用新镜像启动/重启容器 |
| `ps` / `curl health` | 建议 | 建议 | 确认服务正常 |

`git pull` **不会**覆盖 `.env`（已在 `.gitignore`）；MySQL 数据在 Docker volume `mysql_data` 中，拉代码不会清空数据库。

---

## 3. GitHub Actions 自动部署（推荐）

仓库 **Settings → Secrets and variables → Actions** 添加：

| Secret | 示例 |
|--------|------|
| `ECS_HOST` | ECS 公网 IP |
| `ECS_USER` | `root` 或部署用户 |
| `ECS_SSH_KEY` | 私钥全文 |
| `DEPLOY_PATH` | `/opt/easyshift`（可选） |

服务器需已配置对应公钥。之后本地 `git push origin main` 即可触发 [日常更新](#日常更新) 流程（pull → build → migrate → up → health），无需 SSH 手敲命令。

---

## 4. 运维命令（在服务器上）

```bash
cd /opt/easyshift
docker compose ps
docker compose logs -f api
bash scripts/deploy-remote.sh          # 手动触发日常更新
```

备份（测试环境手动即可）：

```bash
docker compose exec mysql mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" easyshift > backup.sql
```

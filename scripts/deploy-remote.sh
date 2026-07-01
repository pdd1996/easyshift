#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f .env ]]; then
  echo "缺少 .env，请先复制 deploy/.env.example 并填写。" >&2
  exit 1
fi

echo "==> 拉取最新代码"
git pull --ff-only origin main

echo "==> 构建镜像"
docker compose build

echo "==> 数据库迁移"
docker compose run --rm api /app/apps/api/node_modules/.bin/tsx src/db/migrate.ts

echo "==> 启动服务"
docker compose up -d --remove-orphans

echo "==> 健康检查"
health_port="$(docker compose port web 80 | awk -F: 'NR == 1 { print $NF }')"
health_port="${health_port:-80}"
for i in {1..30}; do
  if curl -fsS "http://127.0.0.1:${health_port}/api/v1/health" > /dev/null; then
    echo "部署成功：/api/v1/health OK"
    exit 0
  fi
  sleep 2
done

echo "健康检查超时，请执行：docker compose logs api web" >&2
exit 1

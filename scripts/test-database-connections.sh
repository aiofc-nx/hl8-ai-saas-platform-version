#!/usr/bin/env bash

set -euo pipefail

# @description 使用容器内置客户端检测 PostgreSQL 与 MongoDB 是否可用
# @note 在 WSL2 环境下调用 Windows 主机 Docker 服务，确保 Docker Desktop 正在运行

POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-postgres_container}"
MONGODB_CONTAINER="${MONGODB_CONTAINER:-mongodb_container}"
POSTGRES_USER="${POSTGRES_USER:-aiofix}"
POSTGRES_DB="${POSTGRES_DB:-hl8-platform}"
MONGO_USER="${MONGO_USER:-aiofix}"
MONGO_PASSWORD="${MONGO_PASSWORD:-aiofix}"
MONGO_DB="${MONGO_DB:-hl8-platform}"
MONGO_AUTH_DB="${MONGO_AUTH_DB:-admin}"

echo "开始检测数据库容器连通性..."

# @description 校验容器是否处于运行状态
ensure_container_running() {
  local container_name="$1"
  local container_desc="$2"

  if [[ "$(docker inspect -f '{{.State.Running}}' "$container_name" 2>/dev/null || echo "false")" != "true" ]]; then
    echo "错误：${container_desc} 未启动或无法访问，请先执行 docker compose up -d"
    exit 1
  fi
}

ensure_container_running "$POSTGRES_CONTAINER" "PostgreSQL 容器"
ensure_container_running "$MONGODB_CONTAINER" "MongoDB 容器"

echo "1/2 检测 PostgreSQL 连通性..."
docker exec "$POSTGRES_CONTAINER" psql \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --command "SELECT 'postgres ok' AS status;"
echo "PostgreSQL 检测通过。"

echo "2/2 检测 MongoDB 连通性..."
docker exec "$MONGODB_CONTAINER" mongosh \
  --username "$MONGO_USER" \
  --password "$MONGO_PASSWORD" \
  --authenticationDatabase "$MONGO_AUTH_DB" \
  --quiet \
  --eval "db.runCommand({ ping: 1 })"
echo "MongoDB 检测通过。"

echo "数据库连通性检测完成。"


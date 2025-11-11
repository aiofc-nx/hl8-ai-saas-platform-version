## 测试概述

- **测试目标**：验证 `docker-compose.yml` 启动的 PostgreSQL 与 MongoDB 容器，在 WSL2（Docker Desktop 运行于 Windows 11）环境下可被基础设施脚本正常访问。
- **测试范围**：`scripts/test-database-connections.sh` 使用容器内 `psql` 与 `mongosh` 客户端对数据库进行连通性与认证检测。
- **测试时间**：2025-11-09

## 测试环境

- **操作系统**：WSL2 Linux 5.15.167.4
- **Docker 平台**：Windows 11 Docker Desktop
- **代码仓库路径**：`/home/arligle/hl8/hl8-aisaas-platform`
- **相关服务**：
  - PostgreSQL 容器：`postgres_container`
  - MongoDB 容器：`mongodb_container`
  - docker-compose 文件：`docker-compose.yml`
- **脚本位置**：`scripts/test-database-connections.sh`

## 测试准备

- 已执行 `docker compose up -d` 启动数据库、缓存等基础设施容器。
- 默认环境变量：
  - PostgreSQL：`POSTGRES_USER=aiofix`，`POSTGRES_DB=hl8-platform`
  - MongoDB：`MONGO_USER=aiofix`，`MONGO_PASSWORD=aiofix`，`MONGO_DB=hl8-platform`，`MONGO_AUTH_DB=admin`
- 确认 `psql` 与 `mongosh` 客户端由容器镜像提供，无需额外安装。

## 测试步骤

1. 在仓库根目录执行 `bash scripts/test-database-connections.sh`。
2. 脚本首先通过 `docker inspect` 校验目标容器运行状态。
3. 通过 `docker exec postgres_container psql ...` 执行 `SELECT 'postgres ok' AS status;`。
4. 通过 `docker exec mongodb_container mongosh ... --eval "db.runCommand({ ping: 1 })"` 检测 MongoDB。
5. 根据命令返回值输出检测结果，若出现异常立即停止并显示中文错误信息。

## 测试结果

- **PostgreSQL**：
  - 返回结果：`postgres ok`
  - 结论：数据库运行正常，账号与数据库名称匹配。
- **MongoDB**：
  - 返回结果：`{ ok: 1 }`
  - 结论：认证数据库切换至 `admin` 后校验通过，连接正常。
- **脚本终态输出**：`数据库连通性检测完成。`

## 问题与解决

- 初次执行脚本时 MongoDB 报错 `MongoServerError: Authentication failed.`  
  **原因**：root 用户默认认证库为 `admin`，脚本最初使用业务数据库进行认证。  
  **解决方案**：新增环境变量 `MONGO_AUTH_DB`，默认值设置为 `admin`，并在脚本中使用该值。

## 结论与建议

- 当前容器化数据库环境已验证可用，可作为后续 MikroORM 集成与开发测试基础。
- 建议将该脚本纳入 CI/CD 或运维健康检查流程，确保部署节点在运行前具备数据库连通性。
- 若后续引入业务独立账号或多环境配置，应在执行脚本前通过环境变量覆盖默认凭证，并保留认证数据库参数以适配自定义设置。

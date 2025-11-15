# 租户管理模块数据库迁移

## 迁移说明

本目录包含租户管理模块的数据库迁移文件。

## 表结构

### tenant_events（事件存储表）

用于存储租户聚合的所有领域事件，支持事件溯源。

**字段**：

- `eventId` (UUID, 主键) - 事件唯一标识
- `aggregateId` (UUID, 索引) - 聚合标识
- `tenantId` (UUID, 索引) - 租户标识
- `version` (INTEGER) - 事件版本号
- `payload` (JSONB) - 事件载荷
- `occurredAt` (TIMESTAMPTZ, 索引) - 发生时间
- `metadata` (JSONB, 可选) - 事件元数据

**索引**：

- 主键：`eventId`
- 唯一索引：`(aggregateId, tenantId, version)` - 用于乐观锁
- 索引：`tenantId`, `aggregateId`, `version`, `occurredAt`

### tenant_projections（读模型投影表）

用于存储租户读模型，支持快速查询。

**字段**：

- `tenantId` (UUID, 主键) - 租户ID
- `tenantName` (VARCHAR(100), 唯一) - 租户名称
- `status` (VARCHAR(20), 索引) - 租户状态
- `contactName` (VARCHAR(100), 可选) - 负责人姓名
- `email` (VARCHAR(255)) - 邮箱
- `phone` (VARCHAR(50), 可选) - 电话
- `defaultOrganizationId` (UUID) - 默认组织ID
- `defaultTimezone` (VARCHAR(50)) - 默认时区
- `currency` (VARCHAR(3), 可选) - 货币
- `legalName` (VARCHAR(200), 可选) - 法定名称
- `registrationCode` (VARCHAR(100), 可选) - 注册代码
- `industry` (VARCHAR(100), 可选) - 行业分类
- `createdAt` (TIMESTAMPTZ) - 创建时间
- `updatedAt` (TIMESTAMPTZ) - 更新时间
- `isDeleted` (BOOLEAN, 索引) - 是否已删除

**索引**：

- 主键：`tenantId`
- 唯一索引：`tenantName`
- 索引：`status`, `createdAt`, `isDeleted`

## 生成迁移

使用 MikroORM CLI 生成迁移文件：

```bash
# 在租户模块目录下
cd libs/modules/tenant

# 生成迁移文件
pnpm run db:migration:create

# 执行迁移
pnpm run db:migration:up
```

## 注意事项

- 所有表必须包含 `tenantId` 列用于多租户隔离
- 迁移文件应包含完整的表结构定义和索引
- 迁移应支持向上和向下迁移（up/down）

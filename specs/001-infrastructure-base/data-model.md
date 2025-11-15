# 数据模型：基础设施基础模块

**日期**：2024-12-19  
**关联计划**：[plan.md](./plan.md)

## 核心实体

### 1. 事件（Event）

**描述**：表示业务操作产生的领域事件，包含事件标识、聚合标识、租户标识、版本号、事件内容、发生时间和元数据。事件是事件溯源和事件驱动架构的核心数据实体。

**字段**：

| 字段名      | 类型                    | 说明         | 约束                 |
| ----------- | ----------------------- | ------------ | -------------------- |
| eventId     | string                  | 事件唯一标识 | 主键，不可为空       |
| aggregateId | string                  | 聚合标识     | 索引，不可为空       |
| tenantId    | string                  | 租户标识     | 索引，不可为空       |
| version     | number                  | 事件版本号   | 索引，不可为空，>= 1 |
| payload     | unknown                 | 事件内容     | 不可为空             |
| occurredAt  | Date                    | 事件发生时间 | 不可为空             |
| metadata    | Record<string, unknown> | 事件元数据   | 可为空               |

**关系**：

- 一个聚合可以有多个事件（1:N）
- 一个租户可以有多个事件（1:N）

**验证规则**：

- `eventId` 必须唯一
- `version` 必须 >= 1
- `aggregateId` 和 `tenantId` 组合必须唯一
- `occurredAt` 必须 <= 当前时间

**状态转换**：

- 创建 → 已保存 → 已发布 → 已归档（可选）

**索引**：

- 主键：`eventId`
- 唯一索引：`(aggregateId, tenantId, version)`
- 索引：`tenantId`
- 索引：`aggregateId`
- 索引：`version`
- 索引：`occurredAt`

### 2. 事件快照（EventSnapshot）

**描述**：表示聚合在某个版本的状态快照，用于减少事件重放次数。

**字段**：

| 字段名      | 类型    | 说明         | 约束                 |
| ----------- | ------- | ------------ | -------------------- |
| snapshotId  | string  | 快照唯一标识 | 主键，不可为空       |
| aggregateId | string  | 聚合标识     | 索引，不可为空       |
| tenantId    | string  | 租户标识     | 索引，不可为空       |
| version     | number  | 快照版本号   | 索引，不可为空，>= 1 |
| payload     | unknown | 快照内容     | 不可为空             |
| createdAt   | Date    | 快照创建时间 | 不可为空             |

**关系**：

- 一个聚合可以有多个快照（1:N）
- 一个租户可以有多个快照（1:N）

**验证规则**：

- `snapshotId` 必须唯一
- `version` 必须 >= 1
- `aggregateId` 和 `tenantId` 组合必须唯一

**索引**：

- 主键：`snapshotId`
- 唯一索引：`(aggregateId, tenantId, version)`
- 索引：`tenantId`
- 索引：`aggregateId`
- 索引：`version`

### 3. 审计记录（AuditRecord）

**描述**：表示系统操作的审计信息，包含租户标识、用户标识、操作类型、操作内容、发生时间等。审计记录用于满足合规要求和问题诊断。

**字段**：

| 字段名     | 类型                    | 说明             | 约束           |
| ---------- | ----------------------- | ---------------- | -------------- |
| auditId    | string                  | 审计记录唯一标识 | 主键，不可为空 |
| tenantId   | string                  | 租户标识         | 索引，不可为空 |
| userId     | string                  | 用户标识         | 索引，不可为空 |
| action     | string                  | 操作类型         | 索引，不可为空 |
| payload    | unknown                 | 操作内容         | 不可为空       |
| occurredAt | Date                    | 操作发生时间     | 索引，不可为空 |
| metadata   | Record<string, unknown> | 审计元数据       | 可为空         |

**关系**：

- 一个租户可以有多个审计记录（1:N）
- 一个用户可以有多个审计记录（1:N）

**验证规则**：

- `auditId` 必须唯一
- `action` 必须符合预定义的操作类型
- `occurredAt` 必须 <= 当前时间

**状态转换**：

- 创建 → 已保存 → 已归档（可选）

**索引**：

- 主键：`auditId`
- 索引：`tenantId`
- 索引：`userId`
- 索引：`action`
- 索引：`occurredAt`
- 全文索引：`payload`（可选）

### 4. 权限规则（PermissionRule）

**描述**：表示用户的访问权限能力，基于用户、租户、组织等维度构建。权限规则用于控制用户对系统资源的访问。

**字段**：

| 字段名         | 类型    | 说明         | 约束           |
| -------------- | ------- | ------------ | -------------- |
| ruleId         | string  | 规则唯一标识 | 主键，不可为空 |
| userId         | string  | 用户标识     | 索引，不可为空 |
| tenantId       | string  | 租户标识     | 索引，不可为空 |
| organizationId | string  | 组织标识     | 索引，可为空   |
| ability        | unknown | 权限能力     | 不可为空       |
| createdAt      | Date    | 规则创建时间 | 不可为空       |
| updatedAt      | Date    | 规则更新时间 | 不可为空       |

**关系**：

- 一个用户可以有多个权限规则（1:N）
- 一个租户可以有多个权限规则（1:N）
- 一个组织可以有多个权限规则（1:N）

**验证规则**：

- `ruleId` 必须唯一
- `ability` 必须符合 CASL 权限规则格式
- `updatedAt` 必须 >= `createdAt`

**索引**：

- 主键：`ruleId`
- 唯一索引：`(userId, tenantId, organizationId)`
- 索引：`tenantId`
- 索引：`userId`
- 索引：`organizationId`

### 5. 配置（Configuration）

**描述**：表示系统的配置信息，经过校验和类型检查。配置用于控制系统的行为和参数。

**字段**：

| 字段名      | 类型    | 说明         | 约束           |
| ----------- | ------- | ------------ | -------------- |
| configId    | string  | 配置唯一标识 | 主键，不可为空 |
| key         | string  | 配置键       | 索引，不可为空 |
| value       | unknown | 配置值       | 不可为空       |
| environment | string  | 环境标识     | 索引，不可为空 |
| createdAt   | Date    | 配置创建时间 | 不可为空       |
| updatedAt   | Date    | 配置更新时间 | 不可为空       |

**关系**：

- 一个环境可以有多个配置（1:N）

**验证规则**：

- `configId` 必须唯一
- `key` 必须符合预定义的配置键格式
- `value` 必须符合配置值的类型要求
- `environment` 必须符合预定义的环境标识

**索引**：

- 主键：`configId`
- 唯一索引：`(key, environment)`
- 索引：`environment`

### 6. 异常（Exception）

**描述**：表示系统运行时错误，包含错误码、中文错误信息和上下文信息。异常用于统一的错误处理和日志记录。

**字段**：

| 字段名     | 类型                    | 说明             | 约束           |
| ---------- | ----------------------- | ---------------- | -------------- |
| errorCode  | string                  | 错误码           | 索引，不可为空 |
| message    | string                  | 错误信息（中文） | 不可为空       |
| context    | Record<string, unknown> | 错误上下文       | 可为空         |
| stack      | string                  | 错误堆栈         | 可为空         |
| occurredAt | Date                    | 错误发生时间     | 不可为空       |

**关系**：

- 无直接关系

**验证规则**：

- `errorCode` 必须符合预定义的错误码格式
- `message` 必须使用中文
- `occurredAt` 必须 <= 当前时间

**索引**：

- 索引：`errorCode`
- 索引：`occurredAt`

## 数据关系图

```
┌─────────────────┐
│     Event       │
│  - eventId      │
│  - aggregateId  │──┐
│  - tenantId     │  │
│  - version      │  │
│  - payload      │  │
│  - occurredAt   │  │
└─────────────────┘  │
                     │
┌─────────────────┐  │
│ EventSnapshot   │  │
│  - snapshotId   │  │
│  - aggregateId  │──┘
│  - tenantId     │
│  - version      │
│  - payload      │
└─────────────────┘

┌─────────────────┐
│  AuditRecord    │
│  - auditId      │
│  - tenantId     │──┐
│  - userId       │  │
│  - action       │  │
│  - payload      │  │
└─────────────────┘  │
                     │
┌─────────────────┐  │
│ PermissionRule  │  │
│  - ruleId       │  │
│  - userId       │──┘
│  - tenantId     │
│  - ability      │
└─────────────────┘

┌─────────────────┐
│  Configuration  │
│  - configId     │
│  - key          │
│  - value        │
│  - environment  │
└─────────────────┘
```

## 数据迁移

### 1. 事件表迁移

```sql
CREATE TABLE events (
  event_id VARCHAR(255) PRIMARY KEY,
  aggregate_id VARCHAR(255) NOT NULL,
  tenant_id VARCHAR(255) NOT NULL,
  version INTEGER NOT NULL,
  payload JSONB NOT NULL,
  occurred_at TIMESTAMP NOT NULL,
  metadata JSONB,
  UNIQUE (aggregate_id, tenant_id, version)
);

CREATE INDEX idx_events_tenant_id ON events(tenant_id);
CREATE INDEX idx_events_aggregate_id ON events(aggregate_id);
CREATE INDEX idx_events_version ON events(version);
CREATE INDEX idx_events_occurred_at ON events(occurred_at);
```

### 2. 事件快照表迁移

```sql
CREATE TABLE event_snapshots (
  snapshot_id VARCHAR(255) PRIMARY KEY,
  aggregate_id VARCHAR(255) NOT NULL,
  tenant_id VARCHAR(255) NOT NULL,
  version INTEGER NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL,
  UNIQUE (aggregate_id, tenant_id, version)
);

CREATE INDEX idx_event_snapshots_tenant_id ON event_snapshots(tenant_id);
CREATE INDEX idx_event_snapshots_aggregate_id ON event_snapshots(aggregate_id);
CREATE INDEX idx_event_snapshots_version ON event_snapshots(version);
```

### 3. 审计记录表迁移

```sql
CREATE TABLE audit_records (
  audit_id VARCHAR(255) PRIMARY KEY,
  tenant_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  action VARCHAR(255) NOT NULL,
  payload JSONB NOT NULL,
  occurred_at TIMESTAMP NOT NULL,
  metadata JSONB,
  INDEX idx_audit_records_tenant_id ON audit_records(tenant_id),
  INDEX idx_audit_records_user_id ON audit_records(user_id),
  INDEX idx_audit_records_action ON audit_records(action),
  INDEX idx_audit_records_occurred_at ON audit_records(occurred_at)
);
```

### 4. 权限规则表迁移

```sql
CREATE TABLE permission_rules (
  rule_id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  tenant_id VARCHAR(255) NOT NULL,
  organization_id VARCHAR(255),
  ability JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  UNIQUE (user_id, tenant_id, organization_id)
);

CREATE INDEX idx_permission_rules_tenant_id ON permission_rules(tenant_id);
CREATE INDEX idx_permission_rules_user_id ON permission_rules(user_id);
CREATE INDEX idx_permission_rules_organization_id ON permission_rules(organization_id);
```

### 5. 配置表迁移

```sql
CREATE TABLE configurations (
  config_id VARCHAR(255) PRIMARY KEY,
  key VARCHAR(255) NOT NULL,
  value JSONB NOT NULL,
  environment VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  UNIQUE (key, environment)
);

CREATE INDEX idx_configurations_environment ON configurations(environment);
```

## 数据访问模式

### 1. 事件存储

- **写入模式**：批量写入，支持事务
- **读取模式**：按聚合标识和租户标识查询，支持版本范围查询
- **查询模式**：支持按租户、聚合、版本、时间范围查询

### 2. 审计记录

- **写入模式**：单个写入，支持异步写入
- **读取模式**：按租户、用户、操作类型、时间范围查询
- **查询模式**：支持全文搜索和精确查询

### 3. 权限规则

- **写入模式**：单个写入，支持批量更新
- **读取模式**：按用户、租户、组织查询
- **查询模式**：支持缓存查询和直接查询

### 4. 配置

- **写入模式**：单个写入，支持环境覆盖
- **读取模式**：按配置键和环境查询
- **查询模式**：支持配置合并和默认值

## 数据一致性

### 1. 事件一致性

- 事件写入必须保证原子性（事务）
- 事件版本必须保证连续性
- 事件读取必须保证租户隔离

### 2. 审计一致性

- 审计记录写入必须保证完整性
- 审计记录查询必须保证租户隔离
- 审计记录归档必须保证数据完整性

### 3. 权限一致性

- 权限规则更新必须保证一致性
- 权限缓存失效必须保证及时性
- 权限查询必须保证租户隔离

## 数据安全

### 1. 多租户隔离

- 所有数据访问必须包含租户标识
- 所有查询必须包含租户过滤条件
- 所有索引必须包含租户标识

### 2. 数据脱敏

- 审计记录中的敏感字段必须脱敏
- 日志输出中的敏感字段必须脱敏
- 配置信息中的敏感字段必须加密

### 3. 数据备份

- 事件数据必须定期备份
- 审计记录必须定期备份
- 配置信息必须定期备份

## 性能优化

### 1. 索引优化

- 所有查询字段必须建立索引
- 复合查询必须建立复合索引
- 定期分析索引使用情况，优化索引策略

### 2. 查询优化

- 使用事件快照减少事件重放次数
- 使用权限缓存减少权限查询次数
- 使用分页查询减少数据传输量

### 3. 存储优化

- 使用事件归档减少存储成本
- 使用审计记录归档减少存储成本
- 定期清理过期数据（如配置缓存）

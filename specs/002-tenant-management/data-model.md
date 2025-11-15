# 数据模型：租户管理模块

**日期**：2025-01-27  
**关联计划**：[plan.md](./plan.md) | **研究文档**：[research.md](./research.md)

## 概述

本文档定义租户管理模块的领域模型，包括聚合根、实体、值对象、领域事件和读模型的设计。所有模型遵循 DDD 原则和平台领域基线规范。

## 核心实体

### 1. 租户聚合根（Tenant Aggregate）

**职责**：租户聚合根是租户管理领域的核心实体，负责维护租户的不变式和生命周期状态转移。

**继承关系**：`TenantAggregate extends AggregateRootBase`

**字段定义**：

| 字段名             | 类型                         | 说明         | 约束                                                       |
| ------------------ | ---------------------------- | ------------ | ---------------------------------------------------------- |
| `id`               | `TenantId` (UUID v4)         | 租户唯一标识 | 继承自 `AggregateRootBase`                                 |
| `tenantName`       | `TenantName` (值对象)        | 租户名称     | 1-100 字符，允许中文、英文、数字、连字符、下划线           |
| `status`           | `TenantStatus` (值对象)      | 租户状态     | 枚举：Initialized, Active, Suspended, Archived             |
| `contactInfo`      | `TenantContactInfo` (值对象) | 联系人信息   | 包含负责人姓名、邮箱（必填）、电话（可选）                 |
| `context`          | `TenantContext` (值对象)     | 组织上下文   | 包含默认组织根节点（必填）、默认时区（必填）、货币（可选） |
| `profile`          | `TenantProfile` (实体)       | 租户档案     | 包含法定名称、注册代码、行业分类等可选信息                 |
| `auditTrail`       | `AuditTrail`                 | 审计轨迹     | 继承自 `AggregateRootBase`                                 |
| `softDeleteStatus` | `SoftDeleteStatus`           | 软删除状态   | 继承自 `AggregateRootBase`                                 |
| `version`          | `number`                     | 版本号       | 用于乐观锁，继承自 `AggregateRootBase`                     |

**行为方法**：

- `create(initialData: CreateTenantData): TenantAggregate`
  - 创建租户聚合根
  - 校验租户名称唯一性（由应用层查询保证）
  - 初始化状态为 `Initialized`
  - 触发 `TenantCreatedEvent`
  - 调用 `touch()` 维护审计轨迹

- `activate(initiator: UserId): void`
  - 激活租户
  - 校验状态允许（仅 `Initialized` 或 `Suspended` 可激活）
  - 更新状态为 `Active`
  - 触发 `TenantActivatedEvent`
  - 调用 `touch()` 维护审计轨迹

- `deactivate(initiator: UserId): void`
  - 停用租户
  - 校验状态为 `Active`
  - 更新状态为 `Suspended`
  - 触发 `TenantSuspendedEvent`
  - 调用 `touch()` 维护审计轨迹

- `archive(initiator: UserId): void`
  - 归档租户（软删除）
  - 校验状态允许（任意状态可归档）
  - 调用 `markDeleted()` 标记软删除
  - 触发 `TenantArchivedEvent`
  - 调用 `touch()` 维护审计轨迹

- `updateProfile(command: UpdateTenantProfileCommand): void`
  - 更新租户档案
  - 校验资料字段
  - 触发 `TenantProfileUpdatedEvent`
  - 调用 `touch()` 维护审计轨迹

**不变式**：

- 租户名称在同一平台内必须唯一
- 状态转移必须符合状态机规则
- 已归档的租户不能执行激活、停用操作

---

### 2. 租户档案实体（TenantProfile Entity）

**职责**：存储租户的扩展信息，作为租户聚合的一部分。

**字段定义**：

| 字段名             | 类型     | 说明     | 约束 |
| ------------------ | -------- | -------- | ---- |
| `legalName`        | `string` | 法定名称 | 可选 |
| `registrationCode` | `string` | 注册代码 | 可选 |
| `industry`         | `string` | 行业分类 | 可选 |

**关系**：作为 `TenantAggregate` 的内部实体，可映射为数据库子表。

---

## 值对象

### 1. 租户名称（TenantName）

**职责**：封装租户名称及其校验规则。

**字段**：

- `value: string` - 租户名称值

**校验规则**：

- 长度：1-100 字符
- 允许字符：中文、英文、数字、连字符（-）、下划线（\_）
- 不允许：特殊符号、控制字符

**工厂方法**：

- `static create(value: string): TenantName` - 创建并校验

---

### 2. 租户状态（TenantStatus）

**职责**：封装租户状态枚举和状态转移矩阵。

**枚举值**：

- `Initialized` - 已初始化
- `Active` - 已激活
- `Suspended` - 已暂停
- `Archived` - 已归档

**状态转移规则**：

- `Initialized` → `Active`（激活）
- `Active` → `Suspended`（停用）
- `Suspended` → `Active`（激活）
- 任意状态 → `Archived`（归档）

**方法**：

- `canTransitionTo(target: TenantStatus): boolean` - 检查是否可以转移到目标状态

---

### 3. 租户联系人信息（TenantContactInfo）

**职责**：封装租户的联系人信息。

**字段**：

- `contactName: string` - 负责人姓名
- `email: string` - 邮箱（必填，需符合标准邮箱格式）
- `phone?: string` - 电话（可选，需支持国际格式 +国家代码）

**校验规则**：

- 邮箱必须符合标准邮箱格式
- 电话如提供，需符合国际格式（+国家代码）

---

### 4. 租户上下文（TenantContext）

**职责**：封装租户的组织上下文信息。

**字段**：

- `defaultOrganizationId: OrganizationId` - 默认组织根节点（必填）
- `defaultTimezone: string` - 默认时区（必填，如 "Asia/Shanghai"）
- `currency?: string` - 货币（可选，如 "CNY"）

**校验规则**：

- 默认组织根节点和默认时区为必填字段
- 货币为可选字段

---

## 领域事件

### 1. TenantCreatedEvent

**触发时机**：租户创建成功时

**载荷**：

```typescript
{
  tenantId: TenantId;
  tenantName: string;
  status: TenantStatus;
  contactInfo: TenantContactInfo;
  context: TenantContext;
  auditMetadata: AuditMetadata;
  softDeleteStatus: SoftDeleteStatus;
}
```

---

### 2. TenantActivatedEvent

**触发时机**：租户激活时

**载荷**：

```typescript
{
  tenantId: TenantId;
  tenantName: string;
  previousStatus: TenantStatus;
  currentStatus: TenantStatus; // Active
  auditMetadata: AuditMetadata;
}
```

---

### 3. TenantSuspendedEvent

**触发时机**：租户停用时

**载荷**：

```typescript
{
  tenantId: TenantId;
  tenantName: string;
  previousStatus: TenantStatus; // Active
  currentStatus: TenantStatus; // Suspended
  auditMetadata: AuditMetadata;
}
```

---

### 4. TenantArchivedEvent

**触发时机**：租户归档时

**载荷**：

```typescript
{
  tenantId: TenantId;
  tenantName: string;
  previousStatus: TenantStatus;
  softDeleteStatus: SoftDeleteStatus;
  auditMetadata: AuditMetadata;
}
```

---

### 5. TenantProfileUpdatedEvent

**触发时机**：租户档案更新时

**载荷**：

```typescript
{
  tenantId: TenantId;
  profile: TenantProfile;
  auditMetadata: AuditMetadata;
}
```

---

## 读模型

### 1. TenantProjection（租户投影）

**存储**：PostgreSQL 关系型数据库

**用途**：支持复杂查询和关联查询

**字段**：

| 字段名                  | 类型       | 说明           |
| ----------------------- | ---------- | -------------- |
| `tenantId`              | `UUID`     | 租户ID（主键） |
| `tenantName`            | `string`   | 租户名称       |
| `status`                | `string`   | 租户状态       |
| `contactName`           | `string`   | 负责人姓名     |
| `email`                 | `string`   | 邮箱           |
| `phone`                 | `string?`  | 电话           |
| `defaultOrganizationId` | `UUID`     | 默认组织ID     |
| `defaultTimezone`       | `string`   | 默认时区       |
| `currency`              | `string?`  | 货币           |
| `legalName`             | `string?`  | 法定名称       |
| `registrationCode`      | `string?`  | 注册代码       |
| `industry`              | `string?`  | 行业分类       |
| `createdAt`             | `DateTime` | 创建时间       |
| `updatedAt`             | `DateTime` | 更新时间       |
| `isDeleted`             | `boolean`  | 是否已删除     |

**索引**：

- 主键索引：`tenantId`
- 唯一索引：`tenantName`
- 状态索引：`status`
- 创建时间索引：`createdAt`（用于排序）

---

### 2. TenantListView（租户列表视图）

**存储**：可选 Redis/Elasticsearch（用于快速过滤和搜索）

**用途**：支持快速列表查询、关键字搜索

**字段**：与 `TenantProjection` 相同，但优化为扁平结构，便于搜索和过滤

**索引**：

- 全文搜索索引：`tenantName`
- 状态索引：`status`
- 创建时间索引：`createdAt`

---

## 数据库表结构

### tenant_events（事件存储表）

**用途**：存储租户聚合的所有领域事件，用于事件溯源

**字段**：

| 字段名        | 类型       | 说明                     |
| ------------- | ---------- | ------------------------ |
| `eventId`     | `UUID`     | 事件ID（主键）           |
| `aggregateId` | `UUID`     | 聚合ID（租户ID）         |
| `eventType`   | `string`   | 事件类型                 |
| `eventData`   | `JSONB`    | 事件载荷                 |
| `version`     | `number`   | 事件版本                 |
| `occurredAt`  | `DateTime` | 发生时间                 |
| `tenantId`    | `UUID`     | 租户ID（用于多租户隔离） |

**索引**：

- 主键索引：`eventId`
- 聚合索引：`aggregateId, version`（用于重建聚合）
- 租户索引：`tenantId`

---

### tenant_projections（租户投影表）

**用途**：存储租户读模型，用于快速查询

**字段**：见上述 `TenantProjection` 字段定义

**索引**：见上述 `TenantProjection` 索引定义

---

## 数据关系图

```
TenantAggregate (聚合根)
├── TenantProfile (实体)
├── TenantName (值对象)
├── TenantStatus (值对象)
├── TenantContactInfo (值对象)
└── TenantContext (值对象)

领域事件流：
TenantCreatedEvent → TenantActivatedEvent → TenantSuspendedEvent → TenantArchivedEvent

读模型：
TenantProjection ← 事件投影更新
TenantListView ← 事件投影更新（可选缓存）
```

---

## 数据校验规则总结

### 租户名称

- 长度：1-100 字符
- 字符集：中文、英文、数字、连字符（-）、下划线（\_）
- 唯一性：同一平台内必须唯一

### 联系人信息

- 邮箱：必填，符合标准邮箱格式
- 电话：可选，如提供需符合国际格式（+国家代码）

### 组织上下文

- 默认组织根节点：必填
- 默认时区：必填
- 货币：可选

### 状态转移

- 仅允许符合状态机规则的转移
- 已归档租户不能执行激活、停用操作

---

## 多租户隔离

所有数据表必须包含 `tenantId` 列，并在应用层和数据库层实现隔离：

- **应用层**：命令/查询自动添加 `tenantId` 过滤条件
- **数据库层**：建立 `tenantId` 索引，支持行级安全策略
- **仓储层**：默认过滤条件包含 `tenantId`，防止跨租户访问

---

## 软删除策略

- 所有聚合根支持软删除，通过 `softDeleteStatus` 字段标记
- 查询时默认排除已删除记录，除非明确指定 `includeDeleted: true`
- 已归档租户在列表查询中默认不显示

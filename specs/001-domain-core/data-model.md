# Data Model - 平台领域核心能力

## 实体与值对象总览

| 名称 | 类型 | 角色定位 | 关键字段 | 关联关系 |
|------|------|----------|----------|----------|
| `AggregateRootBase` | 抽象类 | 聚合根基类，维护不变式与事件 | `id`、`tenantId`、`auditTrail`、`softDeleteStatus`、`version` | 管理聚合内 `EntityBase`，发布 `DomainEventBase` |
| `EntityBase` | 抽象类 | 聚合内部实体基类 | `id?`、`auditTrail?` | 附属于某个 `AggregateRootBase` |
| `AggregateId` | 值对象 | 聚合唯一标识（UUID v4） | `value: string` | 被聚合根与仓储引用 |
| `TenantId` / `OrganizationId` / `DepartmentId` / `UserId` | 值对象 | 多租户上下文标识 | `value: string` | 由聚合、事件、值对象引用，断言租户一致性 |
| `AuditTrail` | 值对象 | 审计轨迹 | `createdAt`、`createdBy`、`updatedAt`、`updatedBy` | 存于聚合与事件 |
| `SoftDeleteStatus` | 值对象 | 软删除状态 | `isDeleted`、`deletedAt`、`deletedBy` | 存于聚合与事件 |
| `DomainEventBase` | 抽象类 | 领域事件基类 | `eventId`、`occurredAt`、`aggregateId`、`tenantContext`、`triggeredBy`、`auditMetadata`、`softDeleteStatus` | 由聚合根收集并交由应用层发布 |
| `RepositoryInterface` | 泛型接口 | 聚合持久化契约 | `findById`、`findBy`、`save`、`delete` | 面向基础设施实现层 |
| `DomainService` | 接口 | 跨聚合领域服务标记 | N/A | 引用仓储或值对象实现规则 |
| `DomainGuards` | 工具 | 守卫与断言方法库 | `assertNotEmpty`、`assertTenantConsistency` 等 | 被所有领域对象调用 |

## 详细定义

### AggregateRootBase
- **职责**：聚合根抽象基类，封装标识生成、租户断言、审计、软删除与领域事件收集。
- **字段与访问器**：
  - `_id: AggregateId`（只读）—— 若未显式提供则通过 UUID 生成器创建。
  - `_tenantId: TenantId` / `_organizationId?: OrganizationId` / `_departmentId?: DepartmentId` —— 代表上下文，构造时强制提供。
  - `_auditTrail: AuditTrail` —— 创建/更新审计信息，通过 `touch()` 更新。
  - `_softDeleteStatus: SoftDeleteStatus` —— 软删除状态，提供 `markDeleted()`、`restore()` 封装。
  - `_version: number` —— 版本号，用于乐观锁或事件溯源。
  - `domainEvents: DomainEventBase[]` —— 内部队列，通过 `addDomainEvent()` 与 `pullDomainEvents()` 管理。
- **关键行为**：
  - `ensureValidState()`（抽象）—— 子类实现不变式校验。
  - `assertSameTenant()` / `assertSameOrganization()` / `assertSameDepartment()` —— 阻止跨上下文操作。
  - `touch(initiator?: UserId | null)` —— 更新审计信息。
  - `markDeleted()` / `restore()` —— 软删除幂等处理。
- **状态转换**：
  - `Active → SoftDeleted`：调用 `markDeleted`，记录删除时间与操作者。
  - `SoftDeleted → Active`：调用 `restore`，清空删除信息并记录恢复者。

### EntityBase
- **职责**：聚合内部实体基类，统一提供可选的审计与标识。
- **字段**：
  - `_id?: AggregateId`（可选，供引用实体使用）。
  - `_auditTrail?: AuditTrail`（需要审计时启用，默认关闭以减轻开销）。
- **约束**：只能通过聚合根公开的方法修改，禁止被外部直接实例化后篡改状态。

### AggregateId
- **类型**：值对象，封装 UUID v4 字符串。
- **校验**：构造时验证格式；提供 `equals`、`toString` 方法。
- **职责**：保障聚合标识在所有模块中唯一且不可变。

### 多租户上下文值对象
- **TenantId / OrganizationId / DepartmentId / UserId**：
  - 存储字段：`value: string`。
  - 校验：非空、长度限制、符合平台 ID 规范（形如 `tenant_` 前缀等，可在守卫中实现）。
  - 行为：`equals`、`toString`。
  - 关系：作为聚合构造参数及事件上下文参数。

### AuditTrail
- **字段**：
  - `createdAt: DateTimeValueObject`
  - `createdBy: UserId | null`
  - `updatedAt: DateTimeValueObject`
  - `updatedBy: UserId | null`
- **行为**：
  - `static create({ createdBy?, updatedBy? })` —— 初始化。
  - `update({ updatedBy? })` —— 返回新实例并更新时间、操作者。
- **校验**：使用 `DateTimeValueObject.now()` 确保时间统一，禁止倒退。

### SoftDeleteStatus
- **字段**：
  - `isDeleted: boolean`
  - `deletedAt: DateTimeValueObject | null`
  - `deletedBy: UserId | null`
- **行为**：
  - `static create(initial?)` —— 默认未删除。
  - `markDeleted(initiator?)` / `restore(initiator?)` —— 幂等状态切换。
- **约束**：恢复后 `deletedAt` 与 `deletedBy` 必须置空。

### DomainEventBase
- **字段**：
  - `eventId: string`（UUID v4）
  - `occurredAt: DateTimeValueObject`
  - `aggregateId: string`
  - `tenantId: TenantId`
  - `organizationId?: OrganizationId`
  - `departmentId?: DepartmentId`
  - `triggeredBy: UserId | null`
  - `auditMetadata: AuditTrail`
  - `softDeleteStatus: SoftDeleteStatus`
- **行为**：
  - `eventName(): string` —— 子类实现，返回 `PastTense + Event`。
- **约束**：禁止携带隐私字段，必须可跨上下文传输。

### RepositoryInterface
- **方法**：
  - `findById(id: TId): Promise<TAggregate | null>`
  - `findBy(criteria: RepositoryCriteria): Promise<TAggregate[]>`
  - `save(aggregate: TAggregate): Promise<void>`
  - `delete(id: TId): Promise<void>`（软删除语义，默认过滤已删除记录）
- **约束**：方法签名使用值对象；实现层负责传入租户上下文过滤条件。

### DomainService
- **描述**：标记接口，限定领域服务为无状态，并通过依赖注入获得仓储。
- **约束**：服务实现需遵循聚合不变式，禁止直接操作持久化。

### DomainGuards
- **职责**：提供常用断言，如 `assertNotEmpty`、`assertValidUUID`、`assertTenantConsistency`。
- **约束**：守卫抛出的异常必须来源于 `libs/infra/exceptions` 中定义的领域异常。


## 最小化租户管理模块设计规范

> 关联基线：`docs/designs/platform-domain-baseline.md`、`docs/designs/platform-domain-design.md`、`docs/designs/platform-cqrs-es-eda-design.md`、`docs/designs/iam-guide.md`

### 1. 背景与目标

- 为 IAM 提供最小可用的租户管理能力：租户创建、启用/停用、软删除与上下文发布。
- 遵循 DDD + Clean Architecture + CQRS + Event Sourcing + 事件驱动架构（EDA）混合模式，确保模块可演化、高可观测。
- 基于平台层领域/应用基线（统一 UUID、审计、软删除、多租户上下文）实现，方便与后续租户计费、配置扩展集成。

### 2. 架构概览

```
┌─────────────────────────────────────────────┐
│ Interface Layer                              │
│  - TenantCommandController                   │
│  - TenantQueryController                     │
└──────────────────────────┬──────────────────┘
                           │ 命令 / 查询
┌──────────────────────────▼──────────────────┐
│ Application Layer (CQRS + ES + EDA)         │
│  - Commands: CreateTenant, ActivateTenant   │
│             DeactivateTenant, ArchiveTenant │
│  - Queries: GetTenantById, ListTenants      │
│  - Sagas / Events: TenantLifecycleSaga      │
└──────────────────────────┬──────────────────┘
                           │ 调用聚合/仓储
┌──────────────────────────▼──────────────────┐
│ Domain Layer (租户子域)                      │
│  - TenantAggregate (聚合根)                  │
│  - TenantProfile (实体)                      │
│  - TenantStatus/ContactInfo (值对象)         │
│  - 领域事件：TenantCreatedEvent 等           │
└──────────────────────────┬──────────────────┘
                           │ 接口
┌──────────────────────────▼──────────────────┐
│ Infrastructure Layer                         │
│  - TenantEventStore (ES)                     │
│  - TenantRepository (MikroORM)               │
│  - Projections (租户读模型)                   │
│  - Outbox/Event Bus 集成                     │
└─────────────────────────────────────────────┘
```

### 3. 领域建模

#### 3.1 聚合根：`Tenant`

- 字段：
  - `tenantId`（UUID v4，继承 `AggregateId` 基类）
  - `tenantName`（值对象，校验长度/编码）
  - `status`（值对象，状态枚举：`Initialized`、`Active`、`Suspended`、`Archived`）
  - `contactInfo`（值对象，包含负责人、邮箱、电话）
  - `context`（值对象，含组织根节点、默认时区等最小上下文）
  - `auditTrail`、`softDeleteStatus`（引用平台审计基线）
  - `version`
- 行为：
  - `create(initialData)`：校验唯一性（由应用层查询保证），触发 `TenantCreatedEvent`
  - `activate(initiator)` → `TenantActivatedEvent`
  - `deactivate(initiator)` → `TenantSuspendedEvent`（供 IAM 禁用权限）
  - `archive(initiator)` → 调用 `markDeleted` 并触发 `TenantArchivedEvent`
  - `updateProfile(command)` → `TenantProfileUpdatedEvent`
  - 所有行为调用 `touch()` 维护审计轨迹，并确保状态转移合法（例如只有 `Initialized/Suspended` 可激活）

#### 3.2 实体与值对象

- `TenantProfile`（实体）：
  - 字段：`legalName`、`registrationCode`、`industry`
  - 可选审计字段（若需追踪）
  - 存储在聚合根内，可映射为子表
- 值对象：
  - `TenantStatus`（封装状态枚举与转移矩阵）
  - `TenantContactInfo`（负责人姓名/邮箱/电话）
  - `TenantContext`（默认组织 ID、默认区域、货币等）
  - 统一使用 `Guard` 工具校验，遵循中文 TSDoc

#### 3.3 领域事件

- `TenantCreatedEvent`
- `TenantActivatedEvent`
- `TenantSuspendedEvent`
- `TenantProfileUpdatedEvent`
- `TenantArchivedEvent`

事件载荷包含：`tenantId`、`tenantName`、`status`、`auditMetadata`、`softDeleteStatus`、租户级上下文，满足 IAM 与外部系统订阅需求。

### 4. 应用层（CQRS + ES）

#### 4.1 命令

| 命令                         | 描述                     | 关键校验                 | 触发事件                    |
| ---------------------------- | ------------------------ | ------------------------ | --------------------------- |
| `CreateTenantCommand`        | 创建租户，设置初始上下文 | 名称唯一、上下文字段有效 | `TenantCreatedEvent`        |
| `ActivateTenantCommand`      | 启用租户                 | 聚合状态允许、未软删除   | `TenantActivatedEvent`      |
| `DeactivateTenantCommand`    | 暂停租户                 | 状态为 Active            | `TenantSuspendedEvent`      |
| `UpdateTenantProfileCommand` | 更新基本资料             | 资料字段校验             | `TenantProfileUpdatedEvent` |
| `ArchiveTenantCommand`       | 软删除租户               | 状态允许、可能迁移数据   | `TenantArchivedEvent`       |

- 命令处理器继承 `CaslCommandHandler`，在执行前校验权限与租户状态。
- 使用 `TenantRepository` 加载聚合，`saveMultiTenantAggregate` 持久化事件流，并调用 `AuditService`。

#### 4.2 查询

- `GetTenantByIdQuery`：返回单个租户读模型（带上下文信息）
- `ListTenantsQuery`：分页查询，可按状态、创建时间、关键字过滤；结合 `CaslMikroORMFilter` 确保权限隔离
- 读模型：
  - `TenantProjection`（MikroORM 或 Mongo）维护租户快照
  - `TenantListView`（可选 Redis/Elastic）用于快速过滤

### 5. 事件驱动与读模型

#### 5.1 事件处理器

- `TenantLifecycleEventHandler`
  - 订阅创建/启用/停用/归档事件，触发 IAM 缓存刷新、租户上下文同步
  - 更新 `TenantProjection`
- `TenantArchivedEventHandler`
  - 通知计费/计量系统
  - 将读模型标记为不可用或移入冷数据存储

#### 5.2 Saga / EDA

- `TenantLifecycleSaga`
  - 监听 `TenantCreatedEvent`，初始化默认组织结构、IAM 基础角色
  - 监听 `TenantSuspendedEvent`，触发 IAM 禁用权限，通知消息系统
  - Saga 失败时记录补偿，如重新激活租户或回滚初始化操作

### 6. 基础设施与目录结构

```
tenant/
├── src/
│   ├── domains/
│   │   └── tenant/
│   │       ├── aggregates/tenant.aggregate.ts
│   │       ├── entities/tenant-profile.entity.ts
│   │       ├── value-objects/
│   │       │   ├── tenant-status.vo.ts
│   │       │   ├── tenant-contact.vo.ts
│   │       │   └── tenant-context.vo.ts
│   │       ├── events/
│   │       │   ├── tenant-created.event.ts
│   │       │   └── ...
│   │       └── repositories/tenant.repository.ts
│   ├── application/
│   │   ├── commands/
│   │   │   ├── create-tenant.command.ts
│   │   │   └── ...
│   │   ├── queries/
│   │   │   ├── get-tenant.query.ts
│   │   │   └── ...
│   │   └── sagas/tenant-lifecycle.saga.ts
│   ├── infrastructure/
│   │   ├── repositories/tenant.repository.impl.ts
│   │   ├── event-store/tenant-event-store.ts
│   │   ├── projections/tenant.projection.ts
│   │   └── dto/tenant-read-model.ts
│   └── interfaces/
│       ├── controllers/tenant-command.controller.ts
│       ├── controllers/tenant-query.controller.ts
│       └── dtos/tenant-request.dto.ts
└── tests/
    ├── tenant.aggregate.spec.ts
    ├── create-tenant.command.spec.ts
    └── list-tenants.query.spec.ts
```

### 7. 集成与依赖

- **领域层依赖**：引用平台领域基线提供的聚合根基类、审计/软删除值对象、UUID 生成器。
- **应用层依赖**：使用平台 CQRS/ES/EDA 基线：
  - `CaslCommandHandler`、`CaslQueryHandler`
  - `EventStore`、`EventBus`
  - `AuditService`、`CacheService`
- **IAM 集成**：
  - 发布 `TenantActivatedEvent`、`TenantSuspendedEvent`，IAM 监听并刷新权限上下文
  - 提供 `GetTenantContextQuery`，供 IAM 读取租户默认组织/策略。
- **配置与安全**：
  - 所有命令/查询需通过 `MultiTenantAuthGuard` 和 `CaslGuard`
  - 租户上下文在请求入口解析并注入 `SecurityContext`

### 8. 最小可用功能列表 (MVP)

1. 租户创建：校验唯一性 → 写入事件仓储 → 发布创建事件 → 初始化读模型
2. 租户启用：状态转移 → 发布启用事件 → IAM 启用权限
3. 租户停用：状态转移 → 发布停用事件 → IAM 禁用权限
4. 租户归档（软删除）：更新软删除状态 → 发布归档事件 → 读模型隐藏、通知计费
5. 查询接口：`GET /tenants/:id`、`GET /tenants`、`GET /tenants/:id/context`
6. 观测性：记录每个命令执行时长、事件处理结果、Saga 状态；对外提供指标（Active 租户数、挂起租户数）。

### 9. 测试策略

- **单元测试**：聚合根、值对象、命令处理器、Saga，覆盖率指标与平台基线一致（聚合 ≥95%）。
- **集成测试**：命令→事件→投影链路；Mock IAM 订阅以验证事件内容。
- **契约测试**：事件载荷与 IAM、计费系统对齐；REST 接口契约使用 OpenAPI。
- **回归测试**：软删除/恢复流程、租户上下文变更通知。

### 10. 运维与可观测性

- 指标：`tenant_activation_latency`、`tenant_suspension_total`、`tenant_projection_lag`。
- 日志：通过 `@hl8/logger` 记录命令执行成功/失败、Saga 补偿。
- 告警：租户停用事件失败重试、Saga 超时、投影滞后。

### 11. 后续演进方向

- 租户计费/套餐能力整合
- 多租户配置中心（Feature Flag、限流）
- 与组织/权限模块联动的租户上下文扩展（如默认角色模板）
- 租户生命周期审批流程（可在 Saga 中拓展）

---

该设计提供 IAM 依赖的最小租户生命周期能力，后续功能可以在遵循平台领域/应用基线约束的前提下按需扩展。

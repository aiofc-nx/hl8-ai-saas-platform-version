# 技术研究：租户管理模块

**日期**：2025-01-27  
**关联计划**：[plan.md](./plan.md)

## 研究目标

本阶段研究旨在解决租户管理模块实现中的关键技术决策，确保设计方案符合平台架构规范和最佳实践。

## 研究结果

### 1. CQRS + Event Sourcing 实现模式

**决策**：使用 `@nestjs/cqrs` 实现 CQRS 模式，结合平台提供的 EventStore 实现事件溯源。

**理由**：

- 平台已建立 CQRS + ES + EDA 基线，提供统一的命令/查询处理器基类
- `@nestjs/cqrs` 与 NestJS 深度集成，支持依赖注入和模块化
- 平台基线提供 `CaslCommandHandler` 和 `CaslQueryHandler` 基类，集成权限验证

**实现模式**：

- 命令处理器：实现 `ICommandHandler<Command>` 接口，使用 `@CommandHandler(Command)` 装饰器
- 查询处理器：实现 `IQueryHandler<Query>` 接口，使用 `@QueryHandler(Query)` 装饰器
- 事件存储：使用平台提供的 `EventStore` 接口，通过 `saveMultiTenantAggregate` 方法持久化事件流
- 事件发布：聚合根通过 `addDomainEvent` 收集事件，应用层调用 `EventBus.publishAll()` 发布

**替代方案考虑**：

- 直接使用数据库存储事件：不符合平台基线规范，无法复用统一的事件存储能力
- 自定义 CQRS 实现：增加维护成本，与平台架构不一致

**参考文档**：

- `docs/designs/platform-cqrs-es-eda-baseline.md`
- `docs/training/application-layer-guide.md`

---

### 2. 事件驱动架构（EDA）实现

**决策**：使用 NestJS EventBus 发布领域事件，通过事件处理器订阅并处理事件，支持异步重试机制。

**理由**：

- 平台基线提供统一的事件总线接口，支持内部事件总线和外部消息代理
- 事件处理器通过 `@EventsHandler(Event)` 装饰器订阅事件，实现解耦
- 支持事件载荷携带 `correlationId`、`causationId` 保证链路可观测

**实现模式**：

- 领域事件：继承 `DomainEventBase`，包含 `tenantId`、`auditMetadata`、`softDeleteStatus` 等字段
- 事件命名：采用 `PastTense + Event` 格式（如 `TenantCreatedEvent`）
- 事件发布：在命令处理器中，聚合根保存后调用 `eventBus.publishAll(aggregate.getUncommittedEvents())`
- 事件订阅：事件处理器实现 `IEventHandler<Event>` 接口，处理读模型更新、外部系统通知等

**失败处理**：

- 事件发布失败时记录错误日志并支持异步重试
- 租户操作本身不因事件发布失败而失败，保证最终一致性
- 使用 Outbox 模式确保事件至少一次投递

**替代方案考虑**：

- 同步调用外部系统：违反最终一致性原则，增加系统耦合
- 直接数据库轮询：性能差，实时性不足

**参考文档**：

- `docs/designs/platform-domain-baseline.md` (4.3 领域事件)
- `docs/designs/iam-guide.md` (3.1 命令驱动流程)

---

### 3. Saga 编排模式

**决策**：使用 `@nestjs/cqrs` 的 Saga 模式协调租户生命周期相关的分布式工作流。

**理由**：

- 租户创建需要初始化默认组织、IAM 基础角色等，涉及多个系统协调
- Saga 模式支持补偿操作，当某个步骤失败时可以回滚或记录补偿
- 平台基线提供 `MultiTenantSaga` 基类，支持租户上下文传递

**实现模式**：

- Saga 类：使用 `@Saga()` 装饰器，通过 `ofType(Event)` 监听领域事件
- 协调流程：监听 `TenantCreatedEvent` → 初始化默认组织 → 初始化 IAM 基础角色
- 补偿机制：如果初始化失败，发布补偿事件或记录失败信息，支持后续重试
- 状态管理：使用 Saga 状态机管理流程状态，支持幂等性

**具体场景**：

- `TenantLifecycleSaga`：
  - 监听 `TenantCreatedEvent`：初始化默认组织结构、IAM 基础角色
  - 监听 `TenantSuspendedEvent`：触发 IAM 禁用权限，通知消息系统
  - 失败时记录补偿，如重新激活租户或回滚初始化操作

**替代方案考虑**：

- 在命令处理器中直接调用：违反单一职责，增加耦合
- 使用工作流引擎：过度设计，增加系统复杂度

**参考文档**：

- `docs/designs/tenant-minimal-design.md` (5.2 Saga / EDA)
- `docs/designs/org-structure-minimal-design.md` (6.2 Saga)

---

### 4. 多租户数据隔离策略

**决策**：采用数据库层面的租户列隔离 + 应用层权限验证 + 仓储层自动过滤的组合策略。

**理由**：

- 数据库层面：所有聚合根表包含 `tenantId` 列，建立索引，支持行级安全策略
- 应用层：命令/查询基类在构造时校验 `tenantId`，处理器中调用 `validateTenantStatus` 确认租户有效
- 仓储层：MikroORM 仓储实现统一拼接 `tenantId` 条件，默认过滤软删除记录

**实现模式**：

- 租户上下文：通过 `TenantContextModule` 和 `TenantClsStore` 管理请求级租户上下文
- 权限验证：使用 CASL 能力服务，结合 `CaslMikroORMFilter` 进行权限过滤
- 数据访问：仓储查询条件必须包含 `tenantId`，可选 `organizationId`、`departmentId`
- 跨租户防护：聚合根在 `apply` 方法内通过 `assertTenant` 防止跨租户污染

**安全措施**：

- 所有命令/查询必须显式传递 `tenantId`
- 领域事件必须携带 `tenantId` 上下文
- 数据库查询自动添加租户过滤条件

**替代方案考虑**：

- Schema 级别隔离：运维复杂度高，不适合 SaaS 平台
- 应用层完全依赖：安全性不足，容易遗漏

**参考文档**：

- `docs/designs/platform-domain-baseline.md` (2. 设计原则 - 第9条)
- `docs/designs/iam-guide.md` (3.2 多租户上下文传递)
- `libs/multi-tenancy/README.md`

---

### 5. 聚合根设计模式

**决策**：租户聚合根继承平台提供的 `AggregateRootBase`，实现事件溯源和状态管理。

**理由**：

- 平台基线提供 `AggregateRootBase`，包含审计、软删除、租户上下文等基础能力
- 聚合根负责维护租户的不变式和生命周期状态转移
- 通过事件溯源记录所有状态变更，支持审计和回放

**实现模式**：

- 继承基类：`TenantAggregate extends AggregateRootBase`
- 状态管理：使用值对象 `TenantStatus` 封装状态枚举和转移矩阵
- 事件收集：通过 `addDomainEvent()` 收集领域事件
- 版本控制：使用 `version` 字段支持乐观锁，防止并发冲突

**状态转移规则**：

- `Initialized` → `Active`（通过激活操作）
- `Active` → `Suspended`（通过停用操作）
- `Suspended` → `Active`（通过激活操作）
- 任意状态 → `Archived`（通过归档操作，软删除）

**替代方案考虑**：

- 直接使用数据库实体：无法实现事件溯源，不符合 DDD 原则
- 状态机库：增加依赖，平台基线已提供足够能力

**参考文档**：

- `docs/designs/platform-domain-baseline.md` (4.1 聚合根与实体)
- `docs/designs/tenant-minimal-design.md` (3.1 聚合根：Tenant)

---

### 6. 读模型投影策略

**决策**：使用事件处理器更新读模型，支持 PostgreSQL（关系型）和 MongoDB（文档型）两种存储。

**理由**：

- 读模型与写模型分离，支持查询性能优化
- 事件驱动更新保证读模型最终一致性
- 支持多种存储引擎，根据查询需求选择

**实现模式**：

- 投影处理器：实现 `IEventHandler<TenantCreatedEvent>` 等接口
- 读模型更新：监听租户生命周期事件，更新 `TenantProjection` 和 `TenantListView`
- 存储选择：
  - `TenantProjection`：PostgreSQL 关系型存储，支持复杂查询
  - `TenantListView`：可选 Redis/Elasticsearch，用于快速过滤和搜索
- 幂等性：投影处理器必须支持幂等性，防止重复处理事件

**查询优化**：

- 列表查询使用读模型，避免从事件流重建
- 支持分页、过滤、排序等复杂查询
- 缓存热点数据，提升查询性能

**替代方案考虑**：

- 直接从事件流查询：性能差，不适合生产环境
- 同步更新读模型：增加写操作延迟，违反最终一致性原则

**参考文档**：

- `docs/designs/tenant-minimal-design.md` (5. 事件驱动与读模型)
- `docs/designs/iam-guide.md` (3.1 命令驱动流程 - 读模型投影)

---

### 7. 权限验证集成

**决策**：使用 CASL (@casl/ability) 实现权限验证，结合平台提供的 `CaslCommandHandler` 和 `CaslQueryHandler` 基类。

**理由**：

- 平台统一使用 CASL 建模权限策略，保持一致性
- `CaslCommandHandler` 基类集成权限验证，减少重复代码
- 支持声明式权限定义，易于维护和扩展

**实现模式**：

- 命令处理器：继承 `CaslCommandHandler<Command>`，自动进行权限验证
- 查询处理器：继承 `CaslQueryHandler<Query>`，结合 `CaslMikroORMFilter` 进行权限过滤
- 权限定义：超级管理员（SUPER_ADMIN）和平台管理员（ADMIN）可执行所有租户操作
- 权限检查：在处理器执行前，通过 `CaslAbilityService.getAbilityForUser` 验证权限

**权限规则**：

- 租户创建：需要 `tenant:create` 权限
- 租户启用/停用：需要 `tenant:manage` 权限
- 租户归档：需要 `tenant:archive` 权限
- 租户查询：需要 `tenant:read` 权限

**替代方案考虑**：

- 自定义权限系统：增加维护成本，与平台架构不一致
- 简单角色检查：灵活性不足，无法支持细粒度权限

**参考文档**：

- `docs/training/casl.md`
- `docs/designs/iam-guide.md` (3.1 命令驱动流程)

---

## 技术决策总结

| 技术领域   | 决策                       | 关键理由                       |
| ---------- | -------------------------- | ------------------------------ |
| CQRS 实现  | @nestjs/cqrs + 平台基线    | 与平台架构一致，复用统一能力   |
| 事件溯源   | EventStore + EventBus      | 支持审计和回放，保证数据一致性 |
| 事件驱动   | NestJS EventBus + 异步重试 | 解耦系统，支持最终一致性       |
| Saga 编排  | @nestjs/cqrs Saga          | 协调分布式工作流，支持补偿     |
| 多租户隔离 | 数据库列隔离 + 应用层验证  | 多层防护，保证数据安全         |
| 聚合根设计 | AggregateRootBase          | 复用平台能力，符合 DDD 原则    |
| 读模型投影 | 事件驱动更新               | 支持查询性能优化               |
| 权限验证   | CASL + 平台基类            | 统一权限模型，易于维护         |

## 待确认事项

无。所有技术决策已基于平台基线和最佳实践确定。

## 后续行动

1. 基于研究结果进行 Phase 1 设计（数据模型、API 契约）
2. 确保实现方案符合平台宪章和基线规范
3. 在实现过程中持续验证技术决策的有效性

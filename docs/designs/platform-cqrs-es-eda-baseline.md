## CQRS + ES + EDA 平台基线规范

### 1. 文档目标
- 定义团队在 DDD + Clean Architecture + CQRS + ES + EDA 混合架构下的通用能力基线。
- 统一命令查询、事件溯源、事件驱动、权限评估、审计、缓存等跨领域组件的职责与落地路径。
- 指导租户管理、组织结构、用户管理、IAM 等模块复用相同的基础设施，避免重复实现。

### 2. 通用能力域

#### 2.1 CQRS 命令/查询域
- **职责**：封装命令、查询生命周期及权限校验钩子，提供读写分离的统一骨架。
- **核心组件**：
  - `CaslCommand`、`CaslQuery`：多租户安全上下文基类。
  - `CaslCommandHandler`、`CaslQueryHandler`：执行 `validateTenantStatus`、`validateCommandPermission`、`applyCaslFilter` 等通用校验。
  - `CommandValidator`：命令参数验证器，推荐置于 `libs/cqrs/validators`。
- **实现路径**：公共实现存放于 `libs/cqrs/`，领域模块通过继承基类创建具体命令/查询处理器。
- **使用要求**：在命令执行前调用能力服务校验权限，所有命令/查询都必须携带 `SecurityContext`。

#### 2.2 事件溯源 (ES) 域
- **职责**：管理聚合根事件存储、重建与并发控制，确保多租户场景下的权限状态可追溯。
- **核心组件**：
  - `MultiTenantEventSourcedAggregateRoot`、`MultiTenantDomainEvent` 基类。
  - `EventStore` 接口及 `MikroORMEventStore` 实现。
  - 聚合根重建辅助方法 `reconstitute()`。
- **实现路径**：公共接口放在 `libs/event-sourcing/`，具体实体映射由各领域模块旁置。
- **使用要求**：事件载荷必须包含 `tenantId`、审计人、操作时间等字段；事件版本用于并发控制。

#### 2.3 事件驱动 (EDA) 域
- **职责**：分发领域事件到事件总线、消息中间件及外部系统，协调 Saga、投影与下游服务。
- **核心组件**：
  - `EventBus`（Nest CQRS）与外部 `MessageBroker` 适配器。
  - `Saga` 基类及示例 `PermissionChangeSaga`。
  - `ProjectionHandler` 装饰器与基于 MikroORM 的投影实现。
- **实现路径**：标准事件发布器在 `libs/eventing/`，领域模块只需注入并调用。
- **使用要求**：事件处理器必须使用 `@hl8/logger` 记录成功/失败，失败时写入重试/死信队列；Saga 需具备补偿逻辑。

#### 2.4 CASL 能力域
- **职责**：生成、缓存并校验多租户权限规则，为命令/查询提供统一的策略评估。
- **核心组件**：
  - `CaslAbilityService`：能力获取、缓存管理、清理。
  - `EventSourcedCaslAbilityFactory`：根据投影或事件流生成 CASL 规则。
  - `CaslMikroORMFilter`：为查询自动拼接权限条件。
- **实现路径**：公共能力服务位于 `libs/casl/`，配合 Redis/内存缓存驱动。
- **使用要求**：命令、查询在执行前必须通过能力服务校验；投影、事件处理器需在权限变更时主动清理并预热缓存。

#### 2.5 审计日志域
- **职责**：记录命令执行、权限变更、跨领域操作的审计信息，满足合规与追踪需求。
- **核心组件**：
  - `AuditService`、`AuditLog` 实体。
  - 命令拦截器/处理器中的 `record` 调用。
- **实现路径**：审计框架位于 `libs/infra/audit/`，各领域在命令执行后的固定时机写入日志。
- **使用要求**：日志需包含 `tenantId`、`userId`、命令ID、变更字段、时间戳，并统一使用中文描述。

### 3. 通用子域

#### 3.1 值对象通用域
- **职责**：提供跨领域复用的 ID、枚举、时间等值对象。
- **核心组件**：`UserId`、`TenantId`、`OrganizationId`、`DepartmentId`、`AuthorizationStatus`、`DateTime` 封装。
- **实现路径**：集中存放于 `libs/shared/value-objects/`；命名需配合中文 TSDoc 描述业务语义。
- **使用要求**：严禁在领域内直接使用原始字符串/数字表示 ID，必须通过值对象构造并验证。

#### 3.2 缓存域
- **职责**：提供多级缓存设施（内存 + Redis），支撑能力预热、事件投影与跨模块数据同步。
- **核心组件**：`CacheService` 抽象、Redis 实现、缓存键命名规范（`casl:ability:${userId}:${tenantId}` 等）。
- **实现路径**：统一放置在 `libs/infra/cache/`，并通过配置模块注入。
- **使用要求**：缓存命中后仍需进行能力校验，不得因缓存导致越权；缓存更新需伴随事件处理完成后执行。

### 4. 跨领域使用规范
- **注释与文档**：公共 API、类、方法必须使用中文 TSDoc，说明业务语义、前置条件、异常。
- **日志要求**：统一使用 `@hl8/logger` 输出结构化日志，禁止使用 Nest 默认 `Logger` 或第三方散乱日志。
- **异常处理**：跨模块异常需继承 `libs/infra/exceptions` 提供的标准异常类型，禁止抛出裸错误。
- **配置管理**：所有配置通过 `@hl8/config` 加载，并使用 `class-validator` 标注字段校验；配置类需以领域前缀命名。
- **安全上下文**：`SecurityContext` 必须由入口层构建并通过 `AsyncLocalStorage` 传递，含 `tenantId`、`organizationId`、`departmentIds` 等信息。
- **多层级隔离**：命令、查询、事件对象需传递完整的租户/组织/部门上下文；基类应提供 `validateOrganizationScope`、`validateDepartmentScope` 等方法，并在命令处理器中统一调用，确保与领域层隔离策略一致。
- **测试要求**：单元测试旁置 `{file}.spec.ts`，核心通用能力覆盖率 ≥ 90%；集成测试验证命令→事件→投影链路；契约测试校验外部接口与事件契约。

### 5. 领域模块接入指南
1. 在领域模块中引入 `AuthorizationCqrsModule` 或自建的 CQRS 模块，确保命令/查询基类依赖已注册。
2. 定义领域聚合根/事件时继承平台提供的基类，并确保事件包含租户、组织、部门上下文。
3. 命令处理器继承 `CaslCommandHandler`，在执行前调 `validateTenantStatus`、`validateOrganizationScope`、`validateDepartmentScope` 与 `validateCommandPermission`；查询处理器继承 `CaslQueryHandler`，并通过 `CaslMikroORMFilter` 自动带上下文过滤条件。
4. 在事件处理器或投影中调用能力缓存清理与预热方法，保持权限缓存一致。
5. 通过审计服务记录关键操作，并在模块文档中引用本基线规范。

### 6. 版本与扩展
- 平台基线变更需输出变更日志，影响项包括公共基类签名、事件契约、缓存键规范等。
- 领域模块如需扩展（例如新增领域特定 Saga 模板），应在本规范附录登记扩展点并回链至对应实现。
- 建议每季度组织一次跨领域评审，核对各模块对平台基线的依赖状态，避免分叉演进。

### 7. 参考文档
- `docs/designs/iam-guide.md`：IAM 领域设计，引用本基线完成权限治理。
- `docs/designs/iam-domain-boundary-supplement.md`：领域边界及契约说明。
- 后续租户、组织结构、用户管理模块应在设计文档中引用本文件，说明复用范围与差异化实现。


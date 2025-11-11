## 平台级 CQRS + ES + EDA 通用能力设计规范

### 1. 背景与目标
- 构建多租户 SaaS 平台的统一基础架构，支撑租户、组织、用户、IAM 等领域在 DDD + Clean Architecture + CQRS + ES + EDA 混合模式下协同演进。
- 基于 `docs/designs/platform-cqrs-es-eda-baseline.md` 所述基线能力，进一步阐述整体架构图、组件交互流程、代码目录组织与扩展策略。
- 保障跨领域共享的通用能力（命令/查询、事件溯源、事件驱动、CASL 权限、审计、缓存等）具备一致性和可维护性。

### 2. 架构概览
#### 2.1 逻辑视图
```
┌────────────────────────────────────────────────────────────┐
│                        Platform Layer                      │
│  ┌────────────┐   ┌────────────┐   ┌────────────┐          │
│  │  CQRS Core │←→ │ Eventing   │←→ │  CASL Core │          │
│  └────────────┘   └────────────┘   └────────────┘          │
│        ↑                    ↑                    ↑         │
│        │                    │                    │         │
│  ┌────────────┐   ┌────────────┐   ┌────────────┐          │
│  │ Audit Core │←→ │ Cache Core │←→ │ Shared VO  │          │
│  └────────────┘   └────────────┘   └────────────┘          │
└────────────────────────────────────────────────────────────┘
           ↑                    ↑                    ↑
           │                    │                    │
┌────────────────────────────────────────────────────────────┐
│                    Domain Modules (租户/组织/IAM/…)         │
│  领域命令/查询 ｜ 领域聚合根 ｜ 领域事件 ｜ 领域投影 ｜ 接口层│
└────────────────────────────────────────────────────────────┘
```

#### 2.2 物理部署视图
- 公共库统一发布在 monorepo `libs/` / `packages/` 目录，采用 pnpm 工作区管理版本。
- 平台服务与领域服务均运行在 Node.js 20 环境，通过 NestJS 模块化注入通用能力。
- Redis/消息队列/PostgreSQL/MongoDB 等基础设施由平台层统一提供连接工厂，领域模块仅需声明依赖。

### 3. 组件设计

#### 3.1 CQRS 核心
- **模块结构**：
  ```
  libs/cqrs/
  ├── commands/
  │   ├── casl-command.base.ts     // 多租户命令基类
  │   └── casl-command-handler.base.ts
  ├── queries/
  │   ├── casl-query.base.ts
  │   └── casl-query-handler.base.ts
  ├── validators/
  │   └── command-validator.ts
  └── interfaces/
      └── security-context.ts
  ```
- **流程**：命令/查询创建 → 基类校验安全上下文 → 调用能力服务进行 CASL 校验 → 执行领域逻辑 → 返回结果/事件。
- **扩展点**：允许领域注入额外验证器或审计拦截器；提供装饰器扩展命令超时、重试策略。

#### 3.2 事件溯源核心
- **模块结构**：
  ```
  libs/event-sourcing/
  ├── aggregates/
  │   └── multi-tenant-aggregate.base.ts
  ├── events/
  │   └── multi-tenant-event.base.ts
  ├── store/
  │   ├── event-store.interface.ts
  │   ├── mikro-orm-event-store.ts
  │   └── migrations/
  └── utils/
      └── aggregate-reconstitution.ts
  ```
- **事件重建流程**：
  1. 通过 `EventStore` 拉取事件流。
  2. 使用聚合根 `reconstitute` 重放并恢复状态。
  3. 聚合根应用新命令生成未提交事件。
  4. 保存事件并发布到事件总线。
- **并发控制**：事件版本 + 乐观锁；冲突时抛出 `ConcurrencyConflictException` 并由调用方决定重试策略。

#### 3.3 事件驱动核心
- **模块结构**：
  ```
  libs/eventing/
  ├── bus/
  │   ├── event-bus.module.ts
  │   └── event-bus.tokens.ts
  ├── publishers/
  │   └── permission-event-publisher.ts
  ├── sagas/
  │   └── base-saga.ts
  └── projections/
      └── projection-handler.decorator.ts
  ```
- **事件发布流程**：
  1. `EventStore` 保存后返回事件数组。
  2. `PermissionEventPublisher.publishPermissionEvents` 发布至内置 EventBus。
  3. 同步将事件写入消息队列供外部系统消费。
  4. Saga/投影监听事件执行补偿或读模型更新。
- **失败处理**：事件处理器必须捕获异常 → 写入重试/死信队列 → 记录审计与告警。

#### 3.4 CASL 权限核心
- **模块结构**：
  ```
  libs/casl/
  ├── services/
  │   ├── casl-ability.service.ts
  │   └── casl-mikro-orm-filter.ts
  ├── factories/
  │   └── event-sourced-ability.factory.ts
  ├── cache/
  │   └── ability-cache.service.ts
  └── types/
      └── app-ability.ts
  ```
- **能力加载流程**：
  1. 查询缓存 `casl:ability:${userId}:${tenantId}`。
  2. 缓存未命中 → 调用 `AbilityProjection` 获取规则；仍为空则通过事件流重建。
  3. 缓存规则并返回 CASL Ability。
  4. 权限变更事件触发缓存清理与预热。
- **扩展点**：允许注入自定义条件生成器、异步加载策略或多维度能力（如跨租户角色）。

#### 3.5 审计与日志核心
- **模块结构**：
  ```
  libs/infra/audit/
  ├── audit.service.ts
  ├── entities/audit-log.entity.ts
  └── interceptors/command-audit.interceptor.ts
  ```
- **审计流程**：
  1. 命令处理器在保存聚合后调用 `AuditService.record`。
  2. 审计实体写入数据库并通过事件通知监控系统。
  3. 提供查询接口支持合规审计。
- **日志规范**：统一通过 `@hl8/logger` 输出，字段必须包含租户、用户、命令/事件 ID、耗时、结果。

#### 3.6 通用值对象与缓存
- 值对象统一归档于 `libs/shared/value-objects/`，通过工厂方法创建并校验。
- 缓存服务位于 `libs/infra/cache/`，支持 Redis、内存多级缓存，提供统一 TTL 与命名策略。

### 4. 目录与模块装配
```
libs/
├── casl/
├── cqrs/
├── event-sourcing/
├── eventing/
├── infra/
│   ├── audit/
│   └── cache/
└── shared/
    └── value-objects/
```

- 平台层提供 `PlatformCoreModule`，负责聚合上述子模块并暴露公共依赖：
  ```typescript
  @Module({
    imports: [
      CqrsCoreModule,
      EventSourcingModule,
      EventingModule,
      CaslCoreModule,
      AuditModule,
      CacheModule,
      SharedValueObjectModule,
    ],
    exports: [
      CqrsCoreModule,
      EventSourcingModule,
      EventingModule,
      CaslCoreModule,
      AuditModule,
      CacheModule,
      SharedValueObjectModule,
    ],
  })
  export class PlatformCoreModule {}
  ```
- 领域模块引入 `PlatformCoreModule` 后即可复用所有通用能力，无需重复注册。

### 5. 生命周期与流水线
- **开发阶段**：提供脚手架任务（pnpm script）生成命令/查询/聚合/事件骨架，默认继承平台基类。
- **测试阶段**：平台层维护统一测试基座，包含：
  - Jest 基础配置、测试工具（租户上下文 mock、事件存储内存实现等）。
  - 合同测试样例，确保事件契约对齐。
- **发布阶段**：平台通用能力按版本发布，领域模块通过 pnpm workspace 升级依赖；变更日志记录在 `CHANGELOG.md`。
- **运维阶段**：平台层提供监控仪表盘（事件处理耗时、缓存命中率、审计记录数等）并统一告警规则。

### 6. 集成约束
- 所有公共 API、类、枚举必须使用中文 TSDoc 描述并同步更新；变更需经跨领域评审。
- 领域事件载荷必须包含 `tenantId` 和操作主体；跨租户事件需拒绝并记录安全日志。
- 平台模块禁止引用具体业务域代码，保持单向依赖。
- 任何扩展点（新的 Saga、缓存策略、权限模型）必须登记至基线文档并经审计。

### 7. 与领域模块的协作
- 租户/组织/用户/IAM 等模块在设计文档中引用 `platform-cqrs-es-eda-baseline.md` 与本文档，明确复用组件及差异化实现。
- 领域模块应在初始化阶段加载 `PlatformCoreModule`，并在各自的 README/设计文档中标注使用的通用能力清单。
- 若领域模块需要新增共享能力，需在平台层先行实现，再由业务域消费。

### 8. 附录
- **参考**：`docs/designs/platform-cqrs-es-eda-baseline.md`。
- **相关文档**：
  - `docs/designs/iam-guide.md`
  - `docs/designs/iam-domain-boundary-supplement.md`
  - 后续租户/组织结构设计文档
- **术语表**：与基线一致，包含 CASL、CQRS、Saga、Projection、MultiTenant 等。

---

本设计规范与平台基线配合使用，旨在确保各领域模块在统一的通用能力之上快速迭代并保持一致性。任何偏差都需经平台架构团队评审确认。
## 平台级 CQRS + ES + EDA 通用能力设计规范

### 1. 背景与目标
- 平台在多租户企业场景中广泛采用 DDD + Clean Architecture + CQRS + ES + EDA 混合架构。为避免各领域重复建设基础设施，需要统一平台级通用能力。
- 本设计文档在 `docs/designs/platform-cqrs-es-eda-baseline.md` 基线的基础上，进一步阐述架构背景、组件交互流程、目录组织、扩展点和集成约束。
- 目标：为租户管理、组织结构、用户管理、IAM 等模块提供一致的骨架，实现模块解耦、快速迭代与可观测性保障。

### 2. 架构总览

#### 2.1 技术栈约束
- 语言：TypeScript。
- 运行时：Node.js >= 20，NestJS 框架。
- 依赖管理：pnpm，monorepo 管理。
- 数据层：MikroORM + PostgreSQL（事件存储与关系数据）、MongoDB（可选读模型）、Redis（缓存）。
- 日志与配置：`@hl8/logger`、`@hl8/config`。

#### 2.2 系统交互流程
```
                       ┌──────────────────┐
                       │    接口层        │
                       │  (REST/GraphQL)  │
                       └──────┬───────────┘
                              │ SecurityContext
                              ▼
                  ┌──────────────────────────┐
                  │    应用层 (CQRS)          │
                  │ CommandHandler / QueryHandler
                  └──────┬───────────┬──────┘
                         │           │
                         │ Event     │ Query Result
                         ▼           ▼
             ┌──────────────────┐ ┌──────────────────┐
             │  领域层 (ES)     │ │  读模型投影       │
             │ 聚合根 / 事件     │ │ ProjectionHandler │
             └──────┬───────────┘ └──────┬───────────┘
                    │                     │
                    │ Event Store         │ Cache / DB
                    ▼                     ▼
           ┌──────────────────┐   ┌──────────────────┐
           │  事件驱动模块    │   │  能力缓存 / 审计 │
           │ EventBus / Saga │   │ CacheService      │
           └──────────────────┘   └──────────────────┘
```

#### 2.3 跨领域协作原则
- 所有命令、查询、事件统一使用平台提供的基类与工具，避免自建差异化实现。
- 权限判定、上下文传递、缓存策略等交叉关注点必须在平台层统一，而非领域内部重复实现。
- 领域模块仅在必要时扩展平台能力，扩展内容需回归本规范记录。

### 3. 能力域设计

> 以下内容在 `platform-cqrs-es-eda-baseline.md` 已定义职责与核心组件，本文档重点补充上下游交互、目录结构及扩展点。

#### 3.1 CQRS 命令/查询域
- **交互流程**：
  1. 接口层将 `SecurityContext` 注入命令/查询。
  2. `CaslCommandHandler` 执行参数校验、租户状态校验、权限校验、聚合重建。
  3. 聚合执行后产生事件，写入事件存储并发布。
  4. `CaslQueryHandler` 在数据访问前调用 CASL 过滤器，确保结果满足权限。
- **目录结构**：
  ```
  libs/cqrs/
  ├── commands/
  │   ├── casl-command.base.ts
  │   └── casl-command-handler.base.ts
  ├── queries/
  │   ├── casl-query.base.ts
  │   └── casl-query-handler.base.ts
  └── validators/
      └── command-validator.ts
  ```
- **扩展点**：
  - 自定义命令拦截器：可在平台层提供装饰器或拦截器接口，自定义审计或事务行为。
  - 高级校验：支持在 `validateCommandPermission` 里注入更多上下文（如组织层级）。

#### 3.2 事件溯源 (ES) 域
- **流程说明**：
  - 聚合根通过 `apply` 记录事件，调用 `EventStore` 写入。
  - 重建时根据 `aggregateId + tenantId` 获取事件流。
  - 使用事件版本控制防止并发覆盖。
- **目录结构**：
  ```
  libs/event-sourcing/
  ├── aggregates/
  │   └── multi-tenant-event-sourced-aggregate-root.ts
  ├── events/
  │   └── multi-tenant-domain-event.ts
  └── store/
      ├── event-store.interface.ts
      └── mikro-orm-event-store.ts
  ```
- **扩展点**：
  - 幂等处理：可提供通用的乐观锁实现或幂等表。
  - 快照支持：后续可加入快照机制，减少重建成本。

#### 3.3 事件驱动 (EDA) 域
- **流程说明**：
  - 事件写入后立即发布到 `EventBus`（进程内）与 `MessageBroker`（跨服务）。
  - Saga 在事件触发时执行跨模块编排，支持补偿。
  - 投影监听事件，更新读模型与缓存。
- **目录结构**：
  ```
  libs/eventing/
  ├── publishers/
  │   └── permission-event-publisher.ts
  ├── sagas/
  │   └── permission-change.saga.ts (示例)
  └── projections/
      └── projection-handler.decorator.ts
  ```
- **扩展点**：
  - 死信/重试策略：平台统一提供配置，支持插件化。
  - 事件契约管理：可在此模块加入事件版本控制与契约测试工具。

#### 3.4 CASL 能力域
- **流程说明**：
  - 命令/查询通过 `CaslAbilityService` 获取能力。
  - 若缓存命中失败，则调用 `AbilityProjection` 或事件流重建。
  - 每次权限变更事件触发后清理缓存并预热。
- **目录结构**：
  ```
  libs/casl/
  ├── ability/
  │   ├── casl-ability.service.ts
  │   └── event-sourced-ability.factory.ts
  ├── filters/
  │   └── casl-mikro-orm-filter.ts
  └── types/
      └── app-ability.ts
  ```
- **扩展点**：
  - 定制 subject：领域自定义 subject 类型时需在平台层注册。
  - 多缓存层：支持本地缓存 + Redis 的组合策略。

#### 3.5 审计日志域
- **流程说明**：
  - 命令执行成功后调用 `AuditService.record` 写入审计。
  - 审计记录与事件绑定 `correlationId`、`causationId` 便于追踪。
  - 支持异步写入或批量聚合。
- **目录结构**：
  ```
  libs/infra/audit/
  ├── audit.service.ts
  └── audit-log.entity.ts
  ```
- **扩展点**：
  - 审计订阅：可提供事件发布器，将审计事件推送到 BI 或安全平台。
  - 策略控制：支持按租户配置审计粒度。

#### 3.6 值对象通用域
- **规范**：
  - 所有跨领域 ID、状态、时间必须用值对象封装，禁止裸类型。
  - 值对象自带校验与中文 TSDoc。
  - 需支持序列化/反序列化，以便投影和缓存。
- **目录结构**：
  ```
  libs/shared/value-objects/
  ├── tenant-id.vo.ts
  ├── user-id.vo.ts
  ├── organization-id.vo.ts
  └── authorization-status.enum.ts
  ```

#### 3.7 缓存域
- **规范**：
  - 缓存抽象 `CacheService`，实现包括本地、Redis。
  - 键命名规范由平台统一定义，如 `casl:ability:${userId}:${tenantId}`。
  - 缓存更新必须伴随事件处理完成，避免脏读。
- **目录结构**：
  ```
  libs/infra/cache/
  ├── cache.service.ts
  ├── cache.module.ts
  └── redis-cache.service.ts
  ```

### 4. 目录与模块组织

```
libs/
├── casl/
├── cqrs/
├── event-sourcing/
├── eventing/
├── infra/
│   ├── audit/
│   ├── cache/
│   └── exceptions/
└── shared/
    ├── value-objects/
    └── utils/
```

各业务模块在 `apps/` 或 `services/` 下单独维护，依赖上述共享库。任何对共享库的改动需遵循版本发布流程。

### 5. 集成约束
- **安全上下文**：平台提供 `SecurityContext` 封装，中间件负责解析并写入 `AsyncLocalStorage`。所有命令、查询、事件均需携带 `tenantId`、`organizationId`、`departmentIds` 等上下文，并在执行阶段通过 `validateTenantStatus`、`validateOrganizationScope`、`validateDepartmentScope` 校验一致性。
- **配置管理**：配置类需定义在 `@hl8/config` 命名空间下，字段通过 `class-validator` 校验。例如 `CaslCacheConfig`、`EventingConfig`。
- **日志与监控**：所有模块使用 `@hl8/logger` 输出结构化日志，指标统一接入 Prometheus，监控指标至少包括命令延迟、事件处理耗时、缓存命中率。
- **测试要求**：共享库需具备 ≥90% 覆盖率的单元测试，并提供契约测试模板供业务模块使用；集成测试覆盖命令→事件→投影链路与缓存刷新流程。

### 6. 领域模块接入流程
1. 在新模块中引入平台提供的 CQRS、事件、CASL、审计等模块。
2. 定义领域聚合根时继承平台基类，并在领域文档中引用 `platform-cqrs-es-eda-baseline.md`。
3. 命令/查询继承平台基类，实现业务特定逻辑；执行前需统一调用租户/组织/部门范围校验并结合能力服务做权限控制。
4. 事件处理器中清理并预热能力缓存、更新投影、记录审计。
5. 接入契约测试，确保各模块在升级平台基线时不会破坏依赖。

### 7. 扩展与版本管理
- 平台基线升级需在版本日志中记录改动（新增扩展点、变更接口等），并通知各领域团队评估影响。
- 新增扩展点（例如新的 Saga 模板或缓存策略）需在本设计文档中记录扩展方式与限制，避免重复实现。
- 定期（建议每季度）召开跨领域评审会议，对照本规范确认各模块实践情况，确保一致性。

### 8. 参考文档
- `docs/designs/platform-cqrs-es-eda-baseline.md`：能力职责与核心组件清单，作为本设计规范的前置基线。
- `docs/designs/iam-guide.md`：IAM 领域如何复用平台基线的实例。
- `docs/designs/iam-domain-boundary-supplement.md`：领域边界与契约说明，可类比用于其他领域。

---
本设计文档后续更新需要同步至平台基线文档，并通知各领域维护人，以便统一升级计划。


## @hl8/infrastructure-base 能力基线

### 1. 文档目标
- 定义 `@hl8/infrastructure-base` 在平台层提供的事件溯源、事件驱动、权限缓存、审计、配置、日志等基础设施能力。
- 为 `@hl8/application-base` 及业务模块提供一致的接口与适配器，支持多租户 SaaS 的高可靠性与可观测性。
- 指导团队在拆分后的多包架构中实现、扩展与运维基础设施组件。

### 2. 核心能力域

#### 2.1 事件溯源 (ES) 域
- **职责**：管理聚合事件存储、重放、并发控制与快照。
- **核心组件**：
  - `EventStore` 接口、`MikroORMEventStore` 实现。
  - `EventStream`、`EventEnvelope` 数据结构。
  - 事件快照服务、聚合重建工具。
- **实现路径**：
  - 接口定义位于 `libs/infrastructure-base/event-sourcing/interfaces/`。
  - MikroORM 实现放在 `libs/infrastructure-base/event-sourcing/mikro-orm/`，需遵循 NodeNext、ES2022 配置。
- **使用要求**：
  - 事件必须携带 `tenantId`、审计信息、版本号。
  - 保存事件后需返回未提交事件供应用层发布。

#### 2.2 事件驱动 (EDA) 域
- **职责**：统一领域事件发布、外部消息队列桥接、Saga/投影订阅。
- **核心组件**：
  - `EventBusModule`、`EventPublisher`、`MessageBrokerAdapter`。
  - `ProjectionHandler` 装饰器、`ProjectionRunner`。
  - Saga 持久化支持（事件表/快照表）。
- **使用要求**：
  - 事件处理器必须使用 `@hl8/logger` 输出结构化日志。
  - 失败事件写入重试或死信队列，并通过监控告警。

#### 2.3 权限与缓存域
- **职责**：提供 CASL 规则加载、缓存、失效与预热能力。
- **核心组件**：
  - `CaslAbilityService`、`AbilityCacheService`。
  - 缓存驱动（Redis、内存）、键命名规范（`casl:ability:${userId}:${tenantId}`）。
- **使用要求**：
  - 所有能力缓存需携带租户、用户、组织维度。
  - 缓存更新事件必须在权限变更投影完成后触发。

#### 2.4 审计与日志域
- **职责**：持久化命令/查询审计信息，统一日志输出。
- **核心组件**：
  - `AuditService`、`AuditLog` 实体、`AuditRepository`。
  - 基于 `@hl8/logger` 的结构化日志封装。
- **使用要求**：
  - 审计记录包含 `tenantId`、`userId`、命令/查询标识、字段差异、时间戳。
  - 日志必须脱敏；敏感字段通过统一过滤器处理。

#### 2.5 配置与异常域
- **职责**：提供配置加载、校验与异常封装。
- **核心组件**：
  - `ConfigurationModule`（基于 `@hl8/config`）。
  - `InfrastructureException` 体系，集中在 `libs/infra/exceptions`。
- **使用要求**：
  - 配置类需使用 `class-validator` 注解字段。
  - 异常需包含中文错误信息与错误码。

### 3. 目录结构建议
```
libs/infrastructure-base/
├── audit/
│   ├── audit.service.ts
│   └── entities/audit-log.entity.ts
├── casl/
│   ├── casl-ability.service.ts
│   └── ability-cache.service.ts
├── eventing/
│   ├── event-bus.module.ts
│   └── message-broker.adapter.ts
├── event-sourcing/
│   ├── event-store.interface.ts
│   ├── mikro-orm-event-store.ts
│   └── utils/aggregate-reconstitution.ts
├── logging/
│   └── logger.provider.ts
├── cache/
│   └── cache.module.ts
└── configuration/
    └── configuration.module.ts
```

- 统一使用 pnpm workspace 管理版本，`package.json` 需声明 `type: "module"`、`engines.node >= 20`。
- 所有公共 API 必须使用中文 TSDoc，描述业务语义、异常、示例。

### 4. 跨包接口约定
- 向 `@hl8/application-base` 暴露接口层（Nest Provider Tokens / TypeScript Interface），禁止暴露具体实现类。
- 提供 `InfrastructureCoreModule` 整合事件、缓存、审计、日志、配置等能力，供应用层模块注入。
- 接口需满足多租户隔离，默认参数包含 `tenantId`、`organizationId`、`departmentId`，禁止依赖裸类型。

### 5. 测试与可观测性
- 事件储存、发布器、缓存、审计等关键组件需提供单元与集成测试，其中核心路径覆盖率 ≥ 90%。
- 提供测试替身（内存事件存储、内存缓存、空审计服务）供应用层在单元测试中注入。
- 监控指标：
  - 事件写入/发布成功率、重试次数。
  - 权限缓存命中率、刷新耗时。
  - 审计记录写入耗时、失败率。

### 6. 运维与版本治理
- 基础设施能力变更需同步更新 `CHANGELOG.md`，标明 breaking change 与迁移指南。
- 新增外部依赖（如消息队列、缓存驱动）需通过平台架构评审，并在文档中登记配置项。
- 提供标准化部署与回滚脚本，确保与平台监控体系对齐。

### 7. 接入流程
1. 业务模块或 `@hl8/application-base` 引入 `InfrastructureCoreModule`。
2. 通过依赖注入获得事件存储、事件发布器、审计服务、缓存服务等接口。
3. 根据业务需求扩展特定实现（如自定义消息队列适配器），需实现统一接口并在模块注册。
4. 配置文件通过 `ConfigurationModule` 加载，确保字段校验通过。

### 8. 扩展点登记
- **事件发布适配器**：支持 Kafka、RabbitMQ、RocketMQ 等多种实现。
- **缓存驱动**：默认 Redis，可扩展至 Memcached、本地内存。
- **审计存储**：默认 PostgreSQL，可扩展 MongoDB、Elasticsearch 搜索方案。
- 扩展实现需在文档中记录接入方式、配置项与注意事项。


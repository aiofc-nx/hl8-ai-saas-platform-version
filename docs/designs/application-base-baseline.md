## @hl8/application-base 能力基线

### 1. 文档目标
- 定义 `@hl8/application-base` 在 DDD + Clean Architecture + CQRS + EDA 混合架构下提供的通用应用层能力。
- 统一命令、查询、Saga、权限校验、应用层审计协调等跨领域组件，支撑租户、组织、IAM 等模块快速复用。
- 指导业务团队在拆分后的多包体系中，如何依赖 `@hl8/application-base` 构建可扩展的应用服务。

### 2. 核心能力域

#### 2.1 命令/查询（CQRS）域
- **职责**：封装命令、查询的生命周期管理、租户隔离、权限预校验与审计钩子。
- **核心组件**：
  - `CaslCommandBase`、`CaslQueryBase`：携带 `SecurityContext` 的基类。
  - `CaslCommandHandler`、`CaslQueryHandler`：统一执行 `validateTenantScope`、`validateOrganizationScope`、`validateDepartmentScope`、`validateCommandPermission`。
  - `CommandValidator`：命令参数校验器，推荐旁置于 `libs/application-base/cqrs/validators`。
- **使用要求**：
  - 所有命令、查询必须显式传入 `SecurityContext`。
  - 在执行前应调用 CASL 能力服务（来自 `@hl8/infrastructure-base` 的接口适配）完成权限校验。
  - 命令执行完成后需调用审计协调器记录操作结果。

#### 2.2 Saga 与应用流程编排
- **职责**：协调跨聚合、跨服务的长事务流程，提供补偿与重试策略。
- **核心组件**：
  - `BaseSaga`、`SagaStep` 抽象。
  - `SagaOrchestrator`：统一注入事件总线、消息驱动。
- **使用要求**：
  - Saga 必须声明租户上下文传递策略与补偿路径。
  - Saga 步骤中调用的基础设施需通过 `@hl8/infrastructure-base` 暴露的接口访问。

#### 2.3 CASL 权限协同域
- **职责**：承接基础设施层的 CASL 能力，完成应用层的权限生命周期管理。
- **核心组件**：
  - `CaslAbilityCoordinator`：封装能力加载、缓存刷新、失败回退。
  - `AbilityGuard`：供命令/查询处理器注入的权限守卫。
- **使用要求**：
  - 命令/查询处理器在业务逻辑前必须调用 `CaslAbilityCoordinator.ensureAuthorized`。
  - 事件/投影处理器需在权限变更时触发能力缓存刷新。

#### 2.4 应用层审计协调域
- **职责**：在命令/查询完成后触发审计记录、日志输出。
- **核心组件**：
  - `AuditCommandInterceptor`、`AuditQueryInterceptor`。
  - `AuditCoordinator`：封装写入 `@hl8/infrastructure-base` 提供的审计服务。
- **使用要求**：
  - 审计记录必须包含 `tenantId`、`userId`、命令 ID、关键字段变化。
  - 所有输出统一通过 `@hl8/logger`。

### 3. 目录结构建议
```
libs/application-base/
├── casl/
│   ├── casl-ability-coordinator.ts
│   └── casl-ability.guard.ts
├── cqrs/
│   ├── commands/
│   │   ├── casl-command.base.ts
│   │   └── casl-command-handler.base.ts
│   ├── queries/
│   │   ├── casl-query.base.ts
│   │   └── casl-query-handler.base.ts
│   ├── sagas/
│   │   └── base-saga.ts
│   └── validators/
│       └── command-validator.ts
├── audit/
│   ├── audit-command.interceptor.ts
│   └── audit-coordinator.ts
└── interfaces/
    └── security-context.interface.ts
```

- 所有 TypeScript 配置需继承根 `tsconfig.json`，`module`/`moduleResolution` 设为 `NodeNext`。
- 公共 API 必须使用中文 TSDoc（含 `@description`、`@example`、`@throws` 等标记）。

### 4. 跨包依赖规则
- `@hl8/application-base` 可依赖 `@hl8/infrastructure-base` 提供的接口/适配器，但禁止引用具体实现细节。
- 业务应用层模块应仅依赖 `@hl8/application-base` 暴露的 Nest 模块或服务，同时通过依赖注入接收基础设施实现。
- 命令/查询/ Saga 在需要持久化与消息通信时，只能调用通过接口注入的基础设施服务，确保解耦。

### 5. 测试与质量要求
- 命令/查询处理器需编写旁置单元测试，覆盖权限校验、租户隔离、审计触发等行为。
- Saga 测试需模拟步骤成功、补偿与重试路径。
- 公共基类、拦截器必须提供示例测试，验证 `SecurityContext` 传递与异常处理。
- 覆盖率指标：核心基类 ≥ 90%，协调器 ≥ 85%。

### 6. 接入指南
1. 业务模块引入 `ApplicationCoreModule`（由 `@hl8/application-base` 暴露），自动注册命令/查询基类、权限协调器、审计拦截器。
2. 为每个命令/查询实现专属处理器，继承基类并实现 `execute` 逻辑。
3. 在模块初始化时配置权限策略与审计描述，确保日志输出与能力加载一致。
4. 对接需要的基础设施服务（事件发布、缓存、审计存储），通过接口依赖注入。

### 7. 版本与扩展
- 新增或变更公共基类签名时需更新 `CHANGELOG.md` 并通知各领域团队。
- 扩展点（自定义命令拦截器、Saga 模板、权限加载策略）需在本文件登记，并在对应目录提供 README。
- 每季度组织审查，确保 `@hl8/application-base` 与 `@hl8/infrastructure-base` 的接口契约保持一致。


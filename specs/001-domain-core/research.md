# Phase 0 Research - 平台领域核心能力

## 决策项与依据

### 决策 1：领域层保持基础设施无感知，统一通过值对象封装上下文
- **Decision**：聚合根、实体与值对象仅依赖 `@hl8/domain-core` 内部工具与 `class-validator` / `class-transformer`，禁止直接耦合 NestJS、MikroORM 等实现。
- **Rationale**：与 `docs/designs/platform-domain-baseline.md` 的“领域纯净性”“统一领域语言”原则一致，确保各业务上下文可以在不同运行时环境（命令、事件、批处理）中复用领域模型。
- **Alternatives considered**：直接在领域层引入 MikroORM 实体或 NestJS 装饰器以减少重复代码 —— 违背分层约束，限制跨平台复用，故放弃。

### 决策 2：领域事件需携带完整审计与多租户上下文
- **Decision**：`DomainEventBase` 默认包含 `tenantId`、`organizationId?`、`departmentId?`、`triggeredBy`、`AuditTrail`、`SoftDeleteStatus`，所有聚合行为必须在状态变更后推入带上下文的事件。
- **Rationale**：`docs/designs/platform-domain-design.md` 对事件驱动一致性与上下文传递有强约束，可保证 CQRS 读模型与跨域集成无需额外查询即可进行租户隔离与审计追踪。
- **Alternatives considered**：将审计信息留在应用层记录 —— 会导致下游事件处理缺乏操作者信息，难以满足章程的可观测性与审计要求，故不采纳。

### 决策 3：统一审计与软删除值对象并提供测试基座
- **Decision**：提供 `AuditTrail`、`SoftDeleteStatus` 值对象与对应的测试工厂，构建 `libs/domain-testing` 工具包，支持聚合单元测试与事件契约测试。
- **Rationale**：章程要求核心业务逻辑单元测试覆盖率 ≥ 95%，统一的测试基座可减少团队搭建门槛；软删除幂等与审计一致性是多租户安全关键。
- **Alternatives considered**：让各领域自行实现审计与软删除 —— 容易产生语义偏差与缺失审计字段，难以达成跨团队一致，故弃用。


# 数据模型：多租户与权限设计规范

## 1. TenantExecutionContextGuideline
- **描述**：说明如何在不同入口建立与传播租户上下文，保证 Clean Architecture 各层读取一致。
- **字段**
  - `entryType`：入口类型（HTTP、消息、任务）；必填，枚举值限定。
  - `tenantSource`：租户标识来源（Header、JWT、事件元信息、API Key 映射）；必填。
  - `validationRules`：前置校验要求（空值拦截、租户状态检查）；必填。
  - `propagationMechanism`：上下文传播方式（CLS、AsyncLocalStorage、手动注入）；必填。
  - `fallbackStrategy`：缺失或无效租户的处理策略（拒绝请求、熔断、告警）；必填。
- **关系**
  - 与 `TenantIsolationControlMatrix` 的 `executionLayer` 字段关联，说明上下文如何影响持久化与缓存隔离。

## 2. RoleCapabilityRegistryGuideline
- **描述**：定义角色-能力注册中心的结构、版本管理与同步流程。
- **字段**
  - `roleName`：角色名称（Owner、Admin、Member、自定义角色标识）；必填，需唯一。
  - `capabilities`：能力清单（CASL 动作 + 资源条件）；必填，数组类型。
  - `version`：当前发布版本号；必填，语义化标识。
  - `changeLog`：变更记录（时间、责任人、摘要）；必填。
  - `syncTarget`：同步目标（服务端、前端、文档中心）；可选，数组。
- **关系**
  - 与 `TenantExecutionContextGuideline` 的 `tenantSource` 间接相关：策略需感知租户。
  - 与 `TenantIsolationControlMatrix` 的 `auditArtifacts` 关联，用于审计。

## 3. TenantIsolationControlMatrix
- **关系**
  - 与 `RoleCapabilityRegistryGuideline` 的 `capabilities` 结合，用于定义越权检测与告警能力。
  - 与 `TenantExecutionContextGuideline` 的 `fallbackStrategy` 对应异常流程。

## 4. DomainBoundedContextGuideline
- **描述**：规范 DDD 界限上下文与聚合根在混合架构下的职责划分，以及与多租户、权限能力的组合方式。
- **字段**
  - `boundedContextName`：界限上下文名称；必填，需与业务域一致。
  - `aggregates`：聚合根清单，包含根实体、关键值对象、事务边界说明；必填。
  - `domainServices`：领域服务列表及其触发的命令/事件；必填。
  - `commandQueryHandlers`：命令处理器与查询处理器的映射，注明输入输出模型与租户校验步骤；必填。
  - `eventStream`：事件溯源流名称、分区键（含 `tenantId`）及订阅方；必填。
- **关系**
  - 与 `TenantExecutionContextGuideline` 联动，确保命令/查询在执行前后校验租户上下文。
  - 与 `TenantIsolationControlMatrix` 的 `layer` 字段对齐，说明聚合根操作涉及的隔离控制。
  - 与 `RoleCapabilityRegistryGuideline` 关联，用于限定每个命令/查询允许的角色能力。
- **描述**：列举多租户隔离在不同层级的控制措施与审核项。
- **字段**
  - `layer`：层级（应用仓储、ORM 过滤、数据库、事件溯源、缓存、日志）；必填。
  - `controlMechanism`：具体机制（`BaseTenantRepository`、`TenantAwareSubscriber`、组合唯一索引、事件分区、缓存命名空间等）；必填。
  - `responsibleOwner`：责任角色（领域团队、基础设施团队、安全团队）；必填。
  - `auditArtifacts`：审计凭据（日志、指标、报表）；必填。
  - `failureResponse`：违规处理策略（阻断、告警、补偿措施）；必填。
- **关系**
  - 与 `RoleCapabilityRegistryGuideline` 的 `capabilities` 结合，用于定义越权检测与告警能力。
  - 与 `TenantExecutionContextGuideline` 的 `fallbackStrategy` 对应异常流程。

## 状态与生命周期补充
- 所有指南实体需维护“草案→评审→发布→归档”四段生命周期，并在 Quickstart 中定义更新节奏。
- 每次发布需产出对应版本号与审计记录，写入评审清单与规范附录。


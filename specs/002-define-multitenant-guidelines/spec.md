# Feature Specification: 多租户与权限设计规范

**Feature Branch**: `002-define-multitenant-guidelines`  
**Created**: 2025-11-10  
**Status**: Draft  
**Input**: User description: "综合docs/memos/nestjs-saas-tenant-boilerplate-multitenancy.md和docs/memos/hl8-multitenant-permission-plan.md提出设计规范，注意结合已经开发的libs/infra/multi-tenancy和libs/infra/mikro-orm-nestjs等模块"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - 架构负责人发布统一规范 (Priority: P1)

平台架构负责人需要将现有多租户与权限方案沉淀为统一设计规范，以指导后续业务域的方案评审。

**Why this priority**: 没有统一规范将导致各域重复探索并可能偏离平台基础设施能力，直接影响系统一致性与安全。

**Independent Test**: 评审团队根据规范编制的审查清单即可独立验证某个新模块是否满足多租户与权限设计要求。

**Acceptance Scenarios**:

1. **Given** 平台已有 `libs/infra/multi-tenancy` 与 `libs/infra/mikro-orm-nestjs` 模块，**When** 架构负责人发布设计规范，**Then** 规范明确引用这些模块并阐明适用场景与集成步骤。
2. **Given** 某新域在准备设计评审，**When** 架构负责人提供规范及配套评审表，**Then** 评审表能够覆盖多租户隔离、权限策略与审计三类核心问题。

---

### User Story 2 - 领域团队设计新模块 (Priority: P2)

领域团队在启动新业务模块时，需要快速理解多租户上下文、数据隔离与授权策略的必备设计要求。

**Why this priority**: 领域团队是规范的主要消费者，规范的可操作性直接决定实施效率。

**Independent Test**: 让一个领域团队根据规范完成模块设计草案，观察其是否能在不额外求助的情况下覆盖所有必需设计。

**Acceptance Scenarios**:

1. **Given** 领域团队查看规范，**When** 团队按照步骤设计仓储与应用服务，**Then** 设计说明中包含 `BaseTenantRepository` 使用策略以及在 CQRS Handler 中调用 `TenantContextExecutor` 的说明。
2. **Given** 团队需要定义权限控制，**When** 他们阅读规范的 CASL 策略章节，**Then** 能够明确如何构建角色能力注册表并在控制器上应用 `PoliciesGuard`。

---

### User Story 3 - 安全与合规复核 (Priority: P3)

安全与合规团队需要依托规范确认上线方案满足隔离、授权、审计标准，并能对异常场景给出复核结论。

**Why this priority**: 规范必须支撑合规审查，否则多租户与权限风险无法在上线前被识别。

**Independent Test**: 安全团队使用规范附录的检查项对选取的测试模块执行审查，若能完成且给出明确结论则视为通过。

**Acceptance Scenarios**:

1. **Given** 合规团队拿到规范，**When** 他们复核某模块的租户停用流程，**Then** 可以确认事件流、日志与熔断策略符合规范要求。
2. **Given** 出现越权报警，**When** 安全团队对照规范中的运维响应流程，**Then** 能够定位应补齐的日志、指标与告警配置。

---

### Edge Cases

- 新模块需要访问跨租户共享数据资产时，必须通过规范注册的共享资源白名单、由 CASL 定义的全局能力策略并输出完整审计日志，确保越权可追溯。
- 基础设施团队暂未提供某个目标环境（如定时任务、消息消费）示例时，规范是否指明临时替代方案与责任人？
- 当第三方服务缺失租户字段时，必须在接入层依据签约信息或 API Key 补写或推断 `tenantId`，同时记录映射审计日志并纳入合规复核。

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: 规范必须描述多租户上下文建立、传播与销毁流程，明确 `libs/infra/multi-tenancy` 提供的模块、拦截器、执行器在 HTTP、消息、任务场景下的使用步骤。
- **FR-002**: 规范必须规定数据持久化层对 `BaseTenantRepository`、`TenantAwareSubscriber` 的使用要求，并指示如何结合 `libs/infra/mikro-orm-nestjs` 的实体管理能力确保查询和写入自动带上 `tenantId`。
- **FR-003**: 规范必须定义 CASL 能力工厂、策略装饰器、守卫的设计准则，要求每个业务域维护角色-能力注册表，并阐明如何与租户上下文联动以阻止越权。
- **FR-004**: 规范必须提供覆盖租户隔离、权限控制、事件溯源及日志审计的设计评审清单和测试建议，帮助团队在方案阶段完成自检。
- **FR-005**: 规范必须规定异常和监控的最小要求，包括越权告警、租户停用熔断、结构化日志字段以及如何依托现有运维工具完成追踪。
- **FR-006**: 规范必须描述版本管理与更新流程，要求当基础设施模块（如 `multi-tenancy`、`mikro-orm-nestjs`）发生能力调整时，如何同步更新规范并通知各领域团队。
- **FR-007**: 规范必须明确业务模块在 DDD + Clean Architecture + CQRS + ES 混合架构下的分层职责（界限上下文、聚合根、领域服务、命令/查询处理器）及与多租户、权限策略的协同方式。

### Key Entities _(include if feature involves data)_

- **TenantExecutionContext 指南**: 定义租户上下文在不同入口（HTTP、消息、任务）中的建立规则、必备字段以及对异常场景的处理方式，确保上下文在 Clean Architecture 各层保持一致。
- **RoleCapabilityRegistry 指南**: 描述角色与能力映射的管理方式，包括版本控制、发布节奏、回滚策略及与 CASL 能力工厂的数据同步规范。
- **TenantIsolation Control Matrix**: 梳理多租户数据隔离措施（仓储基类、ORM 过滤、数据库约束、事件分区）之间的关系与职责，用于在设计评审时验证隔离链路是否完整。
- **DomainBoundedContext 指南**: 说明 DDD 界限上下文、聚合根、领域服务与命令/查询处理器的职责边界，并描述其与租户上下文、权限策略、事件溯源流的协同规则。

## Assumptions & Dependencies

- 平台基础设施团队持续维护 `libs/infra/multi-tenancy` 与 `libs/infra/mikro-orm-nestjs` 能力，并在重大升级前至少一周同步规范维护人。
- 规范读者默认熟悉 DDD、Clean Architecture、CQRS、ES、EDA 等平台既有架构原则，本规范在这些原则框架下提供补充要求。

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% 的新增业务域在设计评审前提交的文档中引用该规范的多租户与权限章节，并通过评审清单的全部必选项。
- **SC-002**: 规范发布后两个迭代内，随机抽查的至少 5 个模块均在方案层明确 `multi-tenancy` 与 `mikro-orm-nestjs` 的集成步骤，合规团队验收通过率达到 95%。
- **SC-003**: 规范发布后两个迭代内，抽查的 DDD 设计稿需全部描述界限上下文与聚合根的租户隔离策略，命令/查询链路均包含租户校验与权限判断，达成率 100%。
- **SC-004**: 领域团队对规范清晰度的满意度问卷（5 分制）平均分≥4.3，且无新增多租户越权事故在两个迭代内被记录。
- **SC-005**: 规范上线后一个季度内，多租户与权限相关的设计返工次数相较之前迭代减少 ≥60%，并在季度治理报告中形成可量化佐证。

## Clarifications

### Session 2025-11-10

- Q: 当新模块需要访问跨租户共享数据资产时，规范应如何规定授权豁免与审计补偿要求？ → A: 仅允许在注册的共享资源白名单内进行跨租户访问，且必须通过 CASL 全局能力策略并输出完整审计日志。
- Q: 当第三方服务缺失租户字段时，规范应如何规定补偿机制与审计要求？ → A: 在接入层建立租户映射策略，补写或推断 `tenantId` 并记录映射审计日志。

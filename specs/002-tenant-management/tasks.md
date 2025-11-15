# 任务清单：租户管理模块

**输入**：来自 `/specs/002-tenant-management/` 的设计文档  
**前置文件**：plan.md、spec.md、research.md、data-model.md、contracts/

**测试说明**：根据规格文档要求，需要实现单元测试、集成测试和端到端测试，确保核心业务逻辑覆盖率 80%+，关键路径覆盖率 90%+。

**组织方式**：任务按用户故事分组，确保每个故事可以独立实现与验证。

## 格式规范：`[ID] [P?] [Story] 描述`

- **[P]**：可并行执行（操作不同文件且无依赖）
- **[Story]**：所属用户故事（例如 US1、US2、US3）
- 描述中必须包含精确文件路径

## 阶段 1：环境搭建（共享基础设施）

**目的**：初始化项目结构与基础依赖

- [x] T001 在 `libs/modules/tenant/src/` 建立租户管理模块目录结构（domains/、application/、infrastructure/、interfaces/）
- [x] T002 在 `libs/modules/tenant/package.json` 确认并安装所需依赖（@nestjs/cqrs、@casl/ability、@hl8/domain-base、@hl8/application-base、@hl8/multi-tenancy 等）
- [x] T003 [P] 在 `libs/modules/tenant/src/` 创建 `tenant.module.ts` NestJS 模块文件框架，并在 `libs/modules/tenant/src/index.ts` 导出模块

---

## 阶段 2：基础能力（阻塞项）

**目的**：实现所有用户故事共享的核心基础设施

**⚠️ 严格要求**：此阶段完成前不得开始任何用户故事任务

- [x] T004 在 `libs/modules/tenant/src/domains/tenant/value-objects/` 创建 `tenant-name.vo.ts` 值对象（包含 1-100 字符校验、字符集校验）
- [x] T005 [P] 在 `libs/modules/tenant/src/domains/tenant/value-objects/` 创建 `tenant-status.vo.ts` 值对象（包含状态枚举和状态转移矩阵）
- [x] T006 [P] 在 `libs/modules/tenant/src/domains/tenant/value-objects/` 创建 `tenant-contact-info.vo.ts` 值对象（邮箱格式校验、电话国际格式校验）
- [x] T007 [P] 在 `libs/modules/tenant/src/domains/tenant/value-objects/` 创建 `tenant-context.vo.ts` 值对象（默认组织根节点、默认时区、货币）
- [x] T008 在 `libs/modules/tenant/src/domains/tenant/entities/` 创建 `tenant-profile.entity.ts` 实体（法定名称、注册代码、行业分类）
- [x] T009 在 `libs/modules/tenant/src/domains/tenant/events/` 创建 `tenant-created.event.ts` 领域事件（继承 DomainEventBase）
- [x] T010 [P] 在 `libs/modules/tenant/src/domains/tenant/events/` 创建 `tenant-activated.event.ts` 领域事件
- [x] T011 [P] 在 `libs/modules/tenant/src/domains/tenant/events/` 创建 `tenant-suspended.event.ts` 领域事件
- [x] T012 [P] 在 `libs/modules/tenant/src/domains/tenant/events/` 创建 `tenant-archived.event.ts` 领域事件
- [x] T013 [P] 在 `libs/modules/tenant/src/domains/tenant/events/` 创建 `tenant-profile-updated.event.ts` 领域事件
- [x] T014 在 `libs/modules/tenant/src/domains/tenant/repositories/` 创建 `tenant.repository.ts` 仓储接口（继承平台 Repository 接口）
- [x] T015 在 `libs/modules/tenant/src/infrastructure/repositories/` 创建 `tenant.repository.impl.ts` 仓储实现（使用 EventStore 和 MikroORM）
- [x] T016 在 `libs/modules/tenant/src/infrastructure/projections/` 创建 `tenant.projection.ts` 读模型实体（MikroORM Entity）
- [x] T017 在 `libs/modules/tenant/src/infrastructure/dto/` 创建 `tenant-read-model.ts` DTO（用于查询响应）
- [x] T018 在 `libs/modules/tenant/src/interfaces/dtos/` 创建 `tenant-request.dto.ts` DTO（用于请求参数，包含 class-validator 校验）
- [x] T019 配置数据库迁移，在 `libs/modules/tenant/src/infrastructure/migrations/` 创建租户相关表的迁移文件（tenant_events、tenant_projections）

**检查点**：基础设施准备完毕，值对象、事件、仓储接口和读模型已就绪，可启动用户故事工作

---

## 阶段 3：用户故事 1 - 系统管理员创建新租户（优先级：P1）🎯 MVP

**目标**：实现租户创建功能，包括基本信息收集、唯一性校验、上下文初始化，并发布租户创建事件

**独立验证方式**：通过执行创建租户操作，验证系统能够成功创建租户、生成唯一标识、初始化上下文并发布事件

### 用户故事 1 的测试

> **注意：测试必须先行编写并确认失败，再进行实现。**

- [ ] T020 [P] [US1] 在 `libs/modules/tenant/src/domains/tenant/aggregates/tenant.aggregate.spec.ts` 编写租户聚合根单元测试（创建、状态转移、事件触发）
- [ ] T021 [P] [US1] 在 `libs/modules/tenant/src/domains/tenant/value-objects/tenant-name.vo.spec.ts` 编写租户名称值对象单元测试（校验规则）
- [ ] T022 [P] [US1] 在 `libs/modules/tenant/src/application/commands/create-tenant.command.spec.ts` 编写创建租户命令处理器单元测试
- [ ] T023 [P] [US1] 在 `libs/modules/tenant/tests/integration/create-tenant.integration.spec.ts` 编写创建租户集成测试（命令→事件→投影链路）
- [ ] T024 [P] [US1] 在 `libs/modules/tenant/tests/e2e/tenant-management.e2e.spec.ts` 编写创建租户端到端测试（API 调用→数据库验证→事件验证）

### 用户故事 1 的实现

- [x] T025 [US1] 在 `libs/modules/tenant/src/domains/tenant/aggregates/tenant.aggregate.ts` 实现租户聚合根（继承 AggregateRootBase，实现 create 方法，触发 TenantCreatedEvent）
- [x] T026 [US1] 在 `libs/modules/tenant/src/application/commands/create-tenant.command.ts` 创建 CreateTenantCommand（继承 CaslCommandBase）
- [x] T027 [US1] 在 `libs/modules/tenant/src/application/commands/create-tenant.handler.ts` 实现 CreateTenantHandler（继承 CaslCommandHandler，校验名称唯一性，创建聚合，保存事件流，发布事件）
- [x] T028 [US1] 在 `libs/modules/tenant/src/infrastructure/projections/tenant-projection.handler.ts` 实现 TenantProjectionHandler（监听 TenantCreatedEvent，更新读模型）
- [x] T029 [US1] 在 `libs/modules/tenant/src/interfaces/controllers/tenant-command.controller.ts` 实现创建租户接口（POST /tenants，使用 CreateTenantDto）
- [x] T030 [US1] 在 `libs/modules/tenant/src/interfaces/dtos/create-tenant.dto.ts` 创建 CreateTenantDto（包含 class-validator 校验）
- [x] T031 [US1] 在 `libs/modules/tenant/src/tenant.module.ts` 注册命令处理器、事件处理器、控制器到 NestJS 模块，并在 `libs/modules/tenant/src/index.ts` 导出 TenantModule

**检查点**：用户故事 1 可独立运行与验证，能够成功创建租户并发布事件

---

## 阶段 4：用户故事 2 - 系统管理员启用租户（优先级：P1）

**目标**：实现租户启用功能，将租户状态从"已初始化"或"已暂停"转换为"已激活"，并发布启用事件

**独立验证方式**：通过执行启用租户操作，验证系统能够成功将租户状态转换为"已激活"，并发布启用事件

### 用户故事 2 的测试

- [ ] T032 [P] [US2] 在 `libs/modules/tenant/src/domains/tenant/aggregates/tenant.aggregate.spec.ts` 补充激活方法单元测试（状态转移校验、事件触发）
- [ ] T033 [P] [US2] 在 `libs/modules/tenant/src/application/commands/activate-tenant.command.spec.ts` 编写激活租户命令处理器单元测试
- [ ] T034 [P] [US2] 在 `libs/modules/tenant/tests/integration/activate-tenant.integration.spec.ts` 编写激活租户集成测试

### 用户故事 2 的实现

- [x] T035 [US2] 在 `libs/modules/tenant/src/domains/tenant/aggregates/tenant.aggregate.ts` 实现 activate 方法（校验状态允许，更新状态，触发 TenantActivatedEvent）
- [x] T036 [US2] 在 `libs/modules/tenant/src/application/commands/activate-tenant.command.ts` 创建 ActivateTenantCommand
- [x] T037 [US2] 在 `libs/modules/tenant/src/application/commands/activate-tenant.handler.ts` 实现 ActivateTenantHandler（继承 CaslCommandHandler，加载聚合，调用 activate，保存事件流，发布事件）
- [x] T038 [US2] 在 `libs/modules/tenant/src/infrastructure/projections/tenant-projection.handler.ts` 补充 TenantActivatedEvent 处理逻辑（更新读模型状态）
- [x] T039 [US2] 在 `libs/modules/tenant/src/interfaces/controllers/tenant-command.controller.ts` 实现启用租户接口（POST /tenants/:id/activate）

**检查点**：用户故事 1 与 2 均可独立运行与验证

---

## 阶段 5：用户故事 3 - 系统管理员停用租户（优先级：P1）

**目标**：实现租户停用功能，将租户状态从"已激活"转换为"已暂停"，并发布停用事件

**独立验证方式**：通过执行停用租户操作，验证系统能够成功将租户状态转换为"已暂停"，并发布停用事件

### 用户故事 3 的测试

- [ ] T040 [P] [US3] 在 `libs/modules/tenant/src/domains/tenant/aggregates/tenant.aggregate.spec.ts` 补充停用方法单元测试
- [ ] T041 [P] [US3] 在 `libs/modules/tenant/src/application/commands/deactivate-tenant.command.spec.ts` 编写停用租户命令处理器单元测试
- [ ] T042 [P] [US3] 在 `libs/modules/tenant/tests/integration/deactivate-tenant.integration.spec.ts` 编写停用租户集成测试

### 用户故事 3 的实现

- [x] T043 [US3] 在 `libs/modules/tenant/src/domains/tenant/aggregates/tenant.aggregate.ts` 实现 deactivate 方法（校验状态为 Active，更新状态，触发 TenantSuspendedEvent）
- [x] T044 [US3] 在 `libs/modules/tenant/src/application/commands/deactivate-tenant.command.ts` 创建 DeactivateTenantCommand
- [x] T045 [US3] 在 `libs/modules/tenant/src/application/commands/deactivate-tenant.handler.ts` 实现 DeactivateTenantHandler（继承 CaslCommandHandler，加载聚合，调用 deactivate，保存事件流，发布事件）
- [x] T046 [US3] 在 `libs/modules/tenant/src/infrastructure/projections/tenant-projection.handler.ts` 补充 TenantSuspendedEvent 处理逻辑（更新读模型状态）
- [x] T047 [US3] 在 `libs/modules/tenant/src/interfaces/controllers/tenant-command.controller.ts` 实现停用租户接口（POST /tenants/:id/deactivate）

**检查点**：用户故事 1、2、3 均可独立运行与验证

---

## 阶段 6：用户故事 4 - 系统管理员归档租户（优先级：P2）

**目标**：实现租户归档功能（软删除），标记租户为已归档状态，并发布归档事件

**独立验证方式**：通过执行归档租户操作，验证系统能够成功软删除租户、标记归档状态、发布归档事件，并在查询时默认隐藏已归档租户

### 用户故事 4 的测试

- [ ] T048 [P] [US4] 在 `libs/modules/tenant/src/domains/tenant/aggregates/tenant.aggregate.spec.ts` 补充归档方法单元测试
- [ ] T049 [P] [US4] 在 `libs/modules/tenant/src/application/commands/archive-tenant.command.spec.ts` 编写归档租户命令处理器单元测试
- [ ] T050 [P] [US4] 在 `libs/modules/tenant/tests/integration/archive-tenant.integration.spec.ts` 编写归档租户集成测试（验证软删除、查询过滤）

### 用户故事 4 的实现

- [x] T051 [US4] 在 `libs/modules/tenant/src/domains/tenant/aggregates/tenant.aggregate.ts` 实现 archive 方法（调用 markDeleted，触发 TenantArchivedEvent）
- [x] T052 [US4] 在 `libs/modules/tenant/src/application/commands/archive-tenant.command.ts` 创建 ArchiveTenantCommand
- [x] T053 [US4] 在 `libs/modules/tenant/src/application/commands/archive-tenant.handler.ts` 实现 ArchiveTenantHandler（继承 CaslCommandHandler，加载聚合，调用 archive，保存事件流，发布事件）
- [x] T054 [US4] 在 `libs/modules/tenant/src/infrastructure/projections/tenant-projection.handler.ts` 补充 TenantArchivedEvent 处理逻辑（更新读模型软删除状态）
- [x] T055 [US4] 在 `libs/modules/tenant/src/interfaces/controllers/tenant-command.controller.ts` 实现归档租户接口（POST /tenants/:id/archive）

**检查点**：用户故事 4 可独立运行与验证，归档租户在默认查询中不显示

---

## 阶段 7：用户故事 5 - IAM系统查询租户上下文（优先级：P1）

**目标**：实现租户上下文查询功能，供 IAM 系统查询租户的默认组织ID、默认时区、货币等上下文信息

**独立验证方式**：通过IAM系统调用租户上下文查询接口，验证系统能够返回完整的租户上下文信息

### 用户故事 5 的测试

- [ ] T056 [P] [US5] 在 `libs/modules/tenant/src/application/queries/get-tenant-context.query.spec.ts` 编写查询租户上下文查询处理器单元测试
- [ ] T057 [P] [US5] 在 `libs/modules/tenant/tests/integration/get-tenant-context.integration.spec.ts` 编写查询租户上下文集成测试

### 用户故事 5 的实现

- [x] T058 [US5] 在 `libs/modules/tenant/src/application/queries/get-tenant-context.query.ts` 创建 GetTenantContextQuery（继承 CaslQueryBase）
- [x] T059 [US5] 在 `libs/modules/tenant/src/application/queries/get-tenant-context.handler.ts` 实现 GetTenantContextHandler（继承 CaslQueryHandler，从读模型查询上下文信息）
- [x] T060 [US5] 在 `libs/modules/tenant/src/interfaces/controllers/tenant-query.controller.ts` 实现查询租户上下文接口（GET /tenants/:id/context）
- [x] T061 [US5] 在 `libs/modules/tenant/src/interfaces/dtos/tenant-context-response.dto.ts` 创建 TenantContextResponseDto

**检查点**：用户故事 5 可独立运行与验证，IAM 系统能够查询租户上下文

---

## 阶段 8：用户故事 6 - 系统管理员查询租户列表（优先级：P2）

**目标**：实现租户列表查询功能，支持分页、按状态过滤、关键字搜索

**独立验证方式**：通过执行租户列表查询操作，验证系统能够返回符合条件的租户列表，支持分页和过滤

### 用户故事 6 的测试

- [ ] T062 [P] [US6] 在 `libs/modules/tenant/src/application/queries/list-tenants.query.spec.ts` 编写查询租户列表查询处理器单元测试（分页、过滤、搜索）
- [ ] T063 [P] [US6] 在 `libs/modules/tenant/tests/integration/list-tenants.integration.spec.ts` 编写查询租户列表集成测试（验证分页、状态过滤、关键字搜索、软删除过滤）

### 用户故事 6 的实现

- [x] T064 [US6] 在 `libs/modules/tenant/src/application/queries/list-tenants.query.ts` 创建 ListTenantsQuery（包含 status、keyword、page、pageSize、includeDeleted 参数）
- [x] T065 [US6] 在 `libs/modules/tenant/src/application/queries/list-tenants.handler.ts` 实现 ListTenantsHandler（继承 CaslQueryHandler，从读模型查询，支持分页、状态过滤、关键字搜索、软删除过滤）
- [x] T066 [US6] 在 `libs/modules/tenant/src/interfaces/controllers/tenant-query.controller.ts` 实现查询租户列表接口（GET /tenants，支持查询参数）
- [x] T067 [US6] 在 `libs/modules/tenant/src/interfaces/dtos/list-tenants-query.dto.ts` 创建 ListTenantsQueryDto（包含 class-validator 校验）
- [x] T068 [US6] 在 `libs/modules/tenant/src/interfaces/dtos/tenant-list-response.dto.ts` 创建 TenantListResponseDto（包含分页信息）

**检查点**：用户故事 6 可独立运行与验证，支持分页、过滤、搜索功能

---

## 阶段 9：补充功能与集成

**目的**：实现查询单个租户和更新租户档案功能，完善租户管理能力

- [x] T069 [P] 在 `libs/modules/tenant/src/application/queries/get-tenant-by-id.query.ts` 创建 GetTenantByIdQuery
- [x] T070 [P] 在 `libs/modules/tenant/src/application/queries/get-tenant-by-id.handler.ts` 实现 GetTenantByIdHandler（从读模型查询单个租户）
- [x] T071 [P] 在 `libs/modules/tenant/src/interfaces/controllers/tenant-query.controller.ts` 实现查询单个租户接口（GET /tenants/:id）
- [x] T072 在 `libs/modules/tenant/src/domains/tenant/aggregates/tenant.aggregate.ts` 实现 updateProfile 方法（触发 TenantProfileUpdatedEvent）
- [x] T073 在 `libs/modules/tenant/src/application/commands/update-tenant-profile.command.ts` 创建 UpdateTenantProfileCommand
- [x] T074 在 `libs/modules/tenant/src/application/commands/update-tenant-profile.handler.ts` 实现 UpdateTenantProfileHandler
- [x] T075 在 `libs/modules/tenant/src/interfaces/controllers/tenant-command.controller.ts` 实现更新租户档案接口（PATCH /tenants/:id/profile）
- [x] T076 在 `libs/modules/tenant/src/infrastructure/projections/tenant-projection.handler.ts` 补充 TenantProfileUpdatedEvent 处理逻辑

---

## 阶段 10：Saga 与事件驱动集成

**目的**：实现租户生命周期 Saga，协调租户创建后的初始化流程

- [x] T077 在 `libs/modules/tenant/src/application/sagas/tenant-lifecycle.saga.ts` 创建 TenantLifecycleSaga（监听 TenantCreatedEvent，初始化默认组织、IAM 基础角色）
- [x] T078 在 `libs/modules/tenant/src/application/sagas/tenant-lifecycle.saga.ts` 实现补偿机制（初始化失败时记录补偿，支持后续重试）
- [x] T079 在 `libs/modules/tenant/src/tenant.module.ts` 注册 Saga 到 NestJS 模块

---

## 阶段 11：打磨与跨切关注点

**目的**：处理影响多个用户故事的提升项

- [ ] T080 [P] 在 `libs/modules/tenant/src/` 所有文件补充完整中文 TSDoc 注释（符合平台宪章要求）
- [ ] T081 [P] 在 `tests/unit/tenant/` 增补缺漏单元测试，确保核心业务逻辑覆盖率 80%+，关键路径覆盖率 90%+
- [ ] T082 代码清理与重构，确保遵循平台宪章约束（使用 @hl8/config、@hl8/logger、@hl8/exceptions、@hl8/cache）
- [ ] T083 性能优化并记录基线结果（验证 1000 并发查询、10,000 租户列表查询性能）
- [ ] T084 安全与租户隔离加固（验证所有查询自动添加 tenantId 过滤，防止跨租户访问）
- [ ] T085 事件发布失败处理（实现异步重试机制，确保最终一致性）
- [x] T086 校验 `specs/002-tenant-management/quickstart.md` 并更新（确保示例代码与实际实现一致）
- [x] T087 在 `libs/modules/tenant/src/index.ts` 导出 TenantModule 和所有公共 API，确保模块可作为 `@hl8/tenant` 包被其他应用导入使用

---

## 依赖与执行顺序

### 阶段依赖

- **阶段 1：环境搭建**：无前置，可立即开始
- **阶段 2：基础能力**：依赖阶段 1，完成前阻塞全部用户故事
- **阶段 3-8：用户故事实现**：依赖阶段 2；P1 优先级故事（US1、US2、US3、US5）可并行或按顺序执行，P2 优先级故事（US4、US6）在 P1 完成后执行
- **阶段 9-10：补充功能与集成**：依赖阶段 3-8 完成
- **阶段 11：打磨**：依赖所有目标用户故事完成

### 用户故事依赖

- **用户故事 1（P1）**：阶段 2 完成后即可开始，无其他故事依赖
- **用户故事 2（P1）**：阶段 2 完成后可启动，依赖 US1（需要租户已创建）
- **用户故事 3（P1）**：阶段 2 完成后可启动，依赖 US2（需要租户已激活）
- **用户故事 4（P2）**：阶段 2 完成后可启动，依赖 US1（需要租户已创建）
- **用户故事 5（P1）**：阶段 2 完成后可启动，依赖 US1（需要租户已创建）
- **用户故事 6（P2）**：阶段 2 完成后可启动，依赖 US1（需要租户数据）

### 用户故事内部顺序

- 测试必须在实现前编写并确认失败
- 领域层（聚合根、值对象、事件）先于应用层（命令/查询处理器）
- 应用层先于基础设施层（仓储实现、投影处理器）
- 基础设施层先于接口层（控制器、DTO）
- 核心实现完成后再做集成和 Saga

### 并行机会

- 阶段 1 中标记 `[P]` 的任务可并行
- 阶段 2 中标记 `[P]` 的值对象、事件创建任务可并行
- 完成阶段 2 后，不同用户故事可并行推进（但需注意依赖关系）
- 单个用户故事内标记 `[P]` 的测试任务可并行
- 不同故事之间的任务天然可分配给不同成员

---

## 实施策略

### MVP 优先（仅交付用户故事 1）

1. 完成阶段 1：环境搭建
2. 完成阶段 2：基础能力（关键阻塞）
3. 完成阶段 3：用户故事 1（创建租户）
4. **暂停并验证**：执行测试，确认覆盖率达标，验证租户创建功能
5. 若可交付则发布/演示

### 渐进式交付

1. 完成阶段 1 + 阶段 2 → 基础设施就绪
2. 添加用户故事 1（创建租户）→ 测试 → 发布/演示
3. 添加用户故事 2（启用租户）→ 测试 → 发布/演示
4. 添加用户故事 3（停用租户）→ 测试 → 发布/演示
5. 添加用户故事 5（查询上下文）→ 测试 → 发布/演示
6. 添加用户故事 4（归档租户）→ 测试 → 发布/演示
7. 添加用户故事 6（查询列表）→ 测试 → 发布/演示
8. 每个故事都在不破坏先前成果的前提下持续累积价值

### 多人并行策略

1. 团队协作完成阶段 1 + 阶段 2
2. 基础设施就绪后：
   - 成员 A：负责用户故事 1（创建租户）
   - 成员 B：负责用户故事 2（启用租户）和用户故事 3（停用租户）
   - 成员 C：负责用户故事 5（查询上下文）和用户故事 6（查询列表）
   - 成员 D：负责用户故事 4（归档租户）和补充功能
3. 各故事独立完成并在阶段 11 聚合

---

## 备注

- 标记 `[P]` 的任务表示可在不同文件上并行进行
- `[US1]`、`[US2]` 等标签用于追踪任务所属用户故事
- 每个用户故事都必须可独立完成并测试，保障租户隔离与章程合规
- 编写实现前先写测试，确保测试初次运行失败
- 每完成一个任务或逻辑分组即提交一次，提交信息请使用英文
- 可在任意检查点暂停并验证当前用户故事
- 避免含糊任务、跨故事耦合或破坏独立性的依赖
- 所有代码必须使用中文 TSDoc 注释，符合平台宪章要求
- 必须使用平台基础设施模块（@hl8/config、@hl8/logger、@hl8/exceptions、@hl8/cache、@hl8/mikro-orm-nestjs），禁止旁路实现

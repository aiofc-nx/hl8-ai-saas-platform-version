## 最小化组织架构管理模块设计规范

> 关联基线：
>
> - `docs/designs/platform-domain-baseline.md` / `docs/designs/platform-domain-design.md`
> - `docs/designs/platform-cqrs-es-eda-design.md`
> - `docs/designs/tenant-minimal-design.md`
> - `docs/designs/user-minimal-design.md`
> - `docs/designs/iam-guide.md`

### 1. 背景与目标

- 构建 IAM 所需的最小组织架构能力：组织（Organization）与部门（Department）两个子域，支持层级管理、启用/停用、软删除、成员同步。
- 采用 DDD + Clean Architecture + CQRS + Event Sourcing + EDA 混合模式，并遵循平台基线（UUID、审计、软删除、多租户上下文）。
- 保障组织结构的可演化性（支持树状/矩阵拓展）、高可观测性，并与租户、用户、IAM 等模块协同。

### 2. 领域概览

```
┌─────────────────────────────────────────────────────┐
│ Organization Subdomain                               │
│  - OrganizationAggregate (聚合根)                     │
│  - 值对象：OrganizationName、OrgCode、OrgContext       │
│  - 事件：OrganizationCreated/Activated/Suspended/...  │
│  - 子聚合：根节点、默认策略                           │
└─────────────────────────────────────────────────────┘
          ↑                       ↑
          │ 管理组织层级           │ 依赖组织
┌─────────────────────────────────────────────────────┐
│ Department Subdomain                                 │
│  - DepartmentAggregate (聚合根)                      │
│  - 值对象：DepartmentName、DepartmentPath            │
│  - 事件：DepartmentCreated/Moved/Archived            │
│  - 维护部门树、成员关系                               │
└─────────────────────────────────────────────────────┘
```

### 3. 组织子域（Organization）

#### 3.1 聚合根：`Organization`

- 字段：
  - `organizationId`（UUID v4）
  - `tenantId` （值对象，确保组织与租户绑定）
  - `name`（值对象，校验唯一性）
  - `code`（可选，值对象，组织编码）
  - `status`（值对象：`Initialized`、`Active`、`Suspended`、`Archived`）
  - `rootDepartmentId`（引用部门聚合的根节点）
  - `context`（如时区、语言、默认审批流程等）
  - `auditTrail`、`softDeleteStatus`、`version`
- 行为：
  - `register(command)` → `OrganizationCreatedEvent`
  - `activate(initiator)` → `OrganizationActivatedEvent`
  - `suspend(initiator)` → `OrganizationSuspendedEvent`
  - `archive(initiator)` → 软删除 + `OrganizationArchivedEvent`
  - `updateProfile(command)`（更新组织信息） → `OrganizationProfileUpdatedEvent`
- 约束：同租户下组织名称/编码唯一；组织归档前需确保部门已迁移/归档或执行补偿流程。

#### 3.2 值对象与实体

- `OrganizationName`、`OrganizationCode`
- `OrganizationContext`（默认策略、审批流程设置）
- `OrganizationPolicy`（实体，可拓展：审批模板、角色模板）

#### 3.3 事件

- `OrganizationCreatedEvent`
- `OrganizationActivatedEvent`
- `OrganizationSuspendedEvent`
- `OrganizationArchivedEvent`
- `OrganizationProfileUpdatedEvent`

### 4. 部门子域（Department）

#### 4.1 聚合根：`Department`

- 字段：
  - `departmentId`（UUID v4）
  - `tenantId`
  - `organizationId`
  - `name`、`code`
  - `parentDepartmentId`（根部门可为 null，或指向自身）
  - `path`（值对象，记录层级路径，便于查询）
  - `managerUserId`（可选，关联 User 模块）
  - `status`（Active/Suspended/Archived）
  - `auditTrail`、`softDeleteStatus`、`version`
- 行为：
  - `create(command)`：校验父部门合法 → `DepartmentCreatedEvent`
  - `rename(command)` → `DepartmentRenamedEvent`
  - `move(newParent)`：更新层级 → `DepartmentMovedEvent`
  - `assignManager(userId)` → `DepartmentManagerAssignedEvent`
  - `suspend()` / `activate()` / `archive()`：状态变更 → 对应事件
- 约束：循环依赖检查、最大层级限制、成员数量阈值等可在值对象或应用服务内实现。

#### 4.2 值对象

- `DepartmentName`、`DepartmentCode`
- `DepartmentPath`：存储路径如 `/root/sales/apac`，用于快速查询与权限计算
- `ManagerAssignment`（包含经理用户 ID、分配时间）

#### 4.3 事件

- `DepartmentCreatedEvent`
- `DepartmentRenamedEvent`
- `DepartmentMovedEvent`
- `DepartmentManagerAssignedEvent`
- `DepartmentSuspendedEvent`
- `DepartmentArchivedEvent`

### 5. 应用层设计（CQRS + ES）

#### 5.1 命令

| 子域 | 命令                             | 校验要点             | 触发事件                         |
| ---- | -------------------------------- | -------------------- | -------------------------------- |
| 组织 | `RegisterOrganizationCommand`    | 租户存在、名称唯一   | `OrganizationCreatedEvent`       |
| 组织 | `ActivateOrganizationCommand`    | 状态允许             | `OrganizationActivatedEvent`     |
| 组织 | `SuspendOrganizationCommand`     | 处理成员、部门权限   | `OrganizationSuspendedEvent`     |
| 组织 | `ArchiveOrganizationCommand`     | 校验部门归档情况     | `OrganizationArchivedEvent`      |
| 部门 | `CreateDepartmentCommand`        | 组织存在、父部门合法 | `DepartmentCreatedEvent`         |
| 部门 | `RenameDepartmentCommand`        | 名称唯一、状态允许   | `DepartmentRenamedEvent`         |
| 部门 | `MoveDepartmentCommand`          | 防止环、路径合法     | `DepartmentMovedEvent`           |
| 部门 | `AssignDepartmentManagerCommand` | 用户存在、权限合法   | `DepartmentManagerAssignedEvent` |
| 部门 | `ArchiveDepartmentCommand`       | 可选检查成员迁移     | `DepartmentArchivedEvent`        |

- 命令处理器继承 `CaslCommandHandler`；验证组织/部门状态，更新审计、软删除字段。
- 在 `MoveDepartmentCommand` 处理器中使用事务，确保部门树一致性（事件溯源 + 投影支持）。

#### 5.2 查询

- `GetOrganizationByIdQuery`、`ListOrganizationsQuery`
- `GetDepartmentByIdQuery`、`ListDepartmentsQuery`、`GetDepartmentTreeQuery`
- 查询处理器继承 `CaslQueryHandler`，结合 `CaslMikroORMFilter` 进行权限过滤。
- 读模型：
  - `OrganizationProjection`：组织基本信息、状态、默认设置
  - `DepartmentTreeProjection`：部门树结构，可使用 Mongo/JSONB 存储

### 6. 事件驱动与 Saga

#### 6.1 事件处理器

- `OrganizationLifecycleEventHandler`
  - 更新组织读模型，通知 IAM 刷新组织上下文
  - 组织归档时，触发部门归档指令（可使用 Saga）
- `DepartmentLifecycleEventHandler`
  - 更新部门读模型、部门树缓存
  - 部门启用/停用事件触发 IAM 更新权限能力

#### 6.2 Saga

- `OrganizationSetupSaga`
  - 组织创建后：自动创建根部门，初始化默认角色模板（可调用 IAM）
  - 组织归档：触发 `ArchiveDepartmentCommand` 遍历归档部门；失败时发布补偿事件
- `DepartmentMemberSyncSaga`（最小可用版可选）
  - 部门移动或经理变更后通知用户模块/权限模块同步成员列表

### 7. 基础设施与目录结构

```
org-structure/
├── src/
│   ├── domains/
│   │   ├── organization/
│   │   │   ├── aggregates/organization.aggregate.ts
│   │   │   ├── value-objects/organization-name.vo.ts
│   │   │   ├── events/organization-created.event.ts
│   │   │   └── repositories/organization.repository.ts
│   │   └── department/
│   │       ├── aggregates/department.aggregate.ts
│   │       ├── value-objects/department-name.vo.ts
│   │       ├── events/department-created.event.ts
│   │       └── repositories/department.repository.ts
│   ├── application/
│   │   ├── commands/organization/
│   │   ├── commands/department/
│   │   ├── queries/organization/
│   │   ├── queries/department/
│   │   └── sagas/
│   ├── infrastructure/
│   │   ├── repositories/
│   │   ├── event-store/
│   │   ├── projections/
│   │   └── dto/
│   └── interfaces/
│       ├── controllers/organization-command.controller.ts
│       ├── controllers/department-command.controller.ts
│       ├── controllers/organization-query.controller.ts
│       └── controllers/department-query.controller.ts
└── tests/
    ├── organization.aggregate.spec.ts
    ├── department.aggregate.spec.ts
    └── integration/
        ├── organization.command.integration.spec.ts
        └── department.query.integration.spec.ts
```

### 8. 与其他模块的集成

- 与租户模块：组织创建需验证租户存在且启用；组织归档需通知租户模块处理上下文。
- 与用户模块：部门经理/成员引用用户 ID；部门事件通知用户模块更新成员所属部门。
- 与 IAM 模块：
  - `OrganizationActivatedEvent`、`DepartmentCreatedEvent` 等触发 IAM 更新权限能力/可访问范围。
  - `GetOrganizationContextQuery`、`GetDepartmentTreeQuery` 为 IAM 提供组织上下文，用于权限判定。
- 多租户上下文：命令和查询需继承 `MultiTenantCommand` / `Query`，确保 `tenantId` 注入。

### 9. 最小可用功能集合

1. 组织注册与启用：创建组织聚合 → 初始化根部门 → 发布事件
2. 部门创建/重命名/移动：维护部门树、更新读模型、同步 IAM
3. 部门启用/停用/软删除：控制成员生效范围，通知 IAM
4. 查询接口：组织详情、组织列表、部门详情、部门树/列表、部门成员（可与用户模块联动）
5. 观测性：组织数量、部门数量、层级变化次数、Saga 成功率

### 10. 测试与质量要求

- 聚合测试：组织状态转移、部门树操作、软删除恢复
- 命令处理器测试：权限校验、审计更新、异常路径
- 集成测试：命令→事件→投影链路，模拟 IAM/用户模块订阅
- 契约测试：REST 接口 & 领域事件契约
- 覆盖率：聚合 ≥95%，命令/查询 ≥90%，事件处理器 ≥90%

### 11. 观测性与运维

- 指标：`organization_activation_total`、`department_move_total`、`department_tree_projection_lag`
- 日志：统一使用 `@hl8/logger`，记录命令执行、事件处理、Saga 补偿
- 告警：组织归档 Saga 超时、部门树投影异常、事件重试失败
- 审计：利用平台 `AuditService` 记录组织/部门变更；事件载荷携带审计信息

### 12. 后续扩展展望

- 复杂组织模型：矩阵组织、跨租户虚拟组织
- 部门成员同步：与用户模块深化集成（自动角色分配）
- 组织/部门权限模板：与 IAM 绑定，自动生成角色策略
- 工作流：组织/部门变更审批
- 外部系统同步：HR 系统数据集成

---

该最小化设计满足 IAM 对组织架构数据的核心依赖，并保证模块依据平台基线实现可演化的 DDD/CQRS/ES/EDA 架构。基于此结构可逐步拓展更复杂的组织管理功能。\*\*\*

## 最小化用户管理模块设计规范

> 关联基线：`docs/designs/platform-domain-baseline.md`、`docs/designs/platform-domain-design.md`、`docs/designs/platform-cqrs-es-eda-design.md`、`docs/designs/tenant-minimal-design.md`、`docs/designs/iam-guide.md`

### 1. 背景与目标
- 提供 IAM 依赖的最小用户管理能力：用户创建、绑定租户、启用/停用、软删除、基础资料与身份上下文对外输出。
- 模块必须符合 DDD + Clean Architecture + CQRS + Event Sourcing + 事件驱动架构（EDA），并遵循平台基线（统一 UUID、审计轨迹、软删除、CASL 权限）。
- 预留扩展空间，用于未来集成认证、组织、角色、外部身份同步等高级功能。

### 2. 架构概览
```
┌──────────────────────────────────────────────┐
│ Interface Layer                               │
│  - UserCommandController                      │
│  - UserQueryController                        │
└───────────────────────────┬───────────────────┘
                            │ 命令 / 查询
┌───────────────────────────▼───────────────────┐
│ Application Layer (CQRS + ES + EDA)           │
│  - Commands: CreateUser, ActivateUser         │
│             DeactivateUser, UpdateProfile     │
│             LinkUserToTenant, ArchiveUser     │
│  - Queries: GetUserById, ListUsers            │
│  - Sagas: UserLifecycleSaga                   │
└───────────────────────────┬───────────────────┘
                            │ 调用聚合/仓储
┌───────────────────────────▼───────────────────┐
│ Domain Layer (用户子域)                        │
│  - UserAggregate                               │
│  - UserProfile (实体)                          │
│  - 值对象：UserEmail、UserName、TenantBindings │
│  - 领域事件：UserCreatedEvent 等               │
└───────────────────────────┬───────────────────┘
                            │ 接口
┌───────────────────────────▼───────────────────┐
│ Infrastructure Layer                           │
│  - UserEventStore (ES)                         │
│  - UserRepository (MikroORM)                   │
│  - Projections (用户读模型)                     │
│  - 外部系统集成（消息队列、IAM 订阅）          │
└──────────────────────────────────────────────┘
```

### 3. 领域建模

#### 3.1 聚合根：`User`
- 字段：
  - `userId`（UUID v4）
  - `email`（值对象，校验格式、大小写一致性）
  - `displayName`（值对象，支持中英文别名）
  - `status`（值对象，`Pending`、`Active`、`Suspended`、`Archived`）
  - `tenantBindings`（集合值对象，记录用户已加入的租户及默认租户 ID）
  - `profile`（实体，含基本资料：手机号、职位、角色标签等）
  - `authenticationMeta`（值对象，可扩展认证方式，如手机号、外部 IdP）
  - `auditTrail`、`softDeleteStatus`、`version`
- 行为：
  - `register(initialData)`：创建用户 → `UserCreatedEvent`
  - `activate(initiator)`：状态转为 Active → `UserActivatedEvent`
  - `deactivate(initiator)`：状态转为 Suspended → `UserDeactivatedEvent`
  - `archive(initiator)`：软删除 → `UserArchivedEvent`
  - `updateProfile(command)`：更新 `UserProfile` → `UserProfileUpdatedEvent`
  - `linkToTenant(tenantId)` / `unlinkFromTenant(tenantId)` → 对应事件 `UserLinkedToTenantEvent`、`UserUnlinkedFromTenantEvent`
  - 所有行为更新审计信息并检查状态合法性；例如 Archived 用户不可重新激活，需明确恢复流程

#### 3.2 实体与值对象
- `UserProfile`（实体）：
  - 字段：`phoneNumber`、`title`、`tags`（可选）、`avatarUrl`
  - 支持审计字段（如 `profileUpdatedAt`、`profileUpdatedBy`）
- 值对象：
  - `UserEmail`、`UserName`
  - `TenantBinding`（记录租户 ID、角色/权限模板、加入时间）
  - `AuthenticationMeta`（登录名、外部认证 ID、密码哈希 —— 如需，可在 MVP 先保留结构）
  - `UserStatus`（不可变的状态封装）

#### 3.3 领域事件
- `UserCreatedEvent`
- `UserActivatedEvent`
- `UserDeactivatedEvent`
- `UserProfileUpdatedEvent`
- `UserLinkedToTenantEvent`
- `UserUnlinkedFromTenantEvent`
- `UserArchivedEvent`

事件载荷需包含租户上下文、身份信息、审计/软删除状态，以供 IAM 和其他模块订阅。

### 4. 应用层设计

#### 4.1 命令
| 命令 | 功能 | 校验要点 | 触发事件 |
|------|------|----------|----------|
| `RegisterUserCommand` | 创建用户，设置基础资料 | 邮箱唯一、租户存在、上下文完整 | `UserCreatedEvent` |
| `ActivateUserCommand` | 激活账户 | 状态允许、租户上下文有效 | `UserActivatedEvent` |
| `DeactivateUserCommand` | 停用账户 | 状态为 Active | `UserDeactivatedEvent` |
| `UpdateUserProfileCommand` | 更新资料（姓名、电话等） | 字段校验 | `UserProfileUpdatedEvent` |
| `LinkUserToTenantCommand` | 绑定租户 | 租户存在、用户未归档 | `UserLinkedToTenantEvent` |
| `UnlinkUserFromTenantCommand` | 移除租户绑定 | 保证至少存在一个默认租户 | `UserUnlinkedFromTenantEvent` |
| `ArchiveUserCommand` | 软删除 | 状态允许、触发业务补偿 | `UserArchivedEvent` |

- 命令处理器继承 `CaslCommandHandler`，调用 `validateCommandPermission`、`validateTenantStatus` 等基线方法。
- 针对 `RegisterUserCommand`，可在执行前进行邮箱唯一性查询（查询基线读模型或调用外部身份服务）。

#### 4.2 查询
- `GetUserByIdQuery`：返回用户读模型（基本资料 + 租户清单）
- `ListUsersQuery`：分页；支持按租户、状态、关键字过滤
- `GetUsersByTenantQuery`：特定租户的用户列表（供租户管理视图）
- `GetUserContextQuery`：返回 IAM 所需的用户上下文（默认角色、租户绑定、能力标识）

读模型使用 `UserProjection`，更新流程在事件处理器中实现，可使用 Mongo/MikroORM + Redis 缓存提升查询性能。

### 5. 事件驱动与集成

#### 5.1 事件处理器
- `UserLifecycleEventHandler`
  - 更新 `UserProjection`
  - 推送 `UserStateChanged` 通知（供前端、消息中心）
- `UserTenantBindingHandler`
  - 监听用户与租户绑定事件，更新租户读模型（便于快速查询某租户下用户）
  - 调用 IAM ability 服务刷新权限缓存

#### 5.2 Saga（最小可用）
- `UserLifecycleSaga`
  - 用户创建后：发送欢迎通知、初始化 IAM 能力（默认角色）
  - 用户停用：通知 IAM 禁用权限、通知租户管理员
  - 用户归档：触发数据脱敏或归档任务
  - Saga 失败时发布补偿事件（例如激活失败 -> rollback -> 通知管理员）

### 6. 目录结构（最小版本）
```
user/
├── src/
│   ├── domains/
│   │   └── user/
│   │       ├── aggregates/user.aggregate.ts
│   │       ├── entities/user-profile.entity.ts
│   │       ├── value-objects/
│   │       │   ├── user-email.vo.ts
│   │       │   ├── user-name.vo.ts
│   │       │   └── tenant-binding.vo.ts
│   │       ├── events/user-created.event.ts
│   │       ├── events/user-activated.event.ts
│   │       └── repositories/user.repository.ts
│   ├── application/
│   │   ├── commands/
│   │   │   ├── register-user.command.ts
│   │   │   └── activate-user.command.ts
│   │   ├── queries/
│   │   │   ├── get-user-by-id.query.ts
│   │   │   └── list-users.query.ts
│   │   └── sagas/user-lifecycle.saga.ts
│   ├── infrastructure/
│   │   ├── repositories/user.repository.impl.ts
│   │   ├── event-store/user-event-store.ts
│   │   ├── projections/user.projection.ts
│   │   └── dto/user-read-model.ts
│   └── interfaces/
│       ├── controllers/user-command.controller.ts
│       ├── controllers/user-query.controller.ts
│       └── dtos/
│           ├── register-user.request.dto.ts
│           └── user-response.dto.ts
└── tests/
    ├── user.aggregate.spec.ts
    ├── register-user.command.spec.ts
    └── user-projection.integration.spec.ts
```

### 7. 与 IAM、租户模块协作
- IAM 通过 `UserLinkedToTenantEvent`、`UserActivatedEvent` 更新能力缓存；通过查询接口获取用户上下文。
- 租户模块可订阅 `UserLinkedToTenantEvent`，更新租户-用户索引。
- 用户模块需要引入租户模块提供的 `TenantContextQuery`，确保绑定的租户存在且状态允许。
- 可选：在用户创建时自动创建默认组织成员关系（若组织模块存在）。

### 8. 最小功能列表 (MVP)
1. 用户注册（必填：邮箱、姓名、初始租户）→ 发布创建事件
2. 用户启用/停用 → 更新状态，通知 IAM
3. 用户软删除（归档）→ 更新软删除状态，隐藏读模型、通知外部系统
4. 用户租户绑定管理（绑定/解绑/查询）→ 保证至少一个默认租户
5. 查询接口：`GET /users/:id`、`GET /users?tenantId=`、`GET /users/:id/context`
6. 观测性：记录命令执行耗时、事件处理状态、活跃用户数量、停用用户数量等指标。

### 9. 测试与质量要求
- 单元测试：
  - 聚合根：状态转移、事件生成、租户绑定逻辑
  - 值对象：邮箱/姓名校验、TenantBinding 等
  - 命令处理器：CASL 权限校验、审计更新、异常分支
- 集成测试：
  - 命令→事件→投影链路；模拟 IAM 订阅验证事件载荷
- 契约测试：
  - REST API（OpenAPI）
  - 域事件契约（与 IAM、租户模块共享）
- 测试覆盖率：核心聚合 ≥95%，命令/查询 ≥90%，事件处理器 ≥90%

### 10. 可观测性与运维
- 指标示例：`user_activation_total`、`user_binding_changes_total`、`user_projection_lag_seconds`
- 日志：使用 `@hl8/logger`，记录命令执行成功/失败、Saga 补偿操作
- 告警：用户激活/停用事件重试失败、Saga 超时、读模型滞后
- 审计：使用平台 `AuditService` 记录用户变更、租户绑定操作；审计信息通过事件同步

### 11. 后续扩展方向
- 认证模块对接（密码、OAuth、SAML 等）
- 用户偏好设置、通知渠道管理
- 与组织/角色模块深度联动（自动分配角色、组织树同步）
- 用户导入/批量操作、数据脱敏
- 安全审计/登录日志/设备管理

---

该用户管理最小方案可与租户模块、IAM 模块协同工作，提供多租户环境下的基础身份上下文管理，并为后续扩展留有充分空间。实际实现时需结合平台领域/应用基线中的聚合基类、命令处理器、事件发布、审计与软删除规范。***


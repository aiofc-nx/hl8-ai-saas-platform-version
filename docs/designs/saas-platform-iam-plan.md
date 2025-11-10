# SaaS 平台 IAM 底座开发计划

## 1. 背景
- 基于 `docs/designs/iam-v2.md`、`docs/designs/casl-muti-tenant-auth-cqrs-es-eda.md`，IAM 被定位为 SaaS 平台的核心底座，与全仓宪章及 `docs/guides/*.md` 多租户规范保持一致。
- 目标是提供统一的身份认证、权限管理、审计追踪与上下文管理能力，支撑 HR、CRM 等业务模块的快速迭代。

## 2. 整体架构摘要
- **入口层**：API Gateway / Console SPA + OAuth2/OIDC/SAML 等协议适配器，接入 `iam-api`。
- **接口层**：REST/GraphQL 控制器继承 `MultiTenantController`，统一注入 `SecurityContext`、`TenantContext`。
- **应用层**：命令/查询总线（CQRS），处理器继承 `MultiTenantCommandHandler`/`MultiTenantQueryHandler`，贯穿租户 → 组织 → 部门三级上下文。
- **领域层**：`Tenant`、`Organization`、`UserAccount`、`UserAuthorization` 等聚合根继承多租户基类，事件溯源 + CASL 权限模型。
- **基础设施层**：CLS、`BaseTenantRepository`、`TenantAwareSubscriber`、Event Store、审计服务；事件驱动（EDA）负责刷能力缓存与读模型。

## 3. 子域与任务拆分
| 子域 | 关键任务 | 对应文档 / 参考 |
| --- | --- | --- |
| Tenant | 租户注册、订阅、状态管理、租户上下文注入 | `docs/designs/iam-v2.md` §3、§5.2 |
| Organization | 组织/部门结构、部门树、成员关联、跨层级权限 | 新增组织聚合 & 查询示例，参考 `docs/guides/domain-layer-guide.md` |
| Auth | 用户注册/登录、凭证管理、会话管理、协议适配（OAuth2/OIDC/SAML） | `UserAccountAggregate` 示例；`infrastructure/security` 配置 |
| Authorization | CASL 权限规则、角色/策略、事件溯源聚合、Ability 缓存更新 | `docs/designs/casl-muti-tenant-auth-cqrs-es-eda.md` §2-4 |
| Shared Kernel | 值对象、异常、时间模型、ID 模板（UUID v4） | `docs/guides/domain-layer-guide.md`、`MultiTenantAggregateRoot` |
| Infrastructure | CLS、`BaseTenantRepository`、Event Store、审计与日志 | `docs/guides/infrastructure-layer-guide.md`、`iam-v2` 架构 §2 |
| Interfaces | `MultiTenantController`、守卫、装配器、拦截器、异常过滤器 | `docs/guides/interface-layer-guide.md` |

## 4. 里程碑计划
### 阶段一：基础框架（2-3 周）
1. 落地 `MultiTenantCommand` / `MultiTenantQuery` 基类及处理器基类；同步更新命令/查询示例。
2. 构建 `UserAccountAggregate`、`UserAuthorization` 聚合，完成注册/角色分配基本流程。
3. 搭建 CLS 与基础设施骨架：`TenantContextModule`、`BaseTenantRepository`、Event Store、AuditService。
4. 完成 REST 控制器 + GraphQL Resolver 最小路径，贯通 `tenantId`/`organizationId`/`departmentIds`。

### 阶段二：认证协议与 CASL 集成（3-4 周）
1. 实现 OAuth2/OIDC/SAML 登录流程及守卫，输出 `SecurityContext`。
2. CASL 能力工厂、过滤器、守卫落地，覆盖租户/组织/部门三级上下文。
3. 事件驱动扩展：`RoleAssignedEventHandler`、`PermissionChangeSaga`，支持能力缓存刷新与读模型更新。

### 阶段三：组织与审计加强（3 周）
1. 组织/部门聚合及查询实现，完善跨层级权限继承示例。
2. 审计日志联通：关键事件写入 `AuditService`，与统一日志格式对齐。
3. 灰度/多活部署准备：日志、事件、仓储配置复核。

### 阶段四：测试与治理（2 周）
1. 编写单位测试、集成测试、端到端验证，确保三层隔离与权限一致性。
2. 运行 Constitution Check 对照 `docs/guides` 和宪章条款。
3. 输出上线准备清单，安排 IAM 底座与业务模块的集成验收。

## 5. 依赖与风险
- **依赖**：`libs/shared/security`、`libs/infra/multi-tenancy`、`@hl8/logger`、`docs/designs/casl-muti-tenant-auth-cqrs-es-eda.md`；团队需确保这些库的接口与命名保持一致。
- **风险**：
  - CASL 能力缓存与读模型同步延迟，需完善事件驱动补偿机制。
  - 多协议认证开发周期较长，建议采用阶段性 Mock / Feature Flag，先跑通核心路径。
  - 组织/部门三级隔离对命令/查询有额外负担，必须在处理器和仓储层做双重校验。

> 建议在每个里程碑结束后组织一次文档对齐与代码审阅，确保实现与 `iam-v2`、CASL 设计文档、`docs/guides` 完全同步。

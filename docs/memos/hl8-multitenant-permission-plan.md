---
title: "HL8 多租户与权限技术方案"
author: "hl8 架构与平台组"
date: "2025-11-10"
---

# 方案总览

本方案基于 Clean Architecture + CQRS + 事件溯源（ES）+ 事件驱动架构（EDA），结合 Node.js 20、TypeScript、pnpm Monorepo 与 NodeNext 模块规范，旨在为 hl8 平台提供企业级多租户隔离与权限治理能力。整体技术栈统一使用 `@hl8/config`、`@hl8/logger`、`libs/infra/exceptions` 与 `libs/infra/cache` 等基础设施模块，确保配置、日志、异常、缓存行为的一致性。

# 多租户设计

- **租户上下文链路**  
  - 类型标签：`类型：Middleware`、名称：`TenantExecutionMiddleware`  
  - 功能：在 HTTP 与消息入口解析 `X-Tenant-ID`、JWT 载荷或事件元信息，写入请求作用域的 `TenantExecutionContext`，并通过 AsyncLocalStorage 保持调用链一致性。
- **跨层传播机制**  
  - 类型标签：`类型：Service`、名称：`TenantContextProvider`  
  - 功能：为应用服务、领域服务、仓储提供统一的租户读取接口；在定时任务、命令行执行等场景支持显式设置租户上下文。
- **租户感知仓储**  
  - 类型标签：`类型：Repository`、名称：`TenantScopedRepository<T>`  
  - 实现：所有数据访问均继承该基类，自动注入 `tenantId` 过滤条件，写操作确保实体持久化时补齐租户字段；对事件溯源存储追加租户分区键，保障事件流隔离。
- **数据库级约束**  
  - 策略：对业务表增加 `(tenant_id, business_key)` 组合唯一索引与 CHECK 约束；事件存储与快照表按照租户维度分区或分表，防止热点冲突。  
  - 运维：通过迁移脚本在 schema 层校验租户字段完整性，配合审计报告定期检查孤立或跨租户数据。
- **租户生命周期管理**  
  - 类型标签：`类型：AggregateRoot`、名称：`TenantAggregate`  
  - 事件：`TenantRegisteredEvent`、`TenantActivatedEvent`、`TenantSuspendedEvent`、`TenantQuotaAdjustedEvent`。  
  - 流程：在领域层驱动租户状态变更，通过 EDA 广播到计费、通知、缓存刷新等下游模块；停用租户触发自动熔断逻辑。

# 权限与 CASL 策略

- **能力工厂**  
  - 类型标签：`类型：Factory`、名称：`CaslAbilityFactory`  
  - 数据来源：`RoleCapabilityRegistry`（配置化角色-能力映射）+ `TenantContextProvider`（租户信息）+ 用户所属组织/项目维度。  
  - 输出：基于 CASL 构建 `Ability` 实例，支持动作、字段、条件三级约束，并缓存至请求作用域。
- **策略声明与守卫**  
  - 类型标签：`类型：Decorator`、名称：`@CheckPolicies()`  
  - 类型标签：`类型：Guard`、名称：`PoliciesGuard`  
  - 控制器使用装饰器声明策略，守卫读取能力对象执行校验；失败时抛出 `PermissionDeniedException`（定义于 `libs/infra/exceptions`），并由 `@hl8/logger` 记录结构化日志。
- **角色治理**  
  - 类型标签：`类型：Service`、名称：`RoleCapabilityService`  
  - 功能：维护角色版本、发布/回滚记录，支持租户自定义子角色；通过事件驱动向前端与文档中心同步最新策略。  
  - 审计：所有策略变更写入事件溯源流，结合请求 ID 记录实现可追溯。
- **越权检测**  
  - 类型标签：`类型：Subscriber`、名称：`AuthorizationEventSubscriber`  
  - 功能：监听授权失败事件，统计维度包括租户、角色、操作，向监控平台暴露指标并触发告警。

# CQRS + ES 集成

- **命令处理**  
  - 类型标签：`类型：CommandHandler`、名称：`CreateTenantCommandHandler` 等  
  - 要求：所有命令处理需校验租户上下文合法性，写入领域事件后通过事件总线发布。  
  - 事务：利用事件溯源保证写模型的强一致性，结合租户分区提升并发性能。
- **查询模型**  
  - 类型标签：`类型：QueryHandler`、名称：`GetTenantOverviewQueryHandler` 等  
  - 实现：读模型数据库（或缓存）同样继承 `TenantScopedRepository`，对租户 ID 添加查询索引；配合缓存模块提供租户维度的短期缓存。  
  - 权限：查询处理前通过 `PoliciesGuard` 或在 Handler 内部再次校验 CASL 能力，避免读模型越权。
- **事件驱动**  
  - 类型标签：`类型：EventHandler`、名称：`TenantSuspendedEventHandler`  
  - 功能：协调账号冻结、任务停止、通知推送等跨领域动作；事件消息体中包含租户 ID，消费端启动时由 `TenantExecutionMiddleware` 自动注入上下文。

# 配置与部署策略

- **配置模型**  
  - 类型标签：`类型：Class`、名称：`TenantConfig`  
  - 使用 `@hl8/config` + `class-validator` 定义租户限额、功能开关、白名单策略；支持以租户为维度的动态刷新与实时生效。
- **环境隔离**  
  - 各环境（DEV/QA/PROD）维护独立租户样本数据，使用 Docker Compose 与基础设施脚本自动化部署；生产环境启用蓝绿发布，确保租户状态切换不影响在线服务。
- **监控与日志**  
  - 统一使用 `@hl8/logger` 输出带租户 ID 的结构化日志；结合 OpenTelemetry 建立租户级别的性能与错误指标，权限异常同时写入审计日志。

# 测试与保障

- **单元测试**：租户感知仓储、CASL 能力工厂、守卫装饰器均需提供单元测试，目标覆盖率 ≥80%。  
- **集成测试**：在 `tests/integration/tenant-permission.spec.ts` 中覆盖租户停用、角色降级、跨租户越权场景，确保关键路径覆盖率 ≥90%。  
- **安全测试**：定期执行越权扫描脚本，对所有公开 API 自动化注入不同租户 ID 校验隔离有效性。

# 推进计划建议

1. **短期（1-2 迭代）**：实现租户上下文中间件、仓储基类、CASL 能力工厂基础版，完成核心命令/查询 Handler 改造。  
2. **中期（3-4 迭代）**：引入角色注册中心、授权事件订阅、数据库约束迁移，以及权限/租户集成测试套件。  
3. **长期（5+ 迭代）**：完善审计报表、策略可视化与租户自定义扩展，构建运维告警与安全回归自动化体系。

通过上述方案，hl8 平台能够在现有架构基础上实现可扩展、可审计、可观测的多租户与权限治理能力，满足企业级 SaaS 场景的高标准要求。



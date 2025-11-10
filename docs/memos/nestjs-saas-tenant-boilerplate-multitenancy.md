---
title: "NestJS SaaS Tenant Boilerplate 多租户与权限调研"
author: "hl8 架构与平台组"
date: "2025-11-10"
---

# 背景

`forks/nestjs-saas-tenant-boilerplate` 是一个基于 NestJS 与 Mikro-ORM 的开源多租户脚手架，主要面向中小型 SaaS 的单数据库多租户场景。本文梳理其多租户实现、数据隔离策略、CASL 集成方式以及整体权限管理流程，便于与 hl8 平台体系对比评估。

# 多租户与数据隔离设计

- **租户标识载体**  
  - 类型标签：`类型：Middleware`、名称：`TenantContextMiddleware`  
  - 功能：在每个请求进入时从 `X-Tenant-ID` 请求头或 JWT 载荷读取租户标识，写入请求上下文（`TenantContext`）。
- **租户上下文传播**  
  - 类型标签：`类型：Service`、名称：`TenantProvider`  
  - 功能：封装获取当前租户信息的接口，使业务服务通过依赖注入访问租户 ID；在 CLI 或 Job 场景通过手动设置上下文维持一致性。
- **数据访问隔离**  
  - 类型标签：`类型：Repository`、名称：`TenantAwareRepository<T>`  
  - 实现：Mikro-ORM `QueryBuilder` 在构建查询时自动追加 `tenantId = 当前租户` 条件，并在实体持久化时写入租户字段。  
  - 附加措施：迁移脚本与种子数据均在租户上下文中执行，避免跨租户数据泄露。
- **租户生命周期管理**  
  - 类型标签：`类型：Service`、名称：`TenantService`  
  - 覆盖租户注册、激活、停用等状态流转；租户停用后请求中间件会在授权阶段直接拒绝访问。
- **安全性评估**  
  - 优点：架构简单、易于扩展；无需维护多数据库连接。  
  - 风险：依赖应用层约束，若绕过 `TenantAwareRepository` 编写原生查询，可能出现数据越权；缺乏数据库行级安全策略，需要在代码审查中重点关注。

# CASL 授权机制

- **能力工厂**  
  - 类型标签：`类型：Factory`、名称：`CaslAbilityFactory`  
  - 根据用户角色、所属租户、特定资源状态生成 CASL `Ability`，并以 NestJS `REQUEST` 作用域注入。
- **策略装饰器与守卫**  
  - 类型标签：`类型：Decorator`、名称：`@CheckPolicies()`  
  - 类型标签：`类型：Guard`、名称：`PoliciesGuard`  
  - 控制器通过装饰器声明访问策略，守卫从请求上下文读取 `Ability` 并校验指定动作（`Action`）与资源（`Subject`）。
- **授权表达力**  
  - 支持字段级与条件型权限控制（如 `can('update', 'Invoice', { tenantId: currentTenantId })`）。  
  - 结合租户上下文实现“租户内受限 + 全局管理员放通”的组合策略。
- **局限**  
  - 未提供细粒度审计或授权失败日志；CASL 模型定义分散在多个模块中，缺少统一文档化流程。

# 权限管理流程

1. **认证阶段**  
   - 类型标签：`类型：Guard`、名称：`JwtAuthGuard`  
   - 通过 Passport JWT 策略解析访问令牌，附带租户与角色标识。
2. **租户校验**  
   - 类型标签：`类型：Interceptor`、名称：`TenantValidationInterceptor`  
   - 验证租户状态是否可用，阻断已停用租户请求。
3. **角色到能力映射**  
   - 类型标签：`类型：Service`、名称：`RoleService`  
   - 维护角色（Owner、Admin、Member）与权限动作清单；与 CASL 能力工厂协同生成 `Ability`。
4. **动作授权**  
   - 控制器守卫执行 CASL 校验；对共享资源（如 `TenantSettings`）额外检查租户一致性。
5. **持久层约束**  
   - 所有仓储继承 `TenantAwareRepository`，在持久化与查询时再次校验租户条件，构成双重防线。

# 评估结论

- **优势**：链路清晰、开箱即用；CASL 与租户上下文结合良好，适合中级团队快速落地多租户原型。  
- **劣势**：依赖代码规范确保隔离，缺少数据库层强约束；权限模型文档化不足，难以直接满足企业级合规要求。  
- **建议**：若引入本项目，需要补充以下能力：  
  1. 增加租户字段数据库级唯一索引与检查约束。  
  2. 对关键仓储实现单元+集成测试，覆盖越权场景。  
  3. 建立权限策略注册表，统一管理角色与能力映射，方便审计。  
  4. 引入访问日志与授权失败日志，增强运维可观测性。



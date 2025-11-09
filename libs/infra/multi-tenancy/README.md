# 多租户基础设施模块

该模块聚焦跨领域的多租户上下文与数据隔离支撑能力，主要职责包括：

- 提供基于 `nestjs-cls` 的 `TenantContextModule`，为 API 请求建立 CLS 请求作用域；
- 统一封装 `TenantContextExecutor`，在命令/查询执行前校验 `tenantId` 并输出中文错误日志；
- 暴露 `TenantEnforceInterceptor` 及相关守卫，自动注入 MikroORM 过滤器并记录越权行为；
- 提供租户感知的仓储基类与订阅器，实现 `tenantId` 的自动拼接和实体写入保护；
- 作为平台级基础设施，供 `libs/modules/*` 及 `apps/*` 按需复用，避免在领域包内重复实现。

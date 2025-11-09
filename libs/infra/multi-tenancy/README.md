# 多租户基础设施模块

该模块聚焦跨领域的多租户上下文与数据隔离支撑能力，提供统一的租户上下文管理、请求拦截、数据持久化隔离与异常处理能力，作为 Clean Architecture 基础设施层的一部分，为领域服务和接口适配层提供一致的开发体验。

## 目录结构说明

```
libs/infra/multi-tenancy
├── README.md                       ← 当前文档
├── eslint.config.mjs               ← 继承平台 ESLint 规则
├── package.json                    ← 模块元信息与对外导出定义
├── src
│   ├── index.ts                    ← 导出公共 API
│   └── lib
│       ├── interceptors
│       │   └── tenant-enforce.interceptor.ts
│       ├── persistence
│       │   ├── base-tenant.repository.ts
│       │   └── tenant-aware.subscriber.ts
│       ├── tenant-cls-store.ts
│       ├── tenant-context.executor.ts
│       └── tenant-context.module.ts
└── tsconfig*.json                  ← TypeScript 构建配置
```

## 核心机制概述

### CLS 请求作用域

- 借助 `nestjs-cls` 在 Fastify/Nest 请求生命周期内创建基于 CLS（Continuation Local Storage）的上下文容器；
- `TenantContextModule` 在 `onModuleInit` 阶段初始化 CLS，注入来自 HTTP Header、消息队列或后台任务触发的 `tenantId`；
- 所有依赖该模块的服务通过注入 `TenantClsStore` 读取当前请求租户信息，避免手动传递上下文。

### 多租户执行器

- `TenantContextExecutor` 对外暴露 `runWithTenant` 与 `validateTenant` 等方法；
- 在执行 CQRS 命令、查询或后台任务前统一校验 `tenantId` 是否存在，若缺失则抛出中文业务异常并写入统一日志；
- 支持在同一线程内切换临时租户（如后台任务）并在执行完毕后自动恢复上下文，保证线程安全。

### 请求拦截与守卫

- `TenantEnforceInterceptor` 在请求进入控制器前拦截，自动解析 Header/Token 中的 `tenantId`；
- 将解析结果写入 CLS，同时对接 MikroORM 过滤器，确保 ORM 查询自动带上 `tenantId` 条件；
- 若检测到越权访问（请求内携带的租户与上下文不一致），则记录敏感日志并阻断请求链路。

### 数据持久化隔离

- `BaseTenantRepository` 封装 MikroORM 仓储常见操作，自动在 `findOne`, `findAll`, `persist` 等操作中注入 `tenantId` 条件；
- `TenantAwareSubscriber` 在实体创建与更新前检查 `tenantId` 字段，防止开发者遗漏设置导致数据串租；
- 通过事件订阅机制记录每次跨租户写入尝试，支撑后续审计与报警。

## 工作流程

1. **入口解析**：HTTP 请求、消息或任务调度进入时由拦截器读取租户标识；
2. **上下文建立**：`TenantContextModule` 将租户信息写入 CLS，后续依赖者可随时读取；
3. **租户校验**：业务用例通过 `TenantContextExecutor` 统一校验，缺失时直接抛出业务异常；
4. **数据访问**：仓储层基类与订阅器依据当前上下文自动拼接 `tenantId`；
5. **日志与监控**：所有异常路径输出中文日志，支持与 `libs/infra/logger` 对接做统一追踪。

## 集成指引

1. 在业务模块中引入 `libs/infra/multi-tenancy` 并导入 `TenantContextModule`；
2. 在路由层使用 `TenantEnforceInterceptor` 或自定义守卫，确保入口统一；
3. 领域仓储继承 `BaseTenantRepository`，减少手动维护过滤条件；
4. 在 CQRS handler、定时任务等位置通过 `TenantContextExecutor` 包裹执行逻辑；
5. 与 `libs/infra/logger`、`libs/infra/config` 配合，将租户信息写入日志与配置缓存。

## 注意事项

- 所有对外服务必须保证 `tenantId` 的来源可信且经过鉴权；
- 禁止使用全局静态变量保存租户信息，必须通过 CLS 获取；
- 当执行跨租户的后台任务时，务必在调用前显式设置/切换上下文，并在 finally 块中释放；
- 若结合事件驱动架构触发异步处理，需要将 `tenantId` 写入事件载荷并在消费者侧调用执行器恢复上下文。

## 后续规划

- 提供基于装饰器的 DTO 校验器，帮助自动校验请求中租户字段；
- 与 `libs/infra/cache` 集成租户级缓存隔离策略；
- 输出更多实践示例，覆盖命令总线、GraphQL、WebSocket 等场景。

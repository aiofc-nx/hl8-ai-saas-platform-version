# 多租户与数据隔离技术方案（草案）

## 1. 背景与目标

- **业务诉求**：平台需要在单实例下支持多租户接入，保障租户间数据绝对隔离，同时兼顾开发效率与可扩展性。
- **既有基础**：参考 `forks/nestjs-saas-tenant-boilerplate` 的实践，该项目通过 `nestjs-cls`、请求拦截器与 MikroORM 过滤器形成“上下文 → 过滤 → 写入”的闭环。
- **设计目标**：
  - 保证所有租户敏感实体的读写均自动携带租户条件，杜绝跨租户访问；
  - 提供统一的租户解析与校验入口，降低业务方重复实现成本；
  - 支持按需豁免租户过滤，并配套审计防止误用；
  - 兼容现有 Node.js + MikroORM 技术栈。

## 2. 总体架构

```
客户端请求 → 身份认证（解析租户） → CLS 请求上下文 → 租户拦截器写入过滤参数 → MikroORM 过滤器 + 仓储自动附加 tenantId → Subscriber 自动填充 tenantId → 数据库
```

- **单库隔离策略**：共用数据库与 schema，通过逻辑租户字段 `tenant_id` 建立隔离；涉及租户的实体统一继承 `BaseTenantEntity` 并加入索引。
- **核心组件**：
  - `TenantContextModule`：封装 `nestjs-cls`，暴露 `TenantClsService`；
  - `TenantResolutionService`：根据 JWT、子域名或 Header 解析当前租户，并校验用户归属；
  - `TenantEnforceInterceptor`：拦截请求，注入租户过滤器；
  - `TenantAwareSubscriber`：在实体 `beforeInsert` 阶段写入租户；
  - `BaseTenantRepository`：所有租户实体的 MikroORM 仓储基类，自动拼装 `tenant_id` 条件；
  - `@SkipTenant()`：显式跳过过滤的装饰器，仅允许在白名单内使用。

### 2.1 DDD + Clean Architecture + CQRS + ES 的架构适配

- **层次分工**：
  - **Domain Layer**：保持纯净，聚合根与领域服务不直接依赖 MikroORM。租户上下文以值对象（如 `TenantId`、`TenantContext`）作为命令参数显式传入，禁止在领域层直接访问 CLS。
  - **Application Layer（Command / Query Handler）**：命令侧 Handler 从 `TenantClsService` 读取租户上下文，将 `TenantId` 注入领域命令与服务，并负责协调事务边界、事件发布与补偿逻辑；查询侧 Handler 使用只读仓储构建租户隔离的读模型响应。
  - **Infrastructure Layer**：提供 `TenantAwareRepository`、`TenantAwareReadRepository`、`TenantAwareEventStore` 等实现，内部统一调用 `BaseTenantRepository` 与 MikroORM Filter，集中处理租户一致性与审计。
- **事件溯源与 CQRS 集成**：
  - 事件存储表主键采用 `{tenant_id, aggregate_id, version}` 复合索引，写入事件前校验 CLS 中的租户与聚合所属租户一致。
  - 快照、补偿日志等附属表同样携带 `tenant_id`，在重建聚合或回放事件前再校验一次租户，避免跨租户恢复。
  - 投影器处理事件时从事件元数据读取 `tenant_id`，并在执行前创建新的 CLS 上下文写入租户信息，确保异步任务隔离；读模型存储表均增加 `tenant_id` 索引。
- **依赖倒置与上下文穿透防护**：
  - 仓储接口、领域服务接口定义于 Domain Layer；Infrastructure 通过依赖注入提供实现，便于未来支持多数据库或分库分表。
  - 应用层提供 `TenantContextExecutor`（或装饰器）统一校验命令携带的 `TenantId` 与 CLS 中租户一致，防止上下文穿透。
- **跨界限协作**：
  - Saga / Process Manager 在调度跨界限任务时显式携带 `TenantId`，由被调度方应用服务使用 `TenantContextExecutor` 建立新的 CLS 环境。
  - CQRS 查询端（读模型）使用与命令端一致的 `BaseTenantRepository` 封装，保证查询与写模型在租户过滤策略上的一致性。

## 3. 请求上下文与租户解析

### 3.1 CLS 请求上下文

- 全局注册 `ClsModule.forRoot({ middleware: { mount: true } })`，保证每个 HTTP 请求拥有独立的异步上下文。
- 自定义 `TenantClsStore` 接口：
  ```ts
  export interface TenantClsStore {
    tenantId?: string;
    tenant?: TenantSnapshot;
    userId?: string;
  }
  ```
- 所有需要读取当前租户的服务通过依赖注入 `ClsService<TenantClsStore>` 获取上下文，避免显式参数传递。

### 3.2 租户解析链路

1. `JwtStrategy.validate()` 在发放身份时预加载用户与租户信息，设置 `cls.set('tenantId', user.tenant.id)`。
2. 设计 `AbstractTenantResolutionService`，支持多种解析策略：
   - `HeaderTenantResolutionService`：从自定义 Header 读取租户标识；
   - `DomainTenantResolutionService`：从请求域名解析租户；
   - `JwtPayloadTenantResolutionService`：从 JWT payload 直接获取租户 ID。
3. 在 `AuthGuard` 中调用 `TenantResolutionService.resolve()` 获取租户，并执行 `verifyUserBelongToTenant()`，保证用户不可跨租户访问。
4. 未登录场景可选支持“公共租户”模式，但需显式在路由上标注 `@Public()` 并限制访问的数据集合。

## 4. 数据访问隔离策略

### 4.1 实体规范

- 新增基类 `BaseTenantEntity`，统一提供 `tenantId` 字段（带唯一索引），并在实体层加入装饰器：

  ```ts
  @Entity()
  export abstract class BaseTenantEntity extends BaseTrackedEntity {
    @Property({ fieldName: "tenant_id", type: "uuid", index: true })
    tenantId!: string;

    @ManyToOne(() => Tenant)
    tenant!: Tenant;
  }
  ```

- 通过集中配置 `tenant.entities.ts`，列出所有需要隔离的实体，便于做一致性校验。

### 4.2 仓储层自动过滤

- 以 MikroORM `EntityRepository` 为基类封装 `BaseTenantRepository<T>`，统一重写 `find*`, `nativeUpdate`, `nativeDelete`, `qb()` 等方法，在进入 ORM 前合并 `{ tenant: ctxTenant }` 条件。
- 核心要点：
  - 所有仓储操作通过私有方法 `assertTenantContext()` 从 CLS 读取租户 ID，缺失时抛出 `TenantContextMissingException`；
  - 禁止调用方传入与上下文不一致的 `tenant`/`tenantId`：若检测到覆盖企图，记录安全日志并抛出 `TenantMismatchException`；
  - 为 QueryBuilder 提供包装器 `tenantScopedQB()`，自动注入 `where { tenant = :tenantId }`，杜绝手动拼接遗漏。

### 4.3 ORM 过滤器（可选增强）

- 启用 MikroORM 原生 filter 机制，注册全局 `tenant` 过滤器，在 `TenantEnforceInterceptor` 中调用 `em.addFilter('tenant', ...)` 并设置参数。
- 内置 `TenantEntityRegistry` 在应用启动时将所有 `BaseTenantEntity` 自动注册到 filter，若存在未注册的实体立即阻断启动。
- 对运行期的原生 SQL 统一走 `TenantAwareQueryService`，要求显式传入 `tenantId` 并校验与上下文一致。

### 4.4 EntitySubscriber 自动填充

- 自定义 `TenantAwareSubscriber`（MikroORM `EventSubscriber`），在 `beforeCreate` 钩子中：
  1. 根据 `TenantEntityRegistry` 判断实体是否租户敏感；
  2. 调用 `assertTenantContext()`，若 CLS 中没有租户信息，记录错误并抛出异常，禁止写入；
  3. 强制覆盖 `entity.tenant` 与 `entity.tenantId`，忽略调用方传入的值；
  4. 记录审计日志，包含请求 ID、用户 ID 与实体类型。
- 在 `beforeUpdate` 钩子中校验 `entity.tenant` 是否发生变化，若检测到租户字段被修改则阻断操作并上报安全告警。

## 5. 接口层拦截与豁免机制

- 在 `TenantModule` 中注册全局 `APP_INTERCEPTOR`：
  - 拦截器从 `request.user` 获取租户信息，若缺失则返回 401 并提示需认证，避免出现 500；
  - 调用 `entityManager.addFilter('tenant', ...)` 或仓储层封装 API 设置过滤条件；
  - 通过 `TenantContextGuard` 复核 CLS 的租户信息，并在日志中记录 filter 参数。
- 提供 `@SkipTenant()` 装饰器与白名单配置，限制以下场景：
  - 系统级运维接口（必须开启审计与告警）；
  - 数据迁移、导出任务（通过 CLI 工具运行时显式传入租户）。
- `@SkipTenant()` 使用需通过守卫校验调用者是否拥有“跨租户操作”权限，并写入审计追踪。
- 拦截器内部必须记录调用栈及请求信息，方便后续核查跳过过滤的原因。

## 6. 配套治理与测试

- **配置校验**：`TenantEntityRegistry` 启动时扫描 MikroORM metadata 与 `tenant.entities.ts`，若发现遗漏或重复即抛错并阻止应用启动，同时提供 CLI 检查任务供 CI 使用。
- **安全测试**：
  - 单元测试覆盖仓储层的租户过滤和写入覆盖场景；
  - 集成测试模拟跨租户访问、无租户上下文、`@SkipTenant()` 场景；
  - 压测验证在高并发下 CLS 上下文隔离是否稳定。
- **日志与审计**：
  - 所有跨租户尝试、过滤豁免、租户缺失情况需记录在专用日志中；
  - 结合 APM/告警系统监控 `TenantContextMissing`、`TenantMismatch` 等异常指标。

## 7. 落地步骤与里程碑

1. **基础设施搭建**：集成 `nestjs-cls`、实现 `TenantClsService` 与租户解析服务。
2. **数据层改造**：重构现有实体继承 `BaseTenantEntity`，迁移数据库 schema（增加索引、外键）。
3. **仓储与订阅器**：研发基于 MikroORM 的 `BaseTenantRepository`、`TenantAwareSubscriber` 并替换现有仓储。
4. **接口层接入**：注册 `TenantEnforceInterceptor`，为敏感接口添加 `@SkipTenant()` 白名单审查。
5. **自检与测试**：补充自动化测试、健康检查、日志监控。
6. **灰度与推广**：选择单租户客户试运行 → 观察指标 → 按业务域逐步迁移。

## 8. 风险与缓解

- **CLS 上下文丢失**：在后台任务、消息消费时需显式创建 CLS 上下文；提供工具方法 `runWithTenantContext(tenantId, handler)`。
- **缓存穿透**：所有基于缓存的读操作必须将 `tenantId` 作为 key 组成部分，防止跨租户命中。
- **数据迁移复杂度**：现有历史数据需要补齐 `tenant_id`，应编写迁移脚本并做好回滚预案。
- **性能开销**：租户过滤增加 SQL 条件，需对热点表加组合索引（如 `tenant_id + updated_at`）。

---

> 本方案基于 `forks/nestjs-saas-tenant-boilerplate` 的 CLS + 拦截器 + 订阅器设计理念，结合本项目的 MikroORM 技术栈给出了落地实现路径。后续阶段将根据 PoC 反馈迭代细节，并编制实施计划与验收指标。

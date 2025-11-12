# @hl8/cache

## 功能概述

- 提供 Redis 客户端与 Redlock 模块的统一引导，遵循 `@hl8/config`、`@hl8/logger` 与 `@hl8/exceptions` 的运行规范。
- 定义标准化的缓存键生成器、命中率监控钩子以及缓存读服务，默认采用 JSON 序列化策略。
- 暴露命名空间策略注册表与查询服务，支持按业务域维护键前缀、TTL 与失效策略。
- 内置写路径一致性服务（写前删除 + 写后延迟双删 + 可选失效通知）、锁竞争告警以及缓存预热通知 API。
- 通过常量导出缓存默认分隔符、租户配置域名与默认 TTL，避免多处硬编码。

## 快速上手

```ts
import { Module } from "@nestjs/common";
import { CacheInfrastructureModule } from "@hl8/cache";

@Module({
  imports: [CacheInfrastructureModule],
})
export class TenantConfigModule {}
```

在业务服务中可直接注入 `CacheReadService` 与对应的键生成器，默认会以 JSON 序列化缓存数据，并记录命中、回源与失败指标。引入 `CacheConsistencyService` 后，可在写操作结束时主动触发失效流程。

## 缓存读写与序列化策略

- `CacheReadService.getOrLoad` 默认使用 `serializeToJson` 与 `deserializeFromJson` 序列化函数（也可从 `@hl8/cache` 导入自定义复用）。
- 通过 `CacheReadOptions` 的 `serialize` / `deserialize` 选项即可覆盖默认策略，实现如 `msgpack`、`protobuf` 等定制格式。
- 发生反序列化错误时会触发 `CacheMetricsHook.recordFailure` 并抛出 `GeneralInternalServerException`，便于统一治理。

示例：

```ts
await this.cacheReadService.getOrLoad<UserProfile>({
  domain: "user-profile",
  key,
  loader: () => this.profileRepository.load(userId),
  serialize: (value) => msgpack.encode(value).toString("base64"),
  deserialize: (payload) => msgpack.decode(Buffer.from(payload, "base64")) as UserProfile,
});
```

## 命名空间配置与常量

- `CacheNamespacePolicyConfig` 用于定义域名、键前缀、默认 TTL 与失效策略，默认键分隔符由 `DEFAULT_CACHE_KEY_SEPARATOR` 提供。
- `CacheNamespaceRegistry` 会根据配置生成快照并支持热更新通知，`CacheNamespaceService` 则提供对外查询视图。
- 常用常量：
  - `DEFAULT_CACHE_KEY_SEPARATOR`：缓存键分隔符（默认为 `:`）。
  - `TENANT_CONFIG_CACHE_DOMAIN`：租户配置缓存域标识。
  - `TENANT_CONFIG_CACHE_TTL_SECONDS`：租户配置缓存默认 TTL（秒）。

命名空间策略示例：

```ts
const config = new CacheConfig();
const tenantPolicy = new CacheNamespacePolicyConfig();
tenantPolicy.domain = TENANT_CONFIG_CACHE_DOMAIN;
tenantPolicy.keyPrefix = "tc";
tenantPolicy.defaultTTL = TENANT_CONFIG_CACHE_TTL_SECONDS;
tenantPolicy.evictionPolicy = CacheEvictionPolicy.DoubleDelete;

config.namespacePolicies = [tenantPolicy];
```

## 测试与契约

- `tests/` 目录包含 OpenAPI 契约测试（依赖 `tests/jest.config.ts` 与 `tsconfig.contract.json`），验证 `/internal/cache/namespaces`、`/internal/cache/invalidations` 与 `/internal/cache/prefetch` 的接口契约。
- Fastify 集成测试位于 `apps/fastify-api/test/integration/cache/`，覆盖命名空间查询、租户配置缓存读路径，以及写路径失效/锁竞争/预热通知场景。

## 写路径一致性与通知

- `CacheConsistencyService.invalidate`：执行写前删除 + 写后延迟双删，支持自定义延迟、锁租期与通知开关。
- 锁竞争时抛出 `OptimisticLockException`，并通过 `CacheNotificationService.publishLockContention` 推送告警。
- `CacheNotificationService` 默认通过日志输出事件，可在项目内替换为消息总线或 Pub/Sub 推送。
- `CacheConsistencyController` 暴露：
  - `POST /internal/cache/invalidations`：接收 `InvalidateCacheDto`，返回请求 ID 与计划执行时间。
  - `POST /internal/cache/prefetch`：接收 `PrefetchRequestDto`，触发预热通知并返回刷新统计。

业务层可在写操作结束后调用失效接口，或直接注入 `CacheConsistencyService` 在本地触发，满足多端一致性需求。

# @hl8/cache 使用指南（培训稿）

> 目的：帮助项目成员快速理解缓存基础设施的能力、配置方法与调试流程，适合作为入职/培训讲义。

---

## 1. 模块定位与整体架构

```mermaid
flowchart LR
  A[业务模块] -->|读| B(CacheReadService)
  A -->|写后触发| C(CacheConsistencyService)
  B --> D[CacheClientProvider]
  C --> D
  D -->|Redis 客户端| E[@liaoliaots/nestjs-redis]
  C --> F[CacheNotificationService]
  F -->|失效通知/预热/告警| G[消息通道/日志]
  B --> H[CacheMetricsHook]
  H --> I[监控平台]
```

- 底层 Redis 客户端由 `@liaoliaots/nestjs-redis` 提供，我们只做封装和扩展，不重复造轮子。
- “读路径”和“写路径一致性”拆分：读侧强调命中率、序列化与监控；写侧强调延迟双删、锁竞争处理与事件通知。
- 所有配置统一通过 `@hl8/config` 校验，日志统一走 `@hl8/logger`，异常统一使用 `@hl8/exceptions`。

---

## 2. 核心模块速览

| 模块/服务                        | 作用简述                                                                                        |
| -------------------------------- | ----------------------------------------------------------------------------------------------- |
| `CacheInfrastructureModule`      | 打包导出所有缓存能力。业务模块只需 `imports: [CacheInfrastructureModule]` 即可获得依赖。        |
| `CacheClientProvider`            | 管理 Redis 客户端的获取逻辑，支持默认客户端、命名空间映射，以及测试环境的内存 fallback。        |
| `CacheReadService`               | 提供 `getOrLoad` 方法，统一缓存命中/回源流程，默认序列化策略为 JSON。                           |
| `CacheNamespaceRegistry/Service` | 维护命名空间策略快照，提供列表视图并支持热更新监听。                                            |
| `CacheConsistencyService`        | 写路径一致性核心，执行写前删除 + 写后延迟双删，支持锁竞争处理与通知触发。                       |
| `CacheNotificationService`       | 默认将失效/预热事件写入日志，可在项目中替换为 MQ、Pub/Sub、Webhook 等通道。                     |
| `CacheMetricsHook`               | 记录命中、miss、调用耗时、锁等待等指标，便于接入监控。                                          |
| `CacheConsistencyController`     | 提供 `/internal/cache/invalidations` 与 `/internal/cache/prefetch` API，便于远程触发失效/预热。 |
| DTO (`InvalidateCacheDto` 等)    | 使用 `class-validator` 校验业务请求，确保符合规范，错误信息均为中文。                           |

---

## 3. 配置与初始化

### 3.1 Redis 客户端配置

1. 在配置中心定义 `CacheConfig`，示例：

```ts
import { CacheConfig, CacheNamespacePolicyConfig, CacheEvictionPolicy } from "@hl8/cache";

const config = new CacheConfig();
config.defaultClientKey = "default";

// Redis 客户端（默认复用 @liaoliaots/nestjs-redis 的配置结构）
config.clients = [
  {
    clientKey: "default",
    namespace: "tenant-config",
    url: process.env.REDIS_URL!,
  },
];

// 命名空间策略
const tenantPolicy = new CacheNamespacePolicyConfig();
tenantPolicy.domain = "tenant-config";
tenantPolicy.keyPrefix = "tc";
tenantPolicy.keySuffix = null;
tenantPolicy.defaultTTL = 300;
tenantPolicy.evictionPolicy = CacheEvictionPolicy.DoubleDelete;

config.namespacePolicies = [tenantPolicy];
```

2. 将 `CacheInfrastructureModule` 引入业务模块。

```ts
@Module({
  imports: [CacheInfrastructureModule],
})
export class TenantConfigModule {}
```

3. 通过依赖注入获取服务：

```ts
@Injectable()
export class TenantConfigService {
  constructor(
    private readonly cacheReadService: CacheReadService,
    private readonly cacheConsistencyService: CacheConsistencyService,
    private readonly tenantKeyBuilder: TenantConfigKeyBuilder,
  ) {}
}
```

### 3.2 写路径控制器（可选）

如果需要远程触发缓存失效或预热，可在应用层导入 `CacheConsistencyController` 所在模块：

```ts
@Module({
  imports: [CacheInfrastructureModule],
  controllers: [CacheConsistencyController],
})
export class CacheAdminModule {}
```

---

## 4. 读路径使用示例

```ts
const cacheKey = this.tenantKeyBuilder.build({ tenantId, configType: "feature" });

const config = await this.cacheReadService.getOrLoad<TenantConfig>({
  domain: "tenant-config",
  key: cacheKey,
  ttlSeconds: 300,
  loader: () => this.repository.fetchTenantConfig(tenantId),
  serialize: serializeToJson,
  deserialize: deserializeFromJson,
});
```

- `loader`：回源函数，只有缓存 miss 或过期才调用。
- `ttlSeconds`：可覆盖命名空间默认 TTL。
- `serialize/deserialize`：可自定义序列化策略。
- 内部会调用 `CacheMetricsHook` 记录命中/耗时，异常会封装为 `GeneralInternalServerException`。

---

## 5. 写路径一致性流程

### 5.1 主要步骤

1. **写前删除**：预先删除缓存，降低旧值读取概率。
2. **写后延迟双删**：写完数据后等待一小段时间（默认 100ms）再删一次，处理数据库事务延迟。
3. **锁竞争防护**：利用 Redlock 获取分布式锁，锁竞争时抛出 `OptimisticLockException` 并触发告警。
4. **事件通知**：成功完成后可以通知其他服务刷新本地缓存或进行预热。

### 5.2 代码调用

```ts
await this.cacheConsistencyService.invalidate({
  domain: "tenant-config",
  tenantId,
  keys: [cacheKey],
  reason: "租户配置更新",
  delayMs: 150,
  notify: true,
});
```

- `notify` 默认 `true`，若只想在本地执行双删，可显式传 `false`。
- `lockDurationMs` 可根据写操作耗时进行调整（默认 1000ms）。

### 5.3 通过 HTTP API 调用

```bash
# 触发失效
curl -X POST /internal/cache/invalidations \
  -H "Content-Type: application/json" \
  -d '{"domain":"tenant-config","tenantId":"t-1","keys":["tenant-config:t-1:feature"],"reason":"配置发布"}'

# 触发预热
curl -X POST /internal/cache/prefetch \
  -H "Content-Type: application/json" \
  -d '{"domain":"tenant-config","tenantId":"t-1","keys":["tenant-config:t-1:feature"],"bypassLock":false}'
```

返回结果：

- 失效接口：`{ "requestId": "...", "scheduledAt": "ISO 时间戳" }`
- 预热接口：`{ "refreshed": number, "failures": [] }`

---

## 6. 通知与告警钩子

- `CacheNotificationService.publishInvalidation`：默认写日志，可接入 MQ/事件总线。
- `publishLockContention`：锁竞争时触发；建议接入告警系统以监控频繁冲突。
- `publishPrefetchRequested`：预热事件，可用于通知下游服务及时刷新。

如需替换实现，在业务模块中通过 Nest 的 provider override 注入自定义通知服务即可。

---

## 7. 测试与调试建议

| 测试类型    | 说明                                                     | 命令                                                    |
| ----------- | -------------------------------------------------------- | ------------------------------------------------------- |
| 单元测试    | `CacheReadService`、`CacheConsistencyService` 等核心逻辑 | `pnpm --filter @hl8/cache test`                         |
| 集成测试    | Fastify 模块覆盖失效 API、锁竞争、预热                   | `pnpm --filter nest-typescript-starter test -- cache-*` |
| 契约测试    | 验证 OpenAPI 契约是否与实现一致                          | `pnpm exec jest --config tests/jest.config.ts`          |
| Lint & 格式 | 保证 TSDoc、中文注释与规范一致                           | `pnpm run lint`                                         |

调试技巧：

- 使用 `CacheNotificationService` 的日志输出确认通知是否触发。
- 在本地可通过 fallback Redis 客户端（Map 存储）验证逻辑，而无需真实 Redis。
- 通过 `CacheMetricsHook` 记录的指标可以接入监控仪表盘，观察命中率和锁等待。

---

## 8. 常见问题 FAQ

1. **本地没有配置 Redis，如何运行？**
   - `CacheClientProvider` 会使用内存 Map 作为 fallback，适合单元测试或 demo。
   - 在需要完全跳过 Redis 连接时，可设置环境变量 `CACHE_REDIS_USE_MEMORY=true`（或 `CACHE_USE_MEMORY_FALLBACK=true`），应用会在启动阶段自动启用内存占位。
   - 若需要模拟延迟/错误，可继承该逻辑手动注入自定义客户端。

2. **锁竞争频繁怎么办？**
   - 检查是否有并发写同一租户，同步优化写操作耗时。
   - 可适当缩短 `delayMs` 或增加 `lockDurationMs`，同时关注 `publishLockContention` 告警。

3. **如何切换通知通道？**
   - 在业务模块中提供自定义的 `CacheNotificationService` Provider，替换默认实现即可，例如推送到 Kafka、NATS、Webhook 等。

4. **为什么要延迟双删？**
   - 解决数据库提交延迟导致旧值回写的问题，尤其在主从延迟或多实例同步场景中非常有效。

---

## 9. 后续扩展方向

- 引入消息总线后的通知回调 demo。
- 将 `CacheMetricsHook` 的数据对接到 Prometheus/Grafana。
- 为预热接口增加批量流水线执行、命中率回溯等高级能力。
- 与业务领域服务结合，形成缓存治理仪表盘。

---

通过本指南，你可以快速搭建缓存读写链路，并在写操作后可靠地失效与预热缓存，满足多租户、高并发场景下的数据一致性要求。如遇问题，可参考 FAQ 或直接查看 `libs/infra/cache/src` 中的源码与测试案例。祝开发顺利！

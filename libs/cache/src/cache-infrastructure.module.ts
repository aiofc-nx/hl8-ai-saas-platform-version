import { Module } from "@nestjs/common";
import { CacheClientProvider } from "./services/cache-client.provider.js";
import { CacheMetricsHook } from "./monitoring/cache-metrics.hook.js";
import { CacheReadService } from "./services/cache-read.service.js";
import { TenantConfigKeyBuilder } from "./keys/tenant-config-key.builder.js";
import { CacheNamespaceRegistry } from "./config/cache-namespace.registry.js";
import { CacheNamespaceService } from "./services/cache-namespace.service.js";
import { CacheConsistencyService } from "./services/cache-consistency.service.js";
import { CacheNotificationService } from "./services/cache-notification.service.js";

/**
 * @description 缓存基础设施模块，聚合 Redis 客户端与分布式锁能力，同时暴露缓存一致性相关服务。
 */
@Module({
  imports: [],
  providers: [
    CacheClientProvider,
    CacheMetricsHook,
    CacheReadService,
    TenantConfigKeyBuilder,
    CacheNamespaceRegistry,
    CacheNamespaceService,
    CacheConsistencyService,
    CacheNotificationService,
  ],
  exports: [
    CacheClientProvider,
    CacheMetricsHook,
    CacheReadService,
    TenantConfigKeyBuilder,
    CacheNamespaceRegistry,
    CacheNamespaceService,
    CacheConsistencyService,
    CacheNotificationService,
  ],
})
export class CacheInfrastructureModule {}

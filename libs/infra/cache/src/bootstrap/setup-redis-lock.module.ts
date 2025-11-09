import { DynamicModule } from "@nestjs/common";
import { RedlockModule } from "../internal/redlock-loader.js";
import { REDIS_CLIENTS } from "@liaoliaots/nestjs-redis/dist/redis/redis.constants.js";
import type { RedisClients } from "@liaoliaots/nestjs-redis/dist/redis/interfaces/index.js";
import {
  GeneralInternalServerException,
  MissingConfigurationForFeatureException,
} from "@hl8/exceptions";
import { RedisLockConfig } from "../config/redis-lock.config.js";
import { CacheConfig } from "../config/cache.config.js";

/**
 * @description 注册 Redlock 模块，基于现有 Redis 客户端构建分布式锁能力。
 * @returns Redlock 动态模块，供缓存基础设施模块导入
 * @throws MissingConfigurationForFeatureException 当未检测到任何 Redis 客户端时抛出
 * @throws GeneralInternalServerException 当模块注册或配置加载失败时抛出
 */
export function setupRedisLockModule(): DynamicModule {
  try {
    return RedlockModule.registerAsync({
      inject: [REDIS_CLIENTS, CacheConfig],
      useFactory: (clients: RedisClients, cacheConfig: CacheConfig) => {
        const redisClients = [...clients.values()];
        if (redisClients.length === 0) {
          throw new MissingConfigurationForFeatureException(
            "缓存客户端",
            "cache.clients",
            "未检测到任何 Redis 客户端，无法初始化分布式锁",
          );
        }

        const lockConfig = cacheConfig.lock ?? new RedisLockConfig();

        return {
          clients: redisClients,
          settings: {
            driftFactor: lockConfig.driftFactor,
            retryCount: lockConfig.retryCount,
            retryDelay: lockConfig.retryDelay,
            retryJitter: lockConfig.retryJitter,
            automaticExtensionThreshold: lockConfig.automaticExtensionThreshold,
          },
          duration: lockConfig.defaultDecoratorLockDuration,
        };
      },
    });
  } catch (error) {
    throw new GeneralInternalServerException(
      "分布式锁初始化失败，请联系运维人员",
      undefined,
      error,
    );
  }
}

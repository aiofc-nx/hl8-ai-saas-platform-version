import { DynamicModule } from "@nestjs/common";
import { RedisModule, type RedisModuleOptions } from "@liaoliaots/nestjs-redis";
import {
  GeneralInternalServerException,
  MissingConfigurationForFeatureException,
} from "@hl8/exceptions";
import { CacheConfig } from "../config/cache.config.js";

/**
 * @description 注册 Redis 客户端动态模块，统一注入缓存配置与异常处理。
 * @returns Redis 动态模块，自动加载缓存客户端配置
 * @throws MissingConfigurationForFeatureException 当未配置任何缓存客户端时抛出
 * @throws GeneralInternalServerException 当注册流程发生未知异常时抛出
 */
export function setupRedisModule(): DynamicModule {
  try {
    return RedisModule.forRootAsync(
      {
        inject: [CacheConfig],
        useFactory: async (
          cacheConfig: CacheConfig,
        ): Promise<RedisModuleOptions> => {
          if (!cacheConfig.clients || cacheConfig.clients.length === 0) {
            throw new MissingConfigurationForFeatureException(
              "缓存客户端",
              "cache.clients",
              "未配置任何缓存客户端，无法初始化 Redis 模块",
            );
          }

          return {
            readyLog: cacheConfig.readyLog,
            errorLog: cacheConfig.errorLog,
            commonOptions: cacheConfig.commonConfig,
            config: cacheConfig.clients,
          } satisfies RedisModuleOptions;
        },
      },
      true,
    );
  } catch (error) {
    throw new GeneralInternalServerException(
      "缓存客户端初始化失败，请联系运维人员",
      undefined,
      error,
    );
  }
}

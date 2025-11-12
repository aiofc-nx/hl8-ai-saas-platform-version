import { Inject, Injectable, Optional } from "@nestjs/common";
import { Logger } from "@hl8/logger";
import {
  GeneralInternalServerException,
  MissingConfigurationForFeatureException,
} from "@hl8/exceptions";
import { REDIS_CLIENTS } from "@liaoliaots/nestjs-redis/dist/redis/redis.constants.js";
import type { RedisClients } from "@liaoliaots/nestjs-redis/dist/redis/interfaces/index.js";
import type { Redis, RedisKey } from "ioredis";
import { CacheConfig } from "../config/cache.config.js";

type LoggerWithChild = Logger & {
  child?: (context: Record<string, unknown>) => Logger;
};

/**
 * @description 提供 Redis 客户端访问封装，统一处理命名空间与错误。
 */
@Injectable()
export class CacheClientProvider {
  private readonly logger: Logger;
  private readonly cacheConfig: CacheConfig;
  private readonly redisClients: RedisClients;

  constructor(
    @Inject(REDIS_CLIENTS)
    @Optional()
    redisClients: RedisClients | undefined,
    @Optional()
    cacheConfig: CacheConfig | undefined,
    logger: Logger,
  ) {
    this.cacheConfig = cacheConfig ?? new CacheConfig();
    if (typeof (logger as LoggerWithChild).child === "function") {
      this.logger = (logger as LoggerWithChild).child({
        context: CacheClientProvider.name,
      });
    } else {
      this.logger = logger;
    }

    if (!redisClients) {
      this.logger.warn("未注入 Redis 客户端令牌，使用内存缓存映射作为占位", {
        domain: "tenant-config",
      });
      const fallbackClient = this.createFallbackRedisClient();
      const fallbackClients: RedisClients = new Map();
      const defaultKey =
        this.cacheConfig.defaultClientKey ??
        this.cacheConfig.clients?.[0]?.clientKey ??
        this.cacheConfig.clients?.[0]?.namespace ??
        "default";
      fallbackClients.set(defaultKey, fallbackClient);
      this.redisClients = fallbackClients;
    } else {
      this.redisClients = redisClients;
    }
  }

  /**
   * @description 根据 clientKey 获取 Redis 客户端，未指定时使用默认客户端。
   * @param clientKey 指定的客户端键名
   * @returns 匹配的 Redis 客户端实例
   * @throws MissingConfigurationForFeatureException 当指定客户端不存在时抛出
   * @throws GeneralInternalServerException 当获取客户端过程中发生未知异常时抛出
   */
  public getClient(clientKey?: string): Redis {
    const targetKey = this.resolveTargetClientKey(clientKey);

    try {
      const client = this.redisClients.get(targetKey);
      if (!client) {
        const context = {
          clientKey: targetKey,
        };
        this.logger.error("缓存客户端获取失败", undefined, context);
        throw new MissingConfigurationForFeatureException(
          "缓存客户端",
          targetKey,
          `未找到名称为 ${targetKey} 的缓存客户端，请检查配置`,
        );
      }
      return client;
    } catch (error) {
      if (error instanceof MissingConfigurationForFeatureException) {
        throw error;
      }

      const context = {
        clientKey: targetKey,
        error,
      };
      this.logger.error("获取 Redis 客户端实例时发生异常", undefined, context);
      throw new GeneralInternalServerException(
        "读取缓存客户端失败，请联系运维人员",
        undefined,
        error,
      );
    }
  }

  /**
   * @description 返回默认的命名空间前缀，用于组合缓存键。
   * @param clientKey 指定的客户端键名
   * @returns 对应客户端的命名空间前缀，若无配置则返回 undefined
   */
  public getNamespacePrefix(clientKey?: string): string | undefined {
    const targetKey = this.resolveTargetClientKey(clientKey);
    const clientConfig = this.cacheConfig.clients.find((item) => {
      const key = item.clientKey ?? item.namespace;
      return key === targetKey;
    });

    return clientConfig?.namespace;
  }

  private resolveTargetClientKey(clientKey?: string): string {
    if (clientKey && clientKey.trim().length > 0) {
      return clientKey;
    }

    if (this.cacheConfig.defaultClientKey) {
      return this.cacheConfig.defaultClientKey;
    }

    const iterator = this.redisClients.keys();
    const firstKey = iterator.next().value as string | undefined;
    if (!firstKey) {
      throw new MissingConfigurationForFeatureException(
        "缓存客户端",
        "cache.clients",
        "Redis 客户端尚未注册，请确保 setupRedisModule 已执行",
      );
    }
    return firstKey;
  }

  private createFallbackRedisClient(): Redis {
    const store = new Map<string, string>();
    const timers = new Map<string, NodeJS.Timeout>();

    const client: Partial<Redis> = {
      async get(key: string) {
        return store.get(key) ?? null;
      },
      async set(
        key: string,
        value: string,
        ...args: Array<unknown>
      ): Promise<"OK"> {
        store.set(key, value);

        const [mode, ttl] = args;
        if (mode === "EX" && typeof ttl === "number" && ttl > 0) {
          const existingTimer = timers.get(key);
          if (existingTimer) {
            clearTimeout(existingTimer);
            existingTimer.unref?.();
            timers.delete(key);
          }

          const timeout = setTimeout(() => {
            store.delete(key);
            timers.delete(key);
          }, ttl * 1000);

          timeout.unref?.();
          timers.set(key, timeout);
        }

        return "OK";
      },
      del: (async (...args: unknown[]): Promise<number> => {
        const maybeCallback = args.at(-1);
        const hasCallback = typeof maybeCallback === "function";
        const keysArgs = hasCallback ? args.slice(0, -1) : args;
        const keys = keysArgs.filter(
          (item): item is RedisKey =>
            typeof item === "string" || Buffer.isBuffer(item),
        );
        let removed = 0;
        for (const key of keys) {
          const normalizedKey =
            typeof key === "string" ? key : key.toString("utf-8");
          if (store.delete(normalizedKey)) {
            removed += 1;
          }
          const existingTimer = timers.get(normalizedKey);
          if (existingTimer) {
            clearTimeout(existingTimer);
            existingTimer.unref?.();
            timers.delete(normalizedKey);
          }
        }
        if (hasCallback) {
          (maybeCallback as (err: null, result: number) => void)(null, removed);
        }
        return removed;
      }) as unknown as Redis["del"],
    };

    return client as Redis;
  }
}

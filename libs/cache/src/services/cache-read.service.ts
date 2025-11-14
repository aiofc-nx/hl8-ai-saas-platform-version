import { Inject, Injectable } from "@nestjs/common";
import { Logger } from "@hl8/logger";
import {
  GeneralBadRequestException,
  GeneralInternalServerException,
} from "@hl8/exceptions";
import type { Redis } from "ioredis";
import { performance } from "node:perf_hooks";
import { CacheClientProvider } from "./cache-client.provider.js";
import { CacheMetricsHook } from "../monitoring/cache-metrics.hook.js";
import {
  deserializeFromJson,
  serializeToJson,
} from "../constants/cache-defaults.js";
import type {
  CacheLogger,
  CacheLoggerWithChild,
} from "../types/logger.types.js";

/**
 * @description 缓存读取选项，描述命中策略、序列化与命名空间上下文。
 */
export interface CacheReadOptions<T> {
  /** @description 缓存所属业务域，例如 tenant-config */
  domain: string;
  /** @description 完整的缓存键 */
  key: string;
  /** @description 回源加载函数 */
  loader: () => Promise<T>;
  /** @description 租户标识，用于命名空间和指标 */
  tenantId?: string;
  /** @description 指定使用的 Redis 客户端键名 */
  clientKey?: string;
  /** @description 缓存 TTL（秒），未设置则遵循 Redis 默认策略 */
  ttlSeconds?: number;
  /** @description 自定义序列化逻辑 */
  serialize?: (value: T) => string;
  /** @description 自定义反序列化逻辑 */
  deserialize?: (value: string) => T;
}

/**
 * @description 缓存读服务，封装命中记录、回源加载与异常处理。
 */
@Injectable()
export class CacheReadService {
  private readonly logger: CacheLogger;

  constructor(
    private readonly cacheClientProvider: CacheClientProvider,
    private readonly cacheMetricsHook: CacheMetricsHook,
    @Inject(Logger)
    logger: CacheLogger,
  ) {
    const childFactory = (logger as CacheLoggerWithChild).child;
    this.logger =
      typeof childFactory === "function"
        ? childFactory.call(logger, { context: CacheReadService.name })
        : logger;
  }

  /**
   * @description 按键读取缓存，若未命中则回源加载并写回缓存。
   * @typeParam T 缓存数据类型
   * @param options 缓存读取与回源配置项
   * @returns 缓存内容或回源结果
   * @throws GeneralBadRequestException 当输入参数不符合要求时抛出
   * @throws GeneralInternalServerException 当 Redis 操作或序列化失败时抛出
   */
  public async getOrLoad<T>(options: CacheReadOptions<T>): Promise<T> {
    this.validateOptions(options);
    const {
      key,
      clientKey,
      domain,
      tenantId,
      loader,
      ttlSeconds,
      serialize = serializeToJson,
      deserialize = deserializeFromJson,
    } = options;

    const redisClient = this.getRedisClient(clientKey);

    try {
      const cached = await redisClient.get(key);
      if (cached !== null) {
        this.cacheMetricsHook.recordHit({ domain, tenantId, extra: { key } });
        this.logger.debug("缓存命中", { domain, tenantId, key });

        try {
          return deserialize(cached);
        } catch (deserializeError) {
          this.cacheMetricsHook.recordFailure({
            domain,
            tenantId,
            extra: { key, stage: "deserialize" },
            error: deserializeError,
          });
          throw new GeneralInternalServerException(
            "缓存反序列化失败",
            undefined,
            deserializeError,
          );
        }
      }

      this.cacheMetricsHook.recordMiss({ domain, tenantId, extra: { key } });
      this.logger.debug("缓存未命中，准备回源加载", { domain, tenantId, key });

      const start = performance.now();
      let value: T;
      try {
        value = await loader();
      } catch (loaderError) {
        this.cacheMetricsHook.recordFailure({
          domain,
          tenantId,
          extra: { key, stage: "loader" },
          error: loaderError,
        });

        const normalizedError =
          loaderError instanceof Error
            ? (loaderError as Error & { __cacheLoaderError?: true })
            : (new Error(String(loaderError)) as Error & {
                __cacheLoaderError?: true;
              });

        normalizedError.__cacheLoaderError = true;

        this.logger.error("回源加载失败", undefined, {
          domain,
          tenantId,
          key,
          error: normalizedError,
        });

        throw normalizedError;
      }
      const duration = performance.now() - start;

      this.cacheMetricsHook.recordOriginLatency({
        domain,
        tenantId,
        value: duration,
        extra: { key },
      });

      await this.persistValue(redisClient, key, value, ttlSeconds, serialize, {
        domain,
        tenantId,
      });

      return value;
    } catch (error) {
      if (error instanceof GeneralInternalServerException) {
        throw error;
      }

      if (
        (error as Error & { __cacheLoaderError?: true })?.__cacheLoaderError
      ) {
        throw error;
      }

      this.cacheMetricsHook.recordFailure({
        domain,
        tenantId,
        extra: { key, stage: "unknown" },
        error,
      });

      this.logger.error("缓存读取失败", undefined, {
        domain,
        tenantId,
        key,
        error,
      });

      throw new GeneralInternalServerException(
        "缓存读取失败，请稍后重试",
        undefined,
        error,
      );
    }
  }

  private validateOptions<T>(options: CacheReadOptions<T>): void {
    if (!options.key || options.key.trim().length === 0) {
      throw new GeneralBadRequestException({
        field: "key",
        message: "缓存键不能为空",
        rejectedValue: options.key,
      });
    }

    if (typeof options.loader !== "function") {
      throw new GeneralBadRequestException({
        field: "loader",
        message: "回源加载函数未提供",
      });
    }

    if (!options.domain) {
      throw new GeneralBadRequestException({
        field: "domain",
        message: "缓存域不能为空",
      });
    }
  }

  private getRedisClient(clientKey?: string): Redis {
    try {
      return this.cacheClientProvider.getClient(clientKey);
    } catch (error) {
      throw error instanceof GeneralInternalServerException
        ? error
        : new GeneralInternalServerException(
            "缓存客户端初始化失败",
            undefined,
            error,
          );
    }
  }

  private async persistValue<T>(
    redisClient: Redis,
    key: string,
    value: T,
    ttlSeconds: number | undefined,
    serialize: (input: T) => string,
    context: { domain: string; tenantId?: string },
  ): Promise<void> {
    try {
      const payload = serialize(value);
      if (ttlSeconds && ttlSeconds > 0) {
        await redisClient.set(key, payload, "EX", ttlSeconds);
      } else {
        await redisClient.set(key, payload);
      }

      this.logger.debug("缓存已写入", {
        domain: context.domain,
        tenantId: context.tenantId,
        key,
        ttlSeconds,
      });
    } catch (error) {
      this.cacheMetricsHook.recordFailure({
        domain: context.domain,
        tenantId: context.tenantId,
        extra: { key, stage: "persist" },
        error,
      });

      throw new GeneralInternalServerException(
        "缓存写入失败，请稍后重试",
        undefined,
        error,
      );
    }
  }
}

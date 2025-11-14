/**
 * @fileoverview 权限缓存服务实现
 * @description 实现权限缓存服务，支持缓存权限规则以提升查询性能
 *
 * ## 业务规则
 *
 * ### 权限缓存规则
 * - 权限缓存键包含租户、用户、组织维度
 * - 用户权限变更时失效该用户的缓存
 * - 租户权限变更时失效该租户所有用户的缓存
 * - 全局权限变更时失效全部缓存
 * - 缓存服务不可用时降级到直接查询
 *
 * ### 缓存键构建规则
 * - 缓存键格式：`casl:ability:${userId}:${tenantId}:${organizationId || ''}`
 * - 缓存键必须包含租户标识，确保多租户隔离
 * - 缓存键必须包含用户标识，确保用户隔离
 * - 缓存键可选包含组织标识，支持组织级权限
 *
 * ### 多级失效策略
 * - 用户权限变更时失效该用户的缓存：`casl:ability:${userId}:${tenantId}:*`
 * - 租户权限变更时失效该租户所有用户的缓存：`casl:ability:*:${tenantId}:*`
 * - 全局权限变更时失效全部缓存：`casl:ability:*`
 */

import { Inject, Injectable, Optional } from "@nestjs/common";
import { Logger } from "@hl8/logger";
import {
  CacheClientProvider,
  serializeToJson,
  deserializeFromJson,
} from "@hl8/cache";
import { AbilityCacheException } from "../exceptions/infrastructure-exception.js";
import { AbilityCacheConfig } from "../configuration/schemas/infrastructure-config.schema.js";
import type {
  AbilityCacheService,
  AppAbility,
  SecurityContext,
} from "./casl-ability.interface.js";

type LoggerService = InstanceType<typeof Logger>;

/**
 * @description 权限缓存服务实现
 * @remarks 实现权限缓存服务，支持缓存权限规则以提升查询性能
 *
 * @example
 * ```typescript
 * // 注入权限缓存服务
 * constructor(private readonly cacheService: AbilityCacheServiceImpl) {}
 *
 * // 构建缓存键
 * const key = cacheService.buildKey(context);
 *
 * // 获取缓存
 * const ability = await cacheService.get(key);
 *
 * // 设置缓存
 * await cacheService.set(key, ability);
 *
 * // 失效缓存
 * await cacheService.invalidate(context, 'user');
 * ```
 */
@Injectable()
export class AbilityCacheServiceImpl implements AbilityCacheService {
  /**
   * @description 缓存键前缀
   * @remarks 权限缓存的键前缀
   */
  private readonly CACHE_KEY_PREFIX = "casl:ability";

  /**
   * @description 缓存域名
   * @remarks 权限缓存的域名
   */
  private readonly CACHE_DOMAIN = "casl-ability";

  /**
   * @description 构造函数
   * @param cacheClientProvider - 缓存客户端提供者
   * @param logger - 日志服务（可选）
   * @param config - 权限缓存配置（可选）
   */
  constructor(
    private readonly cacheClientProvider: CacheClientProvider,
    @Optional() @Inject(Logger) private readonly logger?: LoggerService,
    @Optional()
    @Inject(AbilityCacheConfig)
    private readonly config?: AbilityCacheConfig,
  ) {}

  /**
   * @description 构建缓存键
   * @remarks 根据安全上下文构建缓存键
   *
   * @param context - 安全上下文
   * @returns 缓存键
   */
  buildKey(context: SecurityContext): string {
    // 构建缓存键：casl:ability:${userId}:${tenantId}:${organizationId || ''}
    const parts = [
      this.CACHE_KEY_PREFIX,
      context.userId,
      context.tenantId,
      context.organizationId || "",
    ];

    return parts.join(":");
  }

  /**
   * @description 获取缓存
   * @remarks 根据缓存键获取权限能力
   *
   * @param key - 缓存键
   * @returns 权限能力或 null
   */
  async get(key: string): Promise<AppAbility | null> {
    try {
      // 获取 Redis 客户端
      const redisClient = this.cacheClientProvider.getClient();

      // 从缓存获取
      const cached = await redisClient.get(key);

      if (cached) {
        try {
          // 反序列化权限能力
          const ability = deserializeFromJson<AppAbility>(cached);

          // 记录日志
          this.logger?.debug("从缓存获取权限能力", {
            key,
            domain: this.CACHE_DOMAIN,
          });

          return ability;
        } catch (deserializeError) {
          // 反序列化失败，记录日志并返回 null
          this.logger?.error(deserializeError as Error, {
            key,
            domain: this.CACHE_DOMAIN,
          });
          return null;
        }
      }

      // 缓存未命中
      return null;
    } catch (error) {
      // 记录错误日志
      this.logger?.error(error as Error, {
        key,
        domain: this.CACHE_DOMAIN,
      });

      // 检查是否需要降级处理
      if (this.shouldDegrade(error as Error)) {
        // 降级处理：返回 null，让调用方直接查询
        this.logger?.warn("权限能力缓存获取失败，已降级处理", {
          key,
          domain: this.CACHE_DOMAIN,
          error: (error as Error).message,
        });
        return null;
      }

      // 无法处理的错误，抛出异常
      throw new AbilityCacheException(
        "权限缓存",
        `权限能力缓存获取失败: ${(error as Error).message}`,
        "ABILITY_CACHE_ERROR",
        error,
      );
    }
  }

  /**
   * @description 设置缓存
   * @remarks 将权限能力缓存到缓存服务
   *
   * @param key - 缓存键
   * @param ability - 权限能力
   * @returns Promise<void>
   */
  async set(key: string, ability: AppAbility): Promise<void> {
    try {
      // 获取 Redis 客户端
      const redisClient = this.cacheClientProvider.getClient();

      // 获取缓存过期时间
      const ttl = this.config?.ttlSeconds ?? 3600;

      // 序列化权限能力
      const serialized = serializeToJson(ability);

      // 设置缓存
      if (ttl > 0) {
        await redisClient.setex(key, ttl, serialized);
      } else {
        await redisClient.set(key, serialized);
      }

      // 记录日志
      this.logger?.debug("权限能力已缓存", {
        key,
        ttl,
        domain: this.CACHE_DOMAIN,
      });
    } catch (error) {
      // 记录错误日志
      this.logger?.error(error as Error, {
        key,
        domain: this.CACHE_DOMAIN,
      });

      // 检查是否需要降级处理
      if (this.shouldDegrade(error as Error)) {
        // 降级处理：仅记录日志，不影响权限验证流程
        this.logger?.warn("权限能力缓存设置失败，已降级处理", {
          key,
          domain: this.CACHE_DOMAIN,
          error: (error as Error).message,
        });
        return;
      }

      // 无法处理的错误，抛出异常
      throw new AbilityCacheException(
        "权限缓存",
        `权限能力缓存设置失败: ${(error as Error).message}`,
        "ABILITY_CACHE_ERROR",
        error,
      );
    }
  }

  /**
   * @description 失效缓存
   * @remarks 根据安全上下文和失效级别失效缓存
   *
   * @param context - 安全上下文
   * @param level - 失效级别（user、tenant、global）
   * @returns Promise<void>
   */
  async invalidate(
    context: SecurityContext,
    level: "user" | "tenant" | "global",
  ): Promise<void> {
    try {
      // 根据失效级别构建缓存键模式
      let pattern: string;

      switch (level) {
        case "user":
          // 用户权限变更时失效该用户的缓存
          pattern = `${this.CACHE_KEY_PREFIX}:${context.userId}:${context.tenantId}:*`;
          break;
        case "tenant":
          // 租户权限变更时失效该租户所有用户的缓存
          pattern = `${this.CACHE_KEY_PREFIX}:*:${context.tenantId}:*`;
          break;
        case "global":
          // 全局权限变更时失效全部缓存
          pattern = `${this.CACHE_KEY_PREFIX}:*`;
          break;
        default:
          // 默认失效用户级别的缓存
          pattern = `${this.CACHE_KEY_PREFIX}:${context.userId}:${context.tenantId}:*`;
      }

      // 删除匹配的缓存键
      await this.deleteByPattern(pattern);

      // 记录日志
      this.logger?.debug("权限能力缓存已失效", {
        level,
        pattern,
        userId: context.userId,
        tenantId: context.tenantId,
        organizationId: context.organizationId,
      });
    } catch (error) {
      // 记录错误日志
      this.logger?.error(error as Error, {
        level,
        userId: context.userId,
        tenantId: context.tenantId,
        organizationId: context.organizationId,
      });

      // 检查是否需要降级处理
      if (this.shouldDegrade(error as Error)) {
        // 降级处理：仅记录日志，不影响权限验证流程
        this.logger?.warn("权限能力缓存失效失败，已降级处理", {
          level,
          userId: context.userId,
          tenantId: context.tenantId,
          organizationId: context.organizationId,
          error: (error as Error).message,
        });
        return;
      }

      // 无法处理的错误，抛出异常
      throw new AbilityCacheException(
        "权限缓存",
        `权限能力缓存失效失败: ${(error as Error).message}`,
        "ABILITY_CACHE_ERROR",
        error,
      );
    }
  }

  /**
   * @description 根据模式删除缓存
   * @remarks 根据缓存键模式删除匹配的缓存
   *
   * @param pattern - 缓存键模式
   * @returns Promise<void>
   */
  private async deleteByPattern(pattern: string): Promise<void> {
    try {
      // 获取 Redis 客户端
      const redisClient = this.cacheClientProvider.getClient();

      // 使用 SCAN 命令扫描匹配的键
      const keys: string[] = [];
      let cursor = 0;

      do {
        const [nextCursor, scannedKeys] = await redisClient.scan(
          cursor,
          "MATCH",
          pattern,
          "COUNT",
          100,
        );
        cursor = parseInt(nextCursor, 10);
        keys.push(...scannedKeys);
      } while (cursor !== 0);

      // 批量删除匹配的键
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }

      // 记录日志
      this.logger?.debug("根据模式删除缓存", {
        pattern,
        deletedCount: keys.length,
        domain: this.CACHE_DOMAIN,
      });
    } catch (error) {
      // 记录错误日志
      this.logger?.error(error as Error, {
        pattern,
        domain: this.CACHE_DOMAIN,
      });

      // 检查是否需要降级处理
      if (this.shouldDegrade(error as Error)) {
        // 降级处理：仅记录日志，不影响权限验证流程
        this.logger?.warn("根据模式删除缓存失败，已降级处理", {
          pattern,
          domain: this.CACHE_DOMAIN,
          error: (error as Error).message,
        });
        return;
      }

      // 无法处理的错误，抛出异常
      throw new AbilityCacheException(
        "权限缓存",
        `根据模式删除缓存失败: ${(error as Error).message}`,
        "ABILITY_CACHE_ERROR",
        error,
      );
    }
  }

  /**
   * @description 判断是否需要降级处理
   * @remarks 判断错误是否需要降级处理
   *
   * @param error - 错误对象
   * @returns 是否需要降级处理
   */
  private shouldDegrade(error: Error): boolean {
    // 检查是否启用降级
    if (this.config?.enableCacheDegradation !== true) {
      return false;
    }

    // 检查错误类型
    const errorMessage = error.message.toLowerCase();
    const degradeKeywords = [
      "connection",
      "timeout",
      "network",
      "econnrefused",
      "econnreset",
    ];

    return degradeKeywords.some((keyword) => errorMessage.includes(keyword));
  }
}

import { Injectable, Optional, type Type } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import { Logger } from "@hl8/logger";
import {
  GeneralBadRequestException,
  GeneralInternalServerException,
  MissingConfigurationForFeatureException,
} from "@hl8/exceptions";
import type Redlock from "redlock";
import type { Redis } from "ioredis";
import { CacheClientProvider } from "./cache-client.provider.js";
import { CacheNamespaceRegistry } from "../config/cache-namespace.registry.js";
import {
  DEFAULT_CACHE_KEY_SEPARATOR,
  DEFAULT_DOUBLE_DELETE_DELAY_MS,
  DEFAULT_REDIS_LOCK_TTL_MS,
} from "../constants/cache-defaults.js";
import { CACHE_REDLOCK_TOKEN } from "../constants/cache-tokens.js";
import { RedlockService as RedlockServiceToken } from "../internal/redlock-loader.js";
import { RedlockService as MockRedlockService } from "../testing/redlock.mock.js";
import { CacheNotificationService } from "./cache-notification.service.js";
import { OptimisticLockException } from "@hl8/exceptions";

/**
 * @description 缓存失效请求载荷，封装写路径完成后的双删策略参数。
 */
export interface CacheInvalidationCommand {
  /** @description 业务域标识 */
  domain: string;
  /** @description 租户标识 */
  tenantId: string;
  /** @description 需要失效的完整缓存键 */
  keys: string[];
  /** @description 触发失效的中文原因 */
  reason: string;
  /** @description 指定 Redis 客户端键名，可选 */
  clientKey?: string;
  /** @description 延迟双删的等待毫秒数，默认 100ms */
  delayMs?: number;
  /** @description 分布式锁租期（毫秒），默认 1000ms */
  lockDurationMs?: number;
  /** @description 是否发送后续失效通知 */
  notify?: boolean;
}

/**
 * @description 缓存一致性服务，实现写前删除、写后延迟双删与通知日志。
 */
@Injectable()
export class CacheConsistencyService {
  private readonly logger: Logger;
  private readonly redlockService?: Redlock;
  private readonly notificationService?: CacheNotificationService;

  constructor(
    private readonly cacheClientProvider: CacheClientProvider,
    private readonly namespaceRegistry: CacheNamespaceRegistry,
    private readonly moduleRef: ModuleRef,
    logger: Logger,
    @Optional()
    notificationService?: CacheNotificationService,
  ) {
    const childFactory = logger.child;
    this.logger =
      typeof childFactory === "function"
        ? childFactory.call(logger, { context: CacheConsistencyService.name })
        : logger;
    const resolveRedlockSafely = (
      token: Type<Redlock> | string | symbol,
    ): Redlock | undefined => {
      try {
        return this.moduleRef.get<Redlock>(token, {
          strict: false,
        });
      } catch {
        return undefined;
      }
    };

    const redlockFromCustomToken = resolveRedlockSafely(CACHE_REDLOCK_TOKEN);
    const redlockFromModule = resolveRedlockSafely(
      RedlockServiceToken as unknown as Type<Redlock>,
    );

    this.redlockService =
      redlockFromCustomToken ?? redlockFromModule ?? undefined;

    if (!this.redlockService) {
      this.logger.warn("分布式锁服务未注册，已降级为内存锁实现");
      this.redlockService = new MockRedlockService() as unknown as Redlock;
    }
    this.notificationService = notificationService;
  }

  /**
   * @description 执行缓存失效流程：持锁、立即删、延迟删并记录日志。
   * @param command 缓存失效指令
   * @returns Promise<void>
   * @throws MissingConfigurationForFeatureException 当找不到命名空间策略或 Redis 客户端时抛出
   * @throws OptimisticLockException 当分布式锁竞争导致无法获取锁时抛出
   * @throws GeneralInternalServerException 当失效流程中出现未知异常时抛出
   */
  public async invalidate(command: CacheInvalidationCommand): Promise<void> {
    this.validateCommand(command);

    const {
      domain,
      tenantId,
      keys,
      clientKey,
      delayMs = DEFAULT_DOUBLE_DELETE_DELAY_MS,
      lockDurationMs = DEFAULT_REDIS_LOCK_TTL_MS,
      reason,
      notify,
    } = command;
    const shouldNotify = notify ?? true;

    const policy = this.namespaceRegistry.get(domain);
    if (!policy) {
      throw new MissingConfigurationForFeatureException(
        "缓存命名空间策略",
        domain,
        "未找到匹配的命名空间配置，请联系运维补充配置",
      );
    }

    const redis = this.cacheClientProvider.getClient(clientKey);
    const lockResource = this.buildLockResource(domain, tenantId);

    try {
      if (
        !this.redlockService ||
        typeof this.redlockService.using !== "function"
      ) {
        throw new GeneralInternalServerException(
          "分布式锁服务未配置，无法执行缓存一致性流程",
        );
      }

      await this.redlockService.using(
        [lockResource],
        lockDurationMs,
        async (signal) => {
          if (signal.aborted) {
            throw (
              signal.error ??
              new GeneralInternalServerException("缓存锁已失效，无法保障一致性")
            );
          }

          await this.executeDoubleDelete(redis, keys, delayMs);

          this.logger.log("缓存失效流程完成", {
            domain,
            tenantId,
            keys,
            reason,
          });

          if (shouldNotify) {
            this.logger.debug("已记录缓存失效事件，后续可集成事件总线", {
              domain,
              tenantId,
              keys,
            });
            try {
              await this.notificationService?.publishInvalidation({
                domain,
                tenantId,
                keys,
                reason,
              });
            } catch (notifyError) {
              this.logger.error("缓存失效通知发送失败", undefined, {
                domain,
                tenantId,
                keys,
                notifyError,
              });
            }
          }
        },
      );
    } catch (error) {
      if (error instanceof Error && error.name === "ResourceLockedError") {
        const context = {
          domain,
          tenantId,
          keys,
          lockResource,
        };
        this.logger.warn("缓存锁竞争，失效操作中断", context);
        try {
          await this.notificationService?.publishLockContention(context);
        } catch (notifyError) {
          this.logger.error("锁竞争告警通知失败", undefined, {
            ...context,
            notifyError,
          });
        }
        throw new OptimisticLockException(
          undefined,
          undefined,
          "缓存锁正在使用中，请稍后重试",
          undefined,
          error,
        );
      }
      this.logger.error("缓存失效流程失败", undefined, {
        domain,
        tenantId,
        keys,
        error,
      });
      if (error instanceof GeneralBadRequestException) {
        throw error;
      }
      throw new GeneralInternalServerException(
        "缓存失效失败，请稍后重试",
        undefined,
        error,
      );
    }
  }

  private validateCommand(command: CacheInvalidationCommand): void {
    if (!command.domain?.trim()) {
      throw new GeneralBadRequestException({
        field: "domain",
        message: "业务域不能为空",
      });
    }
    if (!command.tenantId?.trim()) {
      throw new GeneralBadRequestException({
        field: "tenantId",
        message: "租户标识不能为空",
      });
    }
    if (!command.keys?.length) {
      throw new GeneralBadRequestException({
        field: "keys",
        message: "至少需要提供一个缓存键",
      });
    }
    if (!command.reason?.trim()) {
      throw new GeneralBadRequestException({
        field: "reason",
        message: "失效原因不能为空",
      });
    }
  }

  private buildLockResource(domain: string, tenantId: string): string {
    return ["lock", "cache", domain, tenantId]
      .filter(Boolean)
      .join(DEFAULT_CACHE_KEY_SEPARATOR);
  }

  private async executeDoubleDelete(
    redis: Redis,
    keys: string[],
    delayMs: number,
  ): Promise<void> {
    await this.deleteKeys(redis, keys);
    if (delayMs > 0) {
      await this.sleep(delayMs);
    }
    await this.deleteKeys(redis, keys);
  }

  private async deleteKeys(redis: Redis, keys: string[]): Promise<void> {
    if (keys.length === 0) {
      return;
    }
    await redis.del(...keys);
  }

  private async sleep(duration: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, duration));
  }
}

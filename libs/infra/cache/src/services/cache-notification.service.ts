import { Injectable } from "@nestjs/common";
import { Logger } from "@hl8/logger";

/**
 * @description 缓存失效通知载荷，用于广播写后失效事件。
 */
export interface CacheInvalidationNotification {
  readonly domain: string;
  readonly tenantId: string;
  readonly keys: string[];
  readonly reason: string;
  readonly requestId?: string;
}

/**
 * @description 缓存锁竞争通知载荷，封装告警所需上下文。
 */
export interface CacheLockContentionNotification {
  readonly domain: string;
  readonly tenantId: string;
  readonly keys: string[];
  readonly lockResource: string;
}

/**
 * @description 缓存预取通知载荷，描述预热目标信息。
 */
export interface CachePrefetchNotification {
  readonly domain: string;
  readonly tenantId: string;
  readonly keys: string[];
  readonly bypassLock?: boolean;
}

/**
 * @description 缓存预取任务执行结果。
 */
export interface CachePrefetchResult {
  refreshed: number;
  failures: Array<{ key: string; message: string }>;
}

/**
 * @description 缓存通知服务，负责向外部通道广播失效与预热事件。
 */
@Injectable()
export class CacheNotificationService {
  private readonly logger: Logger;

  constructor(logger: Logger) {
    const childFactory = (
      logger as Logger & {
        child?: (context: Record<string, unknown>) => Logger;
      }
    ).child;
    this.logger =
      typeof childFactory === "function"
        ? childFactory.call(logger, { context: CacheNotificationService.name })
        : logger;
  }

  /**
   * @description 发布缓存失效事件，后续可接入消息队列或事件总线。
   * @param payload 失效事件载荷
   * @returns Promise<void>
   */
  public async publishInvalidation(
    payload: CacheInvalidationNotification,
  ): Promise<void> {
    const context: Record<string, unknown> = { ...payload };
    this.logger.log("缓存失效通知已发送", context);
  }

  /**
   * @description 当检测到锁竞争时触发告警钩子。
   * @param payload 锁竞争上下文
   * @returns Promise<void>
   */
  public async publishLockContention(
    payload: CacheLockContentionNotification,
  ): Promise<void> {
    const context: Record<string, unknown> = { ...payload };
    this.logger.warn("检测到缓存锁竞争，已触发告警", context);
  }

  /**
   * @description 发布缓存预取事件，默认返回刷新统计信息。
   * @param payload 预取请求参数
   * @returns Promise<CachePrefetchResult>
   */
  public async publishPrefetchRequested(
    payload: CachePrefetchNotification,
  ): Promise<CachePrefetchResult> {
    const context: Record<string, unknown> = { ...payload };
    this.logger.log("缓存预取事件已广播", context);
    return {
      refreshed: payload.keys.length,
      failures: [],
    } satisfies CachePrefetchResult;
  }
}

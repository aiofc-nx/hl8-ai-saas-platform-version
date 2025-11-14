import { Inject, Injectable } from "@nestjs/common";
import { Logger } from "@hl8/logger";
import type {
  CacheLogger,
  CacheLoggerWithChild,
} from "../types/logger.types.js";

/**
 * @description 缓存指标事件载荷定义。
 */
export interface CacheMetricsPayload {
  /** @description 业务域标识，例如 tenant-config */
  domain: string;
  /** @description 租户标识，可选 */
  tenantId?: string;
  /** @description 指标类型 */
  metric: "hit" | "miss" | "origin" | "lock" | "failure";
  /** @description 指标值 */
  value: number;
  /** @description 附加信息 */
  extra?: Record<string, unknown>;
}

/**
 * @description 缓存指标钩子，负责记录命中率、回源率、锁等待等信息。
 */
@Injectable()
export class CacheMetricsHook {
  private readonly logger: CacheLogger;

  constructor(@Inject(Logger) logger: CacheLogger) {
    const childFactory = (logger as CacheLoggerWithChild).child;
    this.logger =
      typeof childFactory === "function"
        ? childFactory.call(logger, { context: CacheMetricsHook.name })
        : logger;
  }

  /**
   * @description 记录缓存命中事件。
   * @param payload 指标载荷，自动补充 metric 与 value
   * @returns void
   */
  public recordHit(
    payload: Omit<CacheMetricsPayload, "metric" | "value">,
  ): void {
    this.record({ ...payload, metric: "hit", value: 1 });
  }

  /**
   * @description 记录缓存未命中事件。
   * @param payload 指标载荷，自动补充 metric 与 value
   * @returns void
   */
  public recordMiss(
    payload: Omit<CacheMetricsPayload, "metric" | "value">,
  ): void {
    this.record({ ...payload, metric: "miss", value: 1 });
  }

  /**
   * @description 记录回源耗时指标。
   * @param payload 包含耗时数值的指标载荷
   * @returns void
   */
  public recordOriginLatency(
    payload: Omit<CacheMetricsPayload, "metric">,
  ): void {
    this.record({ ...payload, metric: "origin" });
  }

  /**
   * @description 记录锁等待耗时指标。
   * @param payload 包含锁等待数值的指标载荷
   * @returns void
   */
  public recordLockWait(payload: Omit<CacheMetricsPayload, "metric">): void {
    this.record({ ...payload, metric: "lock" });
  }

  /**
   * @description 记录缓存操作失败事件。
   * @param payload 指标载荷，需额外提供 error
   * @returns void
   */
  public recordFailure(
    payload: Omit<CacheMetricsPayload, "metric" | "value"> & {
      error: unknown;
    },
  ): void {
    this.record({ ...payload, metric: "failure", value: 1 });
    this.logger.error("缓存操作失败", undefined, {
      domain: payload.domain,
      tenantId: payload.tenantId,
      extra: payload.extra,
      error: payload.error,
    });
  }

  private record(payload: CacheMetricsPayload): void {
    this.logger.debug("缓存指标上报", { payload });
    // TODO: 后续可在此对接监控系统或事件总线
  }
}

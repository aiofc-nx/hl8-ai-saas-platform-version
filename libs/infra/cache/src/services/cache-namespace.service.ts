import { Injectable } from "@nestjs/common";
import { Logger } from "@hl8/logger";
import {
  CacheNamespacePolicy,
  CacheNamespaceRegistry,
} from "../config/cache-namespace.registry.js";

/**
 * @description 命名空间策略响应数据结构。
 */
export interface CacheNamespacePolicyView
  extends Omit<CacheNamespacePolicy, "hitThresholdAlert"> {
  /** @description 可选的命中率告警阈值 */
  hitThresholdAlert: number | null;
}

/**
 * @description 提供命名空间策略查询能力，并记录相关日志。
 */
@Injectable()
export class CacheNamespaceService {
  constructor(
    private readonly registry: CacheNamespaceRegistry,
    private readonly logger: Logger,
  ) {}

  /**
   * @description 返回全部命名空间策略视图。
   * @returns 策略视图数组
   */
  public listPolicies(): CacheNamespacePolicyView[] {
    const policies = this.registry.list();
    if (policies.length === 0) {
      this.logger.warn("尚未配置任何缓存命名空间策略", {
        event: "cache.namespace.empty",
      });
    }
    return policies.map((policy) => ({
      domain: policy.domain,
      keyPrefix: policy.keyPrefix,
      keySuffix: policy.keySuffix,
      separator: policy.separator,
      defaultTTL: policy.defaultTTL,
      evictionPolicy: policy.evictionPolicy,
      hitThresholdAlert: policy.hitThresholdAlert,
    }));
  }
}

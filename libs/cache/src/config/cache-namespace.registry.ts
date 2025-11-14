import { Inject, Injectable } from "@nestjs/common";
import { Logger } from "@hl8/logger";
import { CacheConfig } from "./cache.config.js";
import {
  CacheEvictionPolicy,
  CacheNamespacePolicyConfig,
} from "./cache-namespace-policy.config.js";
import { DEFAULT_CACHE_KEY_SEPARATOR } from "../constants/cache-defaults.js";
import type { CacheLogger } from "../types/logger.types.js";

/**
 * @description 命名空间策略投影定义，供业务查询与序列化使用。
 */
export interface CacheNamespacePolicy {
  /** @description 业务域标识 */
  domain: string;
  /** @description 键名前缀 */
  keyPrefix: string;
  /** @description 键名后缀，可为空 */
  keySuffix: string | null;
  /** @description 键名分隔符 */
  separator: string;
  /** @description 默认缓存 TTL（秒） */
  defaultTTL: number;
  /** @description 缓存淘汰策略 */
  evictionPolicy: CacheEvictionPolicy;
  /** @description 命中率告警阈值 */
  hitThresholdAlert: number | null;
}

/**
 * @description 策略变更监听器函数类型，监听最新策略列表。
 * @param policies 最新的策略集合快照
 */
type PolicyChangeListener = (policies: CacheNamespacePolicy[]) => void;

/**
 * @description 命名空间策略注册表，负责维护策略快照并支持热加载通知。
 */
@Injectable()
export class CacheNamespaceRegistry {
  private readonly policies = new Map<string, CacheNamespacePolicy>();

  private readonly listeners = new Set<PolicyChangeListener>();

  constructor(
    private readonly cacheConfig: CacheConfig,
    @Inject(Logger)
    private readonly logger: CacheLogger,
  ) {
    this.refreshFromConfig(cacheConfig);
  }

  /**
   * @description 返回当前全部命名空间策略，按照域名排序。
   * @returns 排序后的策略视图数组
   */
  public list(): CacheNamespacePolicy[] {
    return [...this.policies.values()].sort((a, b) =>
      a.domain.localeCompare(b.domain),
    );
  }

  /**
   * @description 根据业务域获取策略，不存在时返回 undefined。
   * @param domain 业务域标识
   * @returns 对应的策略记录，未命中时返回 undefined
   */
  public get(domain: string): CacheNamespacePolicy | undefined {
    return this.policies.get(domain);
  }

  /**
   * @description 使用新的配置快照刷新策略集合。
   * @param config 缓存总体配置
   * @returns void
   */
  public refreshFromConfig(config: CacheConfig): void {
    const policies = config.namespacePolicies ?? [];
    this.replacePolicies(policies);
  }

  /**
   * @description 注册策略热加载监听器，返回取消订阅函数。
   * @param listener 策略变更回调
   * @returns 取消订阅的函数
   */
  public onPoliciesChange(listener: PolicyChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * @description 直接替换当前策略集合，并触发通知。
   * @param policies 策略配置数组
   * @returns void
   */
  public replacePolicies(policies: CacheNamespacePolicyConfig[]): void {
    this.policies.clear();

    policies.forEach((policy) => {
      const normalized = this.normalize(policy);
      if (this.policies.has(normalized.domain)) {
        this.logger.warn("检测到重复域，后续策略将覆盖之前的配置", {
          domain: normalized.domain,
        });
      }
      this.policies.set(normalized.domain, normalized);
    });

    this.logger.debug("命名空间策略已刷新", {
      count: this.policies.size,
    });

    this.notifyListeners();
  }

  private normalize(policy: CacheNamespacePolicyConfig): CacheNamespacePolicy {
    return {
      domain: policy.domain,
      keyPrefix: policy.keyPrefix,
      keySuffix: policy.keySuffix ?? null,
      separator: policy.separator ?? DEFAULT_CACHE_KEY_SEPARATOR,
      defaultTTL: policy.defaultTTL,
      evictionPolicy: policy.evictionPolicy,
      hitThresholdAlert: policy.hitThresholdAlert ?? null,
    };
  }

  private notifyListeners(): void {
    const snapshot = this.list();
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (error) {
        this.logger.error("命名空间策略监听器执行失败", undefined, {
          error,
        });
      }
    }
  }
}

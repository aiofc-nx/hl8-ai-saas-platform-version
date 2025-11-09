/**
 * 缓存管理器
 *
 * @description 配置缓存的统一管理接口
 * @since 1.0.0
 */

import { CACHE_KEYS, CacheEventType, CONFIG_DEFAULTS } from "../constants.js";
import {
  CacheEventListener,
  CacheOptions,
  CacheProvider,
  CacheStats,
  CacheStrategy,
  FileCacheOptions,
  MemoryCacheOptions,
} from "../types/cache.types.js";
import { ConfigRecord } from "../types/config.types.js";
import { FileCacheProvider } from "./file-cache.provider.js";
import { MemoryCacheProvider } from "./memory-cache.provider.js";

/**
 * 缓存管理器类
 *
 * @description 配置缓存的统一管理接口
 * @class CacheManager
 * @since 1.0.0
 */
export class CacheManager {
  private provider: CacheProvider | null = null;
  private options: CacheOptions;
  private listeners = new Map<CacheEventType, Set<CacheEventListener>>();

  constructor(options: CacheOptions = {}) {
    this.options = {
      strategy: CacheStrategy.MEMORY,
      keyPrefix: CACHE_KEYS.CONFIG,
      ttl: CONFIG_DEFAULTS.CACHE_TTL * 1000, // 转换为毫秒
      maxSize: 1000,
      enabled: CONFIG_DEFAULTS.ENABLE_CACHE,
      ...options,
    };

    this.initializeProvider();
  }

  /**
   * 获取缓存值
   *
   * @description 从缓存中获取配置值
   * @param key 缓存键
   * @returns 配置记录或 null
   * @since 1.0.0
   */
  public async get(key: string): Promise<ConfigRecord | null> {
    if (!this.options.enabled || !this.provider) {
      return null;
    }

    const cacheKey = this.generateCacheKey(key);
    return await this.provider.get(cacheKey);
  }

  /**
   * 设置缓存值
   *
   * @description 将配置值存储到缓存中
   * @param key 缓存键
   * @param value 配置记录
   * @param ttl 过期时间（毫秒）
   * @since 1.0.0
   */
  public async set(
    key: string,
    value: ConfigRecord,
    ttl?: number,
  ): Promise<void> {
    if (!this.options.enabled || !this.provider) {
      return;
    }

    const cacheKey = this.generateCacheKey(key);
    const effectiveTtl = ttl || this.options.ttl;
    await this.provider.set(cacheKey, value, effectiveTtl);
  }

  /**
   * 删除缓存值
   *
   * @description 从缓存中删除指定的配置值
   * @param key 缓存键
   * @returns 是否删除成功
   * @since 1.0.0
   */
  public async delete(key: string): Promise<boolean> {
    if (!this.options.enabled || !this.provider) {
      return false;
    }

    const cacheKey = this.generateCacheKey(key);
    return await this.provider.delete(cacheKey);
  }

  /**
   * 清空所有缓存
   *
   * @description 清空缓存中的所有配置值
   * @since 1.0.0
   */
  public async clear(): Promise<void> {
    if (!this.options.enabled || !this.provider) {
      return;
    }

    await this.provider.clear();
  }

  /**
   * 检查缓存是否存在
   *
   * @description 检查指定的缓存键是否存在
   * @param key 缓存键
   * @returns 是否存在
   * @since 1.0.0
   */
  public async has(key: string): Promise<boolean> {
    if (!this.options.enabled || !this.provider) {
      return false;
    }

    const cacheKey = this.generateCacheKey(key);
    return await this.provider.has(cacheKey);
  }

  /**
   * 获取缓存统计信息
   *
   * @description 获取缓存的统计信息
   * @returns 缓存统计信息
   * @since 1.0.0
   */
  public async getStats(): Promise<CacheStats> {
    if (!this.options.enabled || !this.provider) {
      return {
        totalEntries: 0,
        hits: 0,
        misses: 0,
        hitRate: 0,
        totalSize: 0,
        averageAccessTime: 0,
        topKeys: [],
      };
    }

    return await this.provider.getStats();
  }

  /**
   * 添加事件监听器
   *
   * @description 添加缓存事件监听器
   * @param event 事件类型
   * @param listener 监听器函数
   * @since 1.0.0
   */
  public on(event: CacheEventType, listener: CacheEventListener): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);

    // 如果提供者已初始化，也添加到提供者
    if (this.provider) {
      this.provider.on(event, listener);
    }
  }

  /**
   * 移除事件监听器
   *
   * @description 移除缓存事件监听器
   * @param event 事件类型
   * @param listener 监听器函数
   * @since 1.0.0
   */
  public off(event: CacheEventType, listener: CacheEventListener): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(listener);
    }

    // 如果提供者已初始化，也从提供者中移除
    if (this.provider) {
      this.provider.off(event, listener);
    }
  }

  /**
   * 更新缓存选项
   *
   * @description 更新缓存配置选项
   * @param options 新的缓存选项
   * @since 1.0.0
   */
  public async updateOptions(options: Partial<CacheOptions>): Promise<void> {
    // 先保存旧策略，用于检查是否变化
    const oldStrategy = this.options.strategy;
    this.options = { ...this.options, ...options };

    // 如果策略发生变化，重新初始化提供者
    if (options.strategy && options.strategy !== oldStrategy) {
      await this.initializeProvider();
    }
  }

  /**
   * 获取当前缓存选项
   *
   * @description 获取当前的缓存配置选项
   * @returns 缓存选项
   * @since 1.0.0
   */
  public getOptions(): CacheOptions {
    return { ...this.options };
  }

  /**
   * 启用缓存
   *
   * @description 启用配置缓存
   * @since 1.0.0
   */
  public enable(): void {
    this.options.enabled = true;
  }

  /**
   * 禁用缓存
   *
   * @description 禁用配置缓存
   * @since 1.0.0
   */
  public disable(): void {
    this.options.enabled = false;
  }

  /**
   * 销毁缓存管理器
   *
   * @description 清理资源并销毁缓存管理器
   * @since 1.0.0
   */
  public destroy(): void {
    if (this.provider && "destroy" in this.provider) {
      (this.provider as { destroy(): void }).destroy();
    }
    this.provider = null;
    this.listeners.clear();
  }

  /**
   * 初始化缓存提供者
   *
   * @description 根据策略初始化相应的缓存提供者
   * @private
   * @since 1.0.0
   */
  private async initializeProvider(): Promise<void> {
    // 销毁现有提供者
    if (this.provider && "destroy" in this.provider) {
      (this.provider as { destroy(): void }).destroy();
    }

    // 重新添加事件监听器到新提供者
    const existingListeners = new Map(this.listeners);

    switch (this.options.strategy) {
      case CacheStrategy.MEMORY:
        this.provider = new MemoryCacheProvider(
          this.options as MemoryCacheOptions,
        );
        break;
      case CacheStrategy.FILE:
        this.provider = new FileCacheProvider(this.options as FileCacheOptions);
        break;
      case CacheStrategy.REDIS:
        // TODO: 实现 Redis 缓存提供者
        throw new Error("Redis cache provider not implemented yet");
      case CacheStrategy.NONE:
        this.provider = null;
        break;
      default:
        throw new Error(`Unsupported cache strategy: ${this.options.strategy}`);
    }

    // 重新添加事件监听器
    if (this.provider) {
      for (const [event, listeners] of existingListeners) {
        for (const listener of listeners) {
          this.provider.on(event, listener);
        }
      }
    }
  }

  /**
   * 生成缓存键
   *
   * @description 根据配置生成缓存键
   * @param key 原始键
   * @returns 缓存键
   * @private
   * @since 1.0.0
   */
  private generateCacheKey(key: string): string {
    const prefix = this.options.keyPrefix || "config";
    const keyGenerator = this.options.keyGenerator;

    if (keyGenerator) {
      return keyGenerator(key);
    }

    return `${prefix}:${key}`;
  }
}

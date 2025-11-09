/**
 * 内存缓存提供者
 *
 * @description 基于内存的配置缓存实现
 * @author HL8 SAAS Platform Team
 * @since 1.0.0
 */

import { CacheEventType } from "../constants.js";
import { ConfigLogger } from "../services/config-logger.service.js";
import {
  CacheEntry,
  CacheEvent,
  CacheEventListener,
  CacheProvider,
  CacheStats,
  MemoryCacheOptions,
} from "../types/cache.types.js";
import { ConfigRecord } from "../types/config.types.js";

/**
 * 内存缓存提供者类
 *
 * @description 基于内存的配置缓存实现
 * @class MemoryCacheProvider
 * @implements CacheProvider
 * @since 1.0.0
 */
export class MemoryCacheProvider implements CacheProvider {
  private cache = new Map<string, CacheEntry>();
  private listeners = new Map<CacheEventType, Set<CacheEventListener>>();
  private stats: CacheStats = {
    totalEntries: 0,
    hits: 0,
    misses: 0,
    hitRate: 0,
    totalSize: 0,
    averageAccessTime: 0,
    topKeys: [],
  };
  private cleanupTimer?: NodeJS.Timeout;

  constructor(private options: MemoryCacheOptions) {
    this.initializeCleanupTimer();
  }

  /**
   * 获取缓存值
   *
   * @description 从内存缓存中获取配置值
   * @param key 缓存键
   * @returns 配置记录或 null
   * @since 1.0.0
   */
  public async get(key: string): Promise<ConfigRecord | null> {
    const startTime = Date.now();

    try {
      const entry = this.cache.get(key);

      if (!entry) {
        this.stats.misses++;
        this.updateHitRate();
        this.emitEvent("miss", key);
        return null;
      }

      // 检查是否过期
      if (entry.expiresAt && entry.expiresAt < new Date()) {
        this.cache.delete(key);
        this.stats.misses++;
        this.updateHitRate();
        this.emitEvent("expire", key);
        return null;
      }

      // 更新访问统计
      entry.accessCount++;
      entry.lastAccessedAt = new Date();
      this.stats.hits++;
      this.updateHitRate();
      this.updateAverageAccessTime(Date.now() - startTime);
      this.emitEvent("hit", key);

      return entry.value;
    } catch (error) {
      this.emitEvent("miss", key, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return null;
    }
  }

  /**
   * 设置缓存值
   *
   * @description 将配置值存储到内存缓存中
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
    try {
      const now = new Date();
      const expiresAt = ttl ? new Date(now.getTime() + ttl) : undefined;
      const size = this.calculateSize(value);

      // 检查内存限制
      if (
        this.options.maxMemory &&
        this.stats.totalSize + size > this.options.maxMemory
      ) {
        await this.evictLeastRecentlyUsed();
      }

      const entry: CacheEntry = {
        key,
        value,
        createdAt: now,
        expiresAt,
        accessCount: 0,
        lastAccessedAt: now,
        size,
      };

      this.cache.set(key, entry);
      this.stats.totalEntries = this.cache.size;
      this.stats.totalSize += size;
      this.emitEvent("set", key, { size, ttl });
    } catch (error) {
      this.emitEvent("set", key, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * 删除缓存值
   *
   * @description 从内存缓存中删除指定的配置值
   * @param key 缓存键
   * @returns 是否删除成功
   * @since 1.0.0
   */
  public async delete(key: string): Promise<boolean> {
    try {
      const entry = this.cache.get(key);
      if (entry) {
        this.stats.totalSize -= entry.size;
        this.cache.delete(key);
        this.stats.totalEntries = this.cache.size;
        this.emitEvent("delete", key);
        return true;
      }
      return false;
    } catch (error) {
      this.emitEvent("delete", key, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return false;
    }
  }

  /**
   * 清空所有缓存
   *
   * @description 清空内存缓存中的所有配置值
   * @since 1.0.0
   */
  public async clear(): Promise<void> {
    try {
      this.cache.clear();
      this.stats = {
        totalEntries: 0,
        hits: 0,
        misses: 0,
        hitRate: 0,
        totalSize: 0,
        averageAccessTime: 0,
        topKeys: [],
      };
      this.emitEvent("clear", "all");
    } catch (error) {
      this.emitEvent("clear", "all", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
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
    const entry = this.cache.get(key);
    if (!entry) return false;

    // 检查是否过期
    if (entry.expiresAt && entry.expiresAt < new Date()) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * 获取缓存统计信息
   *
   * @description 获取内存缓存的统计信息
   * @returns 缓存统计信息
   * @since 1.0.0
   */
  public async getStats(): Promise<CacheStats> {
    // 更新最常访问的键
    this.updateTopKeys();
    return { ...this.stats };
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
  }

  /**
   * 初始化清理定时器
   *
   * @description 初始化过期缓存的清理定时器
   * @private
   * @since 1.0.0
   */
  private initializeCleanupTimer(): void {
    if (this.options.cleanupInterval && this.options.cleanupInterval > 0) {
      this.cleanupTimer = setInterval(() => {
        this.cleanupExpiredEntries();
      }, this.options.cleanupInterval);
    }
  }

  /**
   * 清理过期条目
   *
   * @description 清理过期的缓存条目
   * @private
   * @since 1.0.0
   */
  private cleanupExpiredEntries(): void {
    const now = new Date();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt && entry.expiresAt < now) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.cache.delete(key);
      this.emitEvent("expire", key);
    }

    if (expiredKeys.length > 0) {
      this.stats.totalEntries = this.cache.size;
    }
  }

  /**
   * 驱逐最近最少使用的条目
   *
   * @description 当内存不足时驱逐最近最少使用的缓存条目
   * @private
   * @since 1.0.0
   */
  private async evictLeastRecentlyUsed(): Promise<void> {
    const entries = Array.from(this.cache.entries())
      .map(([key, entry]) => ({ key, entry }))
      .sort(
        (a, b) =>
          a.entry.lastAccessedAt.getTime() - b.entry.lastAccessedAt.getTime(),
      );

    // 移除最旧的 25% 条目
    const toRemove = Math.ceil(entries.length * 0.25);
    for (let i = 0; i < toRemove; i++) {
      const item = entries[i];
      if (!item) continue;
      const { key, entry } = item;
      this.cache.delete(key);
      this.stats.totalSize -= entry.size;
    }

    this.stats.totalEntries = this.cache.size;
  }

  /**
   * 计算对象大小
   *
   * @description 计算配置对象的内存大小
   * @param value 配置对象
   * @returns 大小（字节）
   * @private
   * @since 1.0.0
   */
  private calculateSize(value: ConfigRecord): number {
    return JSON.stringify(value).length * 2; // 粗略估算
  }

  /**
   * 更新命中率
   *
   * @description 更新缓存命中率统计
   * @private
   * @since 1.0.0
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  /**
   * 更新平均访问时间
   *
   * @description 更新平均访问时间统计
   * @param accessTime 访问时间
   * @private
   * @since 1.0.0
   */
  private updateAverageAccessTime(accessTime: number): void {
    const totalAccesses = this.stats.hits + this.stats.misses;
    this.stats.averageAccessTime =
      (this.stats.averageAccessTime * (totalAccesses - 1) + accessTime) /
      totalAccesses;
  }

  /**
   * 更新最常访问的键
   *
   * @description 更新最常访问的键统计
   * @private
   * @since 1.0.0
   */
  private updateTopKeys(): void {
    const entries = Array.from(this.cache.entries())
      .map(([key, entry]) => ({ key, count: entry.accessCount }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    this.stats.topKeys = entries;
  }

  /**
   * 发送事件
   *
   * @description 发送缓存事件给监听器
   * @param type 事件类型
   * @param key 缓存键
   * @param data 额外数据
   * @private
   * @since 1.0.0
   */
  private emitEvent(
    type: CacheEventType,
    key: string,
    data?: Record<string, unknown>,
  ): void {
    const event: CacheEvent = {
      type,
      key,
      timestamp: new Date(),
      data,
    };

    const listeners = this.listeners.get(type);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch (error) {
          const logger = ConfigLogger.getInstance();
          logger.error("缓存事件监听器错误", {
            event: event.type,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          });
        }
      }
    }
  }

  /**
   * 销毁缓存提供者
   *
   * @description 清理资源并销毁缓存提供者
   * @since 1.0.0
   */
  public destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.cache.clear();
    this.listeners.clear();
  }
}

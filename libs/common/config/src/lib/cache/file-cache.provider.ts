/**
 * 文件缓存提供者
 *
 * @description 基于文件系统的配置缓存实现
 * @author HL8 SAAS Platform Team
 * @since 1.0.0
 */

import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";
import { CacheEventType } from "../constants.js";
import { ConfigLogger } from "../services/config-logger.service.js";
import {
  CacheEntry,
  CacheEvent,
  CacheEventListener,
  CacheProvider,
  CacheStats,
  FileCacheOptions,
} from "../types/cache.types.js";
import { ConfigRecord } from "../types/config.types.js";

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);
const mkdir = promisify(fs.mkdir);
const stat = promisify(fs.stat);
const readdir = promisify(fs.readdir);

/**
 * 文件缓存提供者类
 *
 * @description 基于文件系统的配置缓存实现
 * @class FileCacheProvider
 * @implements CacheProvider
 * @since 1.0.0
 */
export class FileCacheProvider implements CacheProvider {
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
  private cacheDir: string;

  constructor(private options: FileCacheOptions) {
    this.cacheDir =
      options.cacheDir || path.join(process.cwd(), ".cache", "config");
    this.initializeCacheDirectory();
  }

  /**
   * 获取缓存值
   *
   * @description 从文件缓存中获取配置值
   * @param key 缓存键
   * @returns 配置记录或 null
   * @since 1.0.0
   */
  public async get(key: string): Promise<ConfigRecord | null> {
    const startTime = Date.now();

    try {
      const filePath = this.getFilePath(key);

      if (!(await this.fileExists(filePath))) {
        this.stats.misses++;
        this.updateHitRate();
        this.emitEvent("miss", key);
        return null;
      }

      const entry = await this.readCacheEntry(filePath);

      if (!entry) {
        this.stats.misses++;
        this.updateHitRate();
        this.emitEvent("miss", key);
        return null;
      }

      // 检查是否过期
      if (entry.expiresAt && entry.expiresAt < new Date()) {
        await this.delete(key);
        this.stats.misses++;
        this.updateHitRate();
        this.emitEvent("expire", key);
        return null;
      }

      // 更新访问统计
      entry.accessCount++;
      entry.lastAccessedAt = new Date();
      await this.writeCacheEntry(filePath, entry);

      this.stats.hits++;
      this.updateHitRate();
      this.updateAverageAccessTime(Date.now() - startTime);
      this.emitEvent("hit", key);

      return entry.value;
    } catch (_error) {
      this.emitEvent("miss", key, {
        error: _error instanceof Error ? _error.message : "Unknown error",
      });
      return null;
    }
  }

  /**
   * 设置缓存值
   *
   * @description 将配置值存储到文件缓存中
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
      const filePath = this.getFilePath(key);
      const now = new Date();
      const expiresAt = ttl ? new Date(now.getTime() + ttl) : undefined;
      const size = this.calculateSize(value);

      const entry: CacheEntry = {
        key,
        value,
        createdAt: now,
        expiresAt,
        accessCount: 0,
        lastAccessedAt: now,
        size,
      };

      await this.writeCacheEntry(filePath, entry);
      this.updateStats();
      this.emitEvent("set", key, { size, ttl });
    } catch (_error) {
      this.emitEvent("set", key, {
        error: _error instanceof Error ? _error.message : "Unknown error",
      });
      throw _error;
    }
  }

  /**
   * 删除缓存值
   *
   * @description 从文件缓存中删除指定的配置值
   * @param key 缓存键
   * @returns 是否删除成功
   * @since 1.0.0
   */
  public async delete(key: string): Promise<boolean> {
    try {
      const filePath = this.getFilePath(key);

      if (await this.fileExists(filePath)) {
        await unlink(filePath);
        this.updateStats();
        this.emitEvent("delete", key);
        return true;
      }

      return false;
    } catch (_error) {
      this.emitEvent("delete", key, {
        error: _error instanceof Error ? _error.message : "Unknown error",
      });
      return false;
    }
  }

  /**
   * 清空所有缓存
   *
   * @description 清空文件缓存中的所有配置值
   * @since 1.0.0
   */
  public async clear(): Promise<void> {
    try {
      const files = await readdir(this.cacheDir);

      for (const file of files) {
        if (file.endsWith(".cache")) {
          await unlink(path.join(this.cacheDir, file));
        }
      }

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
    } catch (_error) {
      this.emitEvent("clear", "all", {
        error: _error instanceof Error ? _error.message : "Unknown error",
      });
      throw _error;
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
    try {
      const filePath = this.getFilePath(key);

      if (!(await this.fileExists(filePath))) {
        return false;
      }

      const entry = await this.readCacheEntry(filePath);
      if (!entry) return false;

      // 检查是否过期
      if (entry.expiresAt && entry.expiresAt < new Date()) {
        await this.delete(key);
        return false;
      }

      return true;
    } catch (_error) {
      return false;
    }
  }

  /**
   * 获取缓存统计信息
   *
   * @description 获取文件缓存的统计信息
   * @returns 缓存统计信息
   * @since 1.0.0
   */
  public async getStats(): Promise<CacheStats> {
    await this.updateStats();
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
   * 初始化缓存目录
   *
   * @description 创建缓存目录
   * @private
   * @since 1.0.0
   */
  private async initializeCacheDirectory(): Promise<void> {
    try {
      await mkdir(this.cacheDir, {
        recursive: true,
        mode: this.options.fileMode || 0o755,
      });
    } catch (_error) {
      if ((_error as NodeJS.ErrnoException).code !== "EEXIST") {
        throw _error;
      }
    }
  }

  /**
   * 获取文件路径
   *
   * @description 根据缓存键生成文件路径
   * @param key 缓存键
   * @returns 文件路径
   * @private
   * @since 1.0.0
   */
  private getFilePath(key: string): string {
    const hash = crypto.createHash("md5").update(key).digest("hex");
    const fileName = `${hash}.cache`;
    return path.join(this.cacheDir, fileName);
  }

  /**
   * 检查文件是否存在
   *
   * @description 检查文件是否存在
   * @param filePath 文件路径
   * @returns 是否存在
   * @private
   * @since 1.0.0
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await stat(filePath);
      return true;
    } catch (_error) {
      return false;
    }
  }

  /**
   * 读取缓存条目
   *
   * @description 从文件中读取缓存条目
   * @param filePath 文件路径
   * @returns 缓存条目或 null
   * @private
   * @since 1.0.0
   */
  private async readCacheEntry(filePath: string): Promise<CacheEntry | null> {
    try {
      const data = await readFile(filePath, "utf8");
      const entry = JSON.parse(data) as CacheEntry;

      // 转换日期字符串为 Date 对象
      entry.createdAt = new Date(entry.createdAt);
      entry.lastAccessedAt = new Date(entry.lastAccessedAt);
      if (entry.expiresAt) {
        entry.expiresAt = new Date(entry.expiresAt);
      }

      return entry;
    } catch (_error) {
      return null;
    }
  }

  /**
   * 写入缓存条目
   *
   * @description 将缓存条目写入文件
   * @param filePath 文件路径
   * @param entry 缓存条目
   * @private
   * @since 1.0.0
   */
  private async writeCacheEntry(
    filePath: string,
    entry: CacheEntry,
  ): Promise<void> {
    const data = JSON.stringify(entry);
    await writeFile(filePath, data, "utf8");
  }

  /**
   * 计算对象大小
   *
   * @description 计算配置对象的大小
   * @param value 配置对象
   * @returns 大小（字节）
   * @private
   * @since 1.0.0
   */
  private calculateSize(value: ConfigRecord): number {
    return JSON.stringify(value).length * 2; // 粗略估算
  }

  /**
   * 更新统计信息
   *
   * @description 更新缓存统计信息
   * @private
   * @since 1.0.0
   */
  private async updateStats(): Promise<void> {
    try {
      const files = await readdir(this.cacheDir);
      const cacheFiles = files.filter((file) => file.endsWith(".cache"));

      this.stats.totalEntries = cacheFiles.length;

      let totalSize = 0;
      const topKeys: Array<{ key: string; count: number }> = [];

      for (const file of cacheFiles) {
        const filePath = path.join(this.cacheDir, file);
        const entry = await this.readCacheEntry(filePath);

        if (entry) {
          totalSize += entry.size;
          topKeys.push({ key: entry.key, count: entry.accessCount });
        }
      }

      this.stats.totalSize = totalSize;
      this.stats.topKeys = topKeys
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    } catch (_error) {
      // 忽略统计更新错误
    }
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
        } catch (_error) {
          const logger = ConfigLogger.getInstance();
          logger.error("缓存事件监听器错误", {
            event: event.type,
            error: _error instanceof Error ? _error.message : String(_error),
            stack: _error instanceof Error ? _error.stack : undefined,
          });
        }
      }
    }
  }
}

/**
 * 缓存类型定义
 *
 * @description 配置缓存相关的类型定义
 * @author HL8 SAAS Platform Team
 * @since 1.0.0
 */

import { ConfigRecord } from "./config.types.js";

/**
 * 缓存策略枚举
 *
 * @description 定义缓存策略的类型
 * @enum CacheStrategy
 * @since 1.0.0
 */
export enum CacheStrategy {
  /** 内存缓存 */
  MEMORY = "memory",
  /** 文件缓存 */
  FILE = "file",
  /** Redis 缓存 */
  REDIS = "redis",
  /** 无缓存 */
  NONE = "none",
}

/**
 * 缓存选项接口
 *
 * @description 定义缓存选项的接口
 * @interface CacheOptions
 * @since 1.0.0
 */
export interface CacheOptions {
  /** 缓存策略 */
  strategy?: CacheStrategy;
  /** 缓存键前缀 */
  keyPrefix?: string;
  /** 缓存过期时间（毫秒） */
  ttl?: number;
  /** 最大缓存大小 */
  maxSize?: number;
  /** 是否启用缓存 */
  enabled?: boolean;
  /** 缓存键生成器 */
  keyGenerator?: (source: string) => string;
  /** 缓存目录（文件缓存使用） */
  cacheDir?: string;
}

/**
 * 内存缓存选项接口
 *
 * @description 定义内存缓存的选项
 * @interface MemoryCacheOptions
 * @extends CacheOptions
 * @since 1.0.0
 */
export interface MemoryCacheOptions extends CacheOptions {
  /** 缓存策略 */
  strategy: CacheStrategy.MEMORY;
  /** 最大内存使用量（字节） */
  maxMemory?: number;
  /** 清理间隔（毫秒） */
  cleanupInterval?: number;
}

/**
 * 文件缓存选项接口
 *
 * @description 定义文件缓存的选项
 * @interface FileCacheOptions
 * @extends CacheOptions
 * @since 1.0.0
 */
export interface FileCacheOptions extends CacheOptions {
  /** 缓存策略 */
  strategy: CacheStrategy.FILE;
  /** 缓存目录 */
  cacheDir?: string;
  /** 是否压缩缓存文件 */
  compress?: boolean;
  /** 文件权限 */
  fileMode?: number;
}

/**
 * Redis 缓存选项接口
 *
 * @description 定义 Redis 缓存的选项
 * @interface RedisCacheOptions
 * @extends CacheOptions
 * @since 1.0.0
 */
export interface RedisCacheOptions extends CacheOptions {
  /** 缓存策略 */
  strategy: CacheStrategy.REDIS;
  /** Redis 连接 URL */
  url?: string;
  /** Redis 主机 */
  host?: string;
  /** Redis 端口 */
  port?: number;
  /** Redis 密码 */
  password?: string;
  /** Redis 数据库 */
  db?: number;
  /** 连接池大小 */
  poolSize?: number;
}

/**
 * 缓存条目接口
 *
 * @description 定义缓存条目的结构
 * @interface CacheEntry
 * @since 1.0.0
 */
export interface CacheEntry {
  /** 缓存键 */
  key: string;
  /** 缓存值 */
  value: ConfigRecord;
  /** 创建时间 */
  createdAt: Date;
  /** 过期时间 */
  expiresAt?: Date;
  /** 访问次数 */
  accessCount: number;
  /** 最后访问时间 */
  lastAccessedAt: Date;
  /** 缓存大小（字节） */
  size: number;
}

/**
 * 缓存统计信息接口
 *
 * @description 定义缓存统计信息的结构
 * @interface CacheStats
 * @since 1.0.0
 */
export interface CacheStats {
  /** 总缓存条目数 */
  totalEntries: number;
  /** 缓存命中次数 */
  hits: number;
  /** 缓存未命中次数 */
  misses: number;
  /** 缓存命中率 */
  hitRate: number;
  /** 总缓存大小（字节） */
  totalSize: number;
  /** 平均访问时间（毫秒） */
  averageAccessTime: number;
  /** 最常访问的键 */
  topKeys: Array<{ key: string; count: number }>;
}

/**
 * 缓存事件接口
 *
 * @description 定义缓存事件的结构
 * @interface CacheEvent
 * @since 1.0.0
 */
export interface CacheEvent {
  /** 事件类型 */
  type: string;
  /** 缓存键 */
  key: string;
  /** 事件时间 */
  timestamp: Date;
  /** 额外数据 */
  data?: Record<string, unknown>;
}

/**
 * 缓存监听器函数类型
 *
 * @description 定义缓存监听器函数的类型
 * @type CacheEventListener
 * @since 1.0.0
 */
export type CacheEventListener = (event: CacheEvent) => void;

/**
 * 缓存提供者接口
 *
 * @description 定义缓存提供者的接口
 * @interface CacheProvider
 * @since 1.0.0
 */
export interface CacheProvider {
  /** 获取缓存值 */
  get(key: string): Promise<ConfigRecord | null>;
  /** 设置缓存值 */
  set(key: string, value: ConfigRecord, ttl?: number): Promise<void>;
  /** 删除缓存值 */
  delete(key: string): Promise<boolean>;
  /** 清空所有缓存 */
  clear(): Promise<void>;
  /** 检查缓存是否存在 */
  has(key: string): Promise<boolean>;
  /** 获取缓存统计信息 */
  getStats(): Promise<CacheStats>;
  /** 添加事件监听器 */
  on(event: string, listener: CacheEventListener): void;
  /** 移除事件监听器 */
  off(event: string, listener: CacheEventListener): void;
}

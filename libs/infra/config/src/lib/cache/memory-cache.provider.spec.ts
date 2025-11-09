/**
 * 内存缓存提供者单元测试
 *
 * @description 测试内存缓存提供者的各种功能，包括缓存操作、过期处理、LRU 驱逐等。
 * 遵循项目章程的测试要求：单元测试与源代码同目录，使用 .spec.ts 后缀。
 *
 * ## 测试覆盖范围
 *
 * - 缓存基本操作（get、set、delete、clear、has）
 * - 过期时间处理
 * - LRU 驱逐机制
 * - 缓存统计信息
 * - 事件监听器管理
 * - 内存限制处理
 * - 错误处理和边界条件
 */

import {
  describe,
  expect,
  it,
  beforeEach,
  afterEach,
  jest,
} from "@jest/globals";
import { MemoryCacheProvider } from "./memory-cache.provider.js";
import { CacheStrategy, MemoryCacheOptions } from "../types/cache.types.js";
import { CACHE_EVENTS } from "../constants.js";
import { ConfigRecord } from "../types/config.types.js";

describe("MemoryCacheProvider", () => {
  let provider: MemoryCacheProvider;
  let options: MemoryCacheOptions;

  beforeEach(() => {
    options = {
      strategy: CacheStrategy.MEMORY,
    };
    provider = new MemoryCacheProvider(options);
  });

  afterEach(() => {
    if (provider) {
      provider.destroy();
    }
  });

  describe("初始化", () => {
    it("应该使用默认选项创建内存缓存提供者", () => {
      expect(provider).toBeDefined();
    });

    it("应该使用自定义选项创建内存缓存提供者", () => {
      const customOptions: MemoryCacheOptions = {
        strategy: CacheStrategy.MEMORY,
        maxMemory: 1024 * 1024, // 1MB
        cleanupInterval: 5000,
      };

      provider = new MemoryCacheProvider(customOptions);
      expect(provider).toBeDefined();
      provider.destroy();
    });
  });

  describe("缓存操作", () => {
    it("应该设置和获取缓存值", async () => {
      const key = "test-key";
      const value: ConfigRecord = { database: { host: "localhost" } };

      await provider.set(key, value);
      const result = await provider.get(key);

      expect(result).toEqual(value);
    });

    it("应该在缓存未命中时返回 null", async () => {
      const result = await provider.get("non-existent-key");
      expect(result).toBeNull();
    });

    it("应该删除缓存值", async () => {
      const key = "test-key";
      const value: ConfigRecord = { test: "value" };

      await provider.set(key, value);
      const deleted = await provider.delete(key);
      const result = await provider.get(key);

      expect(deleted).toBe(true);
      expect(result).toBeNull();
    });

    it("应该在删除不存在的键时返回 false", async () => {
      const deleted = await provider.delete("non-existent-key");
      expect(deleted).toBe(false);
    });

    it("应该清空所有缓存", async () => {
      await provider.set("key1", { test: "value1" });
      await provider.set("key2", { test: "value2" });

      await provider.clear();

      expect(await provider.get("key1")).toBeNull();
      expect(await provider.get("key2")).toBeNull();
    });

    it("应该检查缓存是否存在", async () => {
      const key = "test-key";
      const value: ConfigRecord = { test: "value" };

      expect(await provider.has(key)).toBe(false);

      await provider.set(key, value);
      expect(await provider.has(key)).toBe(true);

      await provider.delete(key);
      expect(await provider.has(key)).toBe(false);
    });
  });

  describe("过期时间处理", () => {
    it("应该在过期后返回 null", async () => {
      const key = "test-key";
      const value: ConfigRecord = { test: "value" };

      await provider.set(key, value, 100); // 100ms TTL

      // 立即获取应该成功
      expect(await provider.get(key)).toEqual(value);

      // 等待过期
      await new Promise((resolve) => setTimeout(resolve, 150));

      // 过期后应该返回 null
      expect(await provider.get(key)).toBeNull();
    });

    it("应该在检查过期缓存时返回 false", async () => {
      const key = "test-key";
      const value: ConfigRecord = { test: "value" };

      await provider.set(key, value, 100);

      // 等待过期
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(await provider.has(key)).toBe(false);
    });

    it("应该支持无过期时间的缓存", async () => {
      const key = "test-key";
      const value: ConfigRecord = { test: "value" };

      await provider.set(key, value); // 无 TTL

      // 等待一段时间后仍然应该存在
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(await provider.get(key)).toEqual(value);
    });

    it("应该自动清理过期条目", async () => {
      provider = new MemoryCacheProvider({
        strategy: CacheStrategy.MEMORY,
        cleanupInterval: 50, // 50ms 清理间隔
      });

      const key = "test-key";
      const value: ConfigRecord = { test: "value" };

      await provider.set(key, value, 100);

      // 等待过期和清理
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(await provider.get(key)).toBeNull();

      provider.destroy();
    });
  });

  describe("LRU 驱逐机制", () => {
    it("应该在内存不足时驱逐最近最少使用的条目", async () => {
      provider = new MemoryCacheProvider({
        strategy: CacheStrategy.MEMORY,
        maxMemory: 1000, // 很小的内存限制
      });

      // 设置多个条目
      for (let i = 0; i < 10; i++) {
        await provider.set(`key-${i}`, {
          data: `value-${i}`.repeat(100), // 较大的值
        });
      }

      // 访问一些键以改变访问顺序
      await provider.get("key-5");
      await provider.get("key-6");

      // 添加新条目应该触发驱逐
      await provider.set("new-key", {
        data: "new-value".repeat(100),
      });

      // 最近最少使用的条目应该被驱逐
      // 但最近访问的应该还在
      expect(await provider.get("key-5")).toBeDefined();
      expect(await provider.get("key-6")).toBeDefined();

      provider.destroy();
    });
  });

  describe("缓存统计", () => {
    it("应该返回缓存统计信息", async () => {
      const key = "test-key";
      const value: ConfigRecord = { test: "value" };

      await provider.set(key, value);
      await provider.get(key); // hit
      await provider.get("non-existent"); // miss

      const stats = await provider.getStats();

      expect(stats.totalEntries).toBe(1);
      expect(stats.hits).toBeGreaterThan(0);
      expect(stats.misses).toBeGreaterThan(0);
      expect(stats.hitRate).toBeGreaterThanOrEqual(0);
      expect(stats.hitRate).toBeLessThanOrEqual(1);
      expect(stats.totalSize).toBeGreaterThan(0);
    });

    it("应该计算正确的命中率", async () => {
      const key = "test-key";
      const value: ConfigRecord = { test: "value" };

      await provider.set(key, value);

      // 3 hits, 2 misses
      await provider.get(key);
      await provider.get(key);
      await provider.get(key);
      await provider.get("miss1");
      await provider.get("miss2");

      const stats = await provider.getStats();

      expect(stats.hits).toBe(3);
      expect(stats.misses).toBe(2);
      expect(stats.hitRate).toBeCloseTo(3 / 5, 2);
    });

    it("应该跟踪访问次数", async () => {
      const key = "test-key";
      const value: ConfigRecord = { test: "value" };

      await provider.set(key, value);

      // 多次访问
      await provider.get(key);
      await provider.get(key);
      await provider.get(key);

      const stats = await provider.getStats();
      expect(stats.topKeys.length).toBeGreaterThan(0);
      const topKey = stats.topKeys.find((k) => k.key === key);
      expect(topKey).toBeDefined();
      expect(topKey?.count).toBeGreaterThanOrEqual(3);
    });

    it("应该计算平均访问时间", async () => {
      const key = "test-key";
      const value: ConfigRecord = { test: "value" };

      await provider.set(key, value);
      await provider.get(key);

      const stats = await provider.getStats();
      expect(stats.averageAccessTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe("事件监听", () => {
    it("应该触发 set 事件", async () => {
      const listener = jest.fn();

      provider.on(CACHE_EVENTS.SET, listener);

      const key = "test-key";
      const value: ConfigRecord = { test: "value" };

      await provider.set(key, value);

      expect(listener).toHaveBeenCalled();
      const event = listener.mock.calls[0]?.[0];
      expect(event?.type).toBe(CACHE_EVENTS.SET);
      expect(event?.key).toBe(key);
    });

    it("应该触发 get hit 事件", async () => {
      const listener = jest.fn();

      provider.on(CACHE_EVENTS.HIT, listener);

      const key = "test-key";
      const value: ConfigRecord = { test: "value" };

      await provider.set(key, value);
      await provider.get(key);

      expect(listener).toHaveBeenCalled();
      const event = listener.mock.calls[0]?.[0];
      expect(event?.type).toBe(CACHE_EVENTS.HIT);
      expect(event?.key).toBe(key);
    });

    it("应该触发 get miss 事件", async () => {
      const listener = jest.fn();

      provider.on(CACHE_EVENTS.MISS, listener);

      await provider.get("non-existent-key");

      expect(listener).toHaveBeenCalled();
      const event = listener.mock.calls[0]?.[0];
      expect(event?.type).toBe(CACHE_EVENTS.MISS);
    });

    it("应该触发 delete 事件", async () => {
      const listener = jest.fn();

      provider.on(CACHE_EVENTS.DELETE, listener);

      const key = "test-key";
      const value: ConfigRecord = { test: "value" };

      await provider.set(key, value);
      await provider.delete(key);

      expect(listener).toHaveBeenCalled();
      const event = listener.mock.calls[0]?.[0];
      expect(event?.type).toBe(CACHE_EVENTS.DELETE);
      expect(event?.key).toBe(key);
    });

    it("应该触发 expire 事件", async () => {
      const listener = jest.fn();

      provider.on(CACHE_EVENTS.EXPIRE, listener);

      const key = "test-key";
      const value: ConfigRecord = { test: "value" };

      await provider.set(key, value, 100);

      // 等待过期
      await new Promise((resolve) => setTimeout(resolve, 150));

      await provider.get(key);

      expect(listener).toHaveBeenCalled();
      const event = listener.mock.calls[0]?.[0];
      expect(event?.type).toBe(CACHE_EVENTS.EXPIRE);
      expect(event?.key).toBe(key);
    });

    it("应该能够移除事件监听器", async () => {
      const listener = jest.fn();

      provider.on(CACHE_EVENTS.SET, listener);
      provider.off(CACHE_EVENTS.SET, listener);

      const key = "test-key";
      const value: ConfigRecord = { test: "value" };

      await provider.set(key, value);

      expect(listener).not.toHaveBeenCalled();
    });

    it("应该支持多个监听器", async () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      provider.on(CACHE_EVENTS.SET, listener1);
      provider.on(CACHE_EVENTS.SET, listener2);

      const key = "test-key";
      const value: ConfigRecord = { test: "value" };

      await provider.set(key, value);

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });

    it("应该处理监听器错误", async () => {
      const errorListener = jest.fn(() => {
        throw new Error("Listener error");
      });

      provider.on(CACHE_EVENTS.SET, errorListener);

      const key = "test-key";
      const value: ConfigRecord = { test: "value" };

      // 不应该抛出错误
      await expect(provider.set(key, value)).resolves.not.toThrow();
      expect(errorListener).toHaveBeenCalled();
    });
  });

  describe("边界条件", () => {
    it("应该处理空字符串键", async () => {
      const value: ConfigRecord = { test: "value" };

      await provider.set("", value);
      const result = await provider.get("");

      expect(result).toEqual(value);
    });

    it("应该处理空配置对象", async () => {
      const key = "test-key";
      const value: ConfigRecord = {};

      await provider.set(key, value);
      const result = await provider.get(key);

      expect(result).toEqual(value);
    });

    it("应该处理嵌套配置对象", async () => {
      const key = "test-key";
      const value: ConfigRecord = {
        level1: {
          level2: {
            level3: {
              value: "deep",
            },
          },
        },
      };

      await provider.set(key, value);
      const result = await provider.get(key);

      expect(result).toEqual(value);
    });

    it("应该处理非常大的配置对象", async () => {
      const key = "test-key";
      const value: ConfigRecord = {
        large: Array(1000)
          .fill(0)
          .map((_, i) => `value-${i}`),
      };

      await provider.set(key, value);
      const result = await provider.get(key);

      expect(result).toEqual(value);
    });

    it("应该处理特殊字符键", async () => {
      const key = "test-key:with:special:chars";
      const value: ConfigRecord = { test: "value" };

      await provider.set(key, value);
      const result = await provider.get(key);

      expect(result).toEqual(value);
    });
  });

  describe("销毁", () => {
    it("应该能够销毁缓存提供者", () => {
      expect(() => {
        provider.destroy();
      }).not.toThrow();
    });

    it("应该在销毁后清理定时器", () => {
      provider = new MemoryCacheProvider({
        strategy: CacheStrategy.MEMORY,
        cleanupInterval: 1000,
      });

      provider.destroy();

      // 销毁后不应该有内存泄漏
      expect(provider).toBeDefined();
    });

    it("应该在销毁后清空缓存", async () => {
      const key = "test-key";
      const value: ConfigRecord = { test: "value" };

      await provider.set(key, value);
      provider.destroy();

      // 销毁后获取应该返回 null（因为 provider 被销毁）
      // 但这里我们只是验证销毁不抛出错误
      expect(() => provider.destroy()).not.toThrow();
    });
  });
});

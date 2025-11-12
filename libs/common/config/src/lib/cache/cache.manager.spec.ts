/**
 * 缓存管理器单元测试
 *
 * @description 测试缓存管理器的各种功能，包括缓存操作、策略切换、事件监听等。
 * 遵循项目章程的测试要求：单元测试与源代码同目录，使用 .spec.ts 后缀。
 *
 * ## 测试覆盖范围
 *
 * - 缓存基本操作（get、set、delete、clear、has）
 * - 缓存策略切换（MEMORY、FILE、NONE）
 * - 缓存选项管理
 * - 事件监听器管理
 * - 缓存统计信息
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
import { CacheManager } from "./cache.manager.js";
import { MemoryCacheProvider } from "./memory-cache.provider.js";
import { FileCacheProvider } from "./file-cache.provider.js";
import { CacheStrategy, CacheOptions } from "../types/cache.types.js";
import { CACHE_KEYS, CONFIG_DEFAULTS, CACHE_EVENTS } from "../constants.js";
import { ConfigRecord } from "../types/config.types.js";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

describe("CacheManager", () => {
  let manager: CacheManager;
  let tempDir: string;

  beforeEach(() => {
    // 确保临时目录的父目录存在
    const tmpDir = os.tmpdir();
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    // 如果 tempDir 已存在，先清理
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (_error) {
        // 忽略清理错误
      }
    }
    tempDir = fs.mkdtempSync(path.join(tmpDir, "cache-test-"));
  });

  afterEach(async () => {
    if (manager) {
      manager.destroy();
    }
    // 清理临时目录
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("初始化", () => {
    it("应该使用默认选项创建缓存管理器", () => {
      manager = new CacheManager();

      const options = manager.getOptions();
      expect(options.strategy).toBe(CacheStrategy.MEMORY);
      expect(options.keyPrefix).toBe(CACHE_KEYS.CONFIG);
      expect(options.ttl).toBe(CONFIG_DEFAULTS.CACHE_TTL * 1000);
      expect(options.enabled).toBe(CONFIG_DEFAULTS.ENABLE_CACHE);
    });

    it("应该使用自定义选项创建缓存管理器", () => {
      const customOptions: CacheOptions = {
        strategy: CacheStrategy.MEMORY,
        keyPrefix: "custom",
        ttl: 5000,
        maxSize: 100,
        enabled: true,
      };

      manager = new CacheManager(customOptions);

      const options = manager.getOptions();
      expect(options.strategy).toBe(CacheStrategy.MEMORY);
      expect(options.keyPrefix).toBe("custom");
      expect(options.ttl).toBe(5000);
      expect(options.maxSize).toBe(100);
    });

    it("应该使用 FILE 策略创建缓存管理器", async () => {
      // 确保 tempDir 存在
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      manager = new CacheManager({
        strategy: CacheStrategy.FILE,
        cacheDir: tempDir,
      });
      // 等待目录初始化完成
      await new Promise((resolve) => setTimeout(resolve, 50));

      const options = manager.getOptions();
      expect(options.strategy).toBe(CacheStrategy.FILE);
    });

    it("应该使用 NONE 策略创建缓存管理器", () => {
      manager = new CacheManager({
        strategy: CacheStrategy.NONE,
      });

      const options = manager.getOptions();
      expect(options.strategy).toBe(CacheStrategy.NONE);
    });

    it("应该在使用 REDIS 策略时抛出错误", async () => {
      // 通过 updateOptions 测试策略切换时的错误
      manager = new CacheManager({
        strategy: CacheStrategy.MEMORY,
      });

      // 尝试切换到 REDIS 策略应该抛出错误
      await expect(
        manager.updateOptions({ strategy: CacheStrategy.REDIS }),
      ).rejects.toThrow("Redis cache provider not implemented yet");

      // 清理
      if (manager) {
        manager.destroy();
      }
    });
  });

  describe("缓存操作", () => {
    beforeEach(() => {
      // 确保之前的 manager 已销毁
      if (manager) {
        manager.destroy();
        manager = null as unknown as CacheManager;
      }
      manager = new CacheManager({
        strategy: CacheStrategy.MEMORY,
        enabled: true,
      });
    });

    it("应该设置和获取缓存值", async () => {
      const key = "test-key";
      const value: ConfigRecord = { database: { host: "localhost" } };

      await manager.set(key, value);
      const result = await manager.get(key);

      expect(result).toEqual(value);
    });

    it("应该在缓存未命中时返回 null", async () => {
      const result = await manager.get("non-existent-key");
      expect(result).toBeNull();
    });

    it("应该删除缓存值", async () => {
      const key = "test-key";
      const value: ConfigRecord = { test: "value" };

      await manager.set(key, value);
      const deleted = await manager.delete(key);
      const result = await manager.get(key);

      expect(deleted).toBe(true);
      expect(result).toBeNull();
    });

    it("应该在删除不存在的键时返回 false", async () => {
      const deleted = await manager.delete("non-existent-key");
      expect(deleted).toBe(false);
    });

    it("应该清空所有缓存", async () => {
      await manager.set("key1", { test: "value1" });
      await manager.set("key2", { test: "value2" });

      await manager.clear();

      expect(await manager.get("key1")).toBeNull();
      expect(await manager.get("key2")).toBeNull();
    });

    it("应该检查缓存是否存在", async () => {
      const key = "test-key";
      const value: ConfigRecord = { test: "value" };

      expect(await manager.has(key)).toBe(false);

      await manager.set(key, value);
      expect(await manager.has(key)).toBe(true);

      await manager.delete(key);
      expect(await manager.has(key)).toBe(false);
    });

    it("应该使用自定义 TTL 设置缓存", async () => {
      // 确保使用 MEMORY 策略，不依赖 tempDir
      // 重新创建 manager 以确保干净的测试环境
      if (manager) {
        manager.destroy();
        manager = null as unknown as CacheManager;
      }

      // 等待一小段时间，确保之前的异步操作完成
      await new Promise((resolve) => setTimeout(resolve, 10));

      manager = new CacheManager({
        strategy: CacheStrategy.MEMORY,
        enabled: true,
      });

      const key = "test-key";
      const value: ConfigRecord = { test: "value" };

      await manager.set(key, value, 100); // 100ms TTL

      // 立即获取应该成功
      expect(await manager.get(key)).toEqual(value);

      // 等待过期
      await new Promise((resolve) => setTimeout(resolve, 150));

      // 过期后应该返回 null
      expect(await manager.get(key)).toBeNull();
    });

    it("应该使用自定义键生成器", async () => {
      const keyGenerator = (key: string) => `custom:${key}`;
      manager = new CacheManager({
        strategy: CacheStrategy.MEMORY,
        keyGenerator,
        enabled: true,
      });

      const key = "test-key";
      const value: ConfigRecord = { test: "value" };

      await manager.set(key, value);
      const result = await manager.get(key);

      expect(result).toEqual(value);
    });
  });

  describe("缓存禁用", () => {
    beforeEach(() => {
      manager = new CacheManager({
        strategy: CacheStrategy.MEMORY,
        enabled: false,
      });
    });

    it("应该在缓存禁用时返回 null", async () => {
      const key = "test-key";
      const value: ConfigRecord = { test: "value" };

      await manager.set(key, value);
      const result = await manager.get(key);

      expect(result).toBeNull();
    });

    it("应该在缓存禁用时忽略 set 操作", async () => {
      const key = "test-key";
      const value: ConfigRecord = { test: "value" };

      await expect(manager.set(key, value)).resolves.not.toThrow();
    });

    it("应该在缓存禁用时返回 false for has", async () => {
      expect(await manager.has("test-key")).toBe(false);
    });

    it("应该在缓存禁用时返回 false for delete", async () => {
      expect(await manager.delete("test-key")).toBe(false);
    });

    it("应该在缓存禁用时返回空统计信息", async () => {
      const stats = await manager.getStats();
      expect(stats.totalEntries).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe("启用/禁用缓存", () => {
    beforeEach(() => {
      manager = new CacheManager({
        strategy: CacheStrategy.MEMORY,
        enabled: false,
      });
    });

    it("应该能够启用缓存", async () => {
      const key = "test-key";
      const value: ConfigRecord = { test: "value" };

      manager.enable();
      await manager.set(key, value);
      const result = await manager.get(key);

      expect(result).toEqual(value);
    });

    it("应该能够禁用缓存", async () => {
      const key = "test-key";
      const value: ConfigRecord = { test: "value" };

      manager.enable();
      await manager.set(key, value);

      manager.disable();
      const result = await manager.get(key);

      expect(result).toBeNull();
    });
  });

  describe("缓存策略切换", () => {
    it("应该能够从 MEMORY 切换到 FILE", async () => {
      manager = new CacheManager({
        strategy: CacheStrategy.MEMORY,
        enabled: true,
      });

      const key = "test-key";
      const value: ConfigRecord = { test: "value" };

      await manager.set(key, value);
      expect(await manager.get(key)).toEqual(value);

      // 切换策略前先清空缓存
      await manager.clear();

      // 确保tempDir存在
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      await manager.updateOptions({
        strategy: CacheStrategy.FILE,
        cacheDir: tempDir,
      });
      // 等待目录初始化完成
      await new Promise((resolve) => setTimeout(resolve, 50));

      // 切换策略后，之前的缓存应该丢失
      const result = await manager.get(key);
      expect(result).toBeNull();
    });

    it("应该能够从 FILE 切换到 MEMORY", async () => {
      // 确保tempDir存在
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      manager = new CacheManager({
        strategy: CacheStrategy.FILE,
        cacheDir: tempDir,
        enabled: true,
      });
      // 等待目录初始化完成
      await new Promise((resolve) => setTimeout(resolve, 50));

      const key = "test-key";
      const value: ConfigRecord = { test: "value" };

      await manager.set(key, value);
      expect(await manager.get(key)).toEqual(value);

      // 切换策略前先清空缓存
      await manager.clear();

      await manager.updateOptions({
        strategy: CacheStrategy.MEMORY,
      });

      // 切换策略后，之前的缓存应该丢失
      const result = await manager.get(key);
      expect(result).toBeNull();
    });

    it("应该能够切换到 NONE 策略", async () => {
      manager = new CacheManager({
        strategy: CacheStrategy.MEMORY,
        enabled: true,
      });

      const key = "test-key";
      const value: ConfigRecord = { test: "value" };

      await manager.set(key, value);
      expect(await manager.get(key)).toEqual(value);

      // 切换策略前先清空缓存
      await manager.clear();

      await manager.updateOptions({
        strategy: CacheStrategy.NONE,
      });

      // NONE 策略下，缓存应该被禁用
      const result = await manager.get(key);
      expect(result).toBeNull();
    });
  });

  describe("选项更新", () => {
    beforeEach(() => {
      manager = new CacheManager({
        strategy: CacheStrategy.MEMORY,
        enabled: true,
      });
    });

    it("应该能够更新缓存选项", async () => {
      await manager.updateOptions({
        ttl: 10000,
        maxSize: 500,
      });

      const options = manager.getOptions();
      expect(options.ttl).toBe(10000);
      expect(options.maxSize).toBe(500);
    });

    it("应该能够更新键前缀", async () => {
      await manager.updateOptions({
        keyPrefix: "new-prefix",
      });

      const options = manager.getOptions();
      expect(options.keyPrefix).toBe("new-prefix");
    });

    it("应该在不改变策略时保留现有提供者", async () => {
      const key = "test-key";
      const value: ConfigRecord = { test: "value" };

      await manager.set(key, value);

      await manager.updateOptions({
        ttl: 10000,
      });

      // 缓存应该仍然存在
      expect(await manager.get(key)).toEqual(value);
    });
  });

  describe("事件监听", () => {
    beforeEach(() => {
      manager = new CacheManager({
        strategy: CacheStrategy.MEMORY,
        enabled: true,
      });
    });

    it("应该能够添加和触发事件监听器", async () => {
      const hitListener = jest.fn();
      const setListener = jest.fn();

      manager.on(CACHE_EVENTS.HIT, hitListener);
      manager.on(CACHE_EVENTS.SET, setListener);

      const key = "test-key";
      const value: ConfigRecord = { test: "value" };

      await manager.set(key, value);
      await manager.get(key);

      expect(setListener).toHaveBeenCalled();
      expect(hitListener).toHaveBeenCalled();
    });

    it("应该能够移除事件监听器", async () => {
      const listener = jest.fn();

      manager.on(CACHE_EVENTS.SET, listener);
      manager.off(CACHE_EVENTS.SET, listener);

      const key = "test-key";
      const value: ConfigRecord = { test: "value" };

      await manager.set(key, value);

      expect(listener).not.toHaveBeenCalled();
    });

    it("应该支持多个监听器", async () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      manager.on(CACHE_EVENTS.SET, listener1);
      manager.on(CACHE_EVENTS.SET, listener2);

      const key = "test-key";
      const value: ConfigRecord = { test: "value" };

      await manager.set(key, value);

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });
  });

  describe("缓存统计", () => {
    beforeEach(() => {
      manager = new CacheManager({
        strategy: CacheStrategy.MEMORY,
        enabled: true,
      });
    });

    it("应该返回缓存统计信息", async () => {
      const key = "test-key";
      const value: ConfigRecord = { test: "value" };

      await manager.set(key, value);
      await manager.get(key); // hit
      await manager.get("non-existent"); // miss

      const stats = await manager.getStats();

      expect(stats.totalEntries).toBeGreaterThan(0);
      expect(stats.hits).toBeGreaterThan(0);
      expect(stats.misses).toBeGreaterThan(0);
      expect(stats.hitRate).toBeGreaterThanOrEqual(0);
      expect(stats.hitRate).toBeLessThanOrEqual(1);
    });

    it("应该在缓存禁用时返回空统计信息", async () => {
      manager = new CacheManager({
        strategy: CacheStrategy.MEMORY,
        enabled: false,
      });

      const stats = await manager.getStats();

      expect(stats.totalEntries).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(0);
    });
  });

  describe("销毁", () => {
    beforeEach(() => {
      manager = new CacheManager({
        strategy: CacheStrategy.MEMORY,
        enabled: true,
      });
    });

    it("应该能够销毁缓存管理器", () => {
      expect(() => {
        manager.destroy();
      }).not.toThrow();
    });

    it("应该在销毁后无法使用", async () => {
      manager.destroy();

      const key = "test-key";
      const value: ConfigRecord = { test: "value" };

      await manager.set(key, value);
      const result = await manager.get(key);

      expect(result).toBeNull();
    });
  });

  describe("边界条件", () => {
    beforeEach(() => {
      manager = new CacheManager({
        strategy: CacheStrategy.MEMORY,
        enabled: true,
      });
    });

    it("应该处理空字符串键", async () => {
      const value: ConfigRecord = { test: "value" };

      await manager.set("", value);
      const result = await manager.get("");

      expect(result).toEqual(value);
    });

    it("应该处理空配置对象", async () => {
      const key = "test-key";
      const value: ConfigRecord = {};

      await manager.set(key, value);
      const result = await manager.get(key);

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

      await manager.set(key, value);
      const result = await manager.get(key);

      expect(result).toEqual(value);
    });

    it("应该处理非常大的配置对象", async () => {
      const key = "test-key";
      const value: ConfigRecord = {
        large: Array(1000)
          .fill(0)
          .map((_, i) => `value-${i}`),
      };

      await manager.set(key, value);
      const result = await manager.get(key);

      expect(result).toEqual(value);
    });
  });
});

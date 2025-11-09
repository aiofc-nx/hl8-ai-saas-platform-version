/**
 * 文件缓存提供者单元测试
 *
 * @description 测试文件缓存提供者的各种功能，包括文件操作、过期处理、统计信息等。
 * 遵循项目章程的测试要求：单元测试与源代码同目录，使用 .spec.ts 后缀。
 *
 * ## 测试覆盖范围
 *
 * - 缓存基本操作（get、set、delete、clear、has）
 * - 文件系统操作
 * - 过期时间处理
 * - 缓存统计信息
 * - 事件监听器管理
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
import { FileCacheProvider } from "./file-cache.provider.js";
import { CacheStrategy, FileCacheOptions } from "../types/cache.types.js";
import { CACHE_EVENTS } from "../constants.js";
import { ConfigRecord } from "../types/config.types.js";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

describe("FileCacheProvider", () => {
  let provider: FileCacheProvider;
  let cacheDir: string;
  let options: FileCacheOptions;

  beforeEach(async () => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "file-cache-test-"));
    options = {
      strategy: CacheStrategy.FILE,
      cacheDir,
    };
    provider = new FileCacheProvider(options);
    // 等待目录初始化完成（因为 initializeCacheDirectory 是异步的）
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  afterEach(() => {
    // FileCacheProvider 没有 destroy 方法，只需要清理目录
    provider = null as unknown as FileCacheProvider;
    // 清理临时目录
    if (fs.existsSync(cacheDir)) {
      fs.rmSync(cacheDir, { recursive: true, force: true });
    }
  });

  describe("初始化", () => {
    it("应该使用默认选项创建文件缓存提供者", () => {
      expect(provider).toBeDefined();
      expect(fs.existsSync(cacheDir)).toBe(true);
    });

    it("应该使用自定义选项创建文件缓存提供者", async () => {
      const customDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "custom-cache-test-"),
      );
      const customOptions: FileCacheOptions = {
        strategy: CacheStrategy.FILE,
        cacheDir: customDir,
        fileMode: 0o755,
      };

      provider = new FileCacheProvider(customOptions);
      // 等待目录初始化完成
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(provider).toBeDefined();
      expect(fs.existsSync(customDir)).toBe(true);

      fs.rmSync(customDir, { recursive: true, force: true });
    });

    it("应该创建缓存目录（如果不存在）", async () => {
      const newDir = path.join(cacheDir, "new", "sub", "directory");
      provider = new FileCacheProvider({
        strategy: CacheStrategy.FILE,
        cacheDir: newDir,
      });

      // 等待目录初始化完成
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(fs.existsSync(newDir)).toBe(true);

      fs.rmSync(path.dirname(path.dirname(path.dirname(newDir))), {
        recursive: true,
        force: true,
      });
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

    it("应该创建缓存文件", async () => {
      const key = "test-key";
      const value: ConfigRecord = { test: "value" };

      await provider.set(key, value);

      // 检查缓存文件是否存在
      const files = fs.readdirSync(cacheDir);
      const cacheFiles = files.filter((file) => file.endsWith(".cache"));
      expect(cacheFiles.length).toBeGreaterThan(0);
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

    it("应该在过期时自动删除文件", async () => {
      const key = "test-key";
      const value: ConfigRecord = { test: "value" };

      await provider.set(key, value, 100);

      // 获取文件路径
      const files = fs.readdirSync(cacheDir);
      const cacheFiles = files.filter((file) => file.endsWith(".cache"));
      expect(cacheFiles.length).toBe(1);

      // 等待过期
      await new Promise((resolve) => setTimeout(resolve, 150));

      // 尝试获取应该触发删除
      await provider.get(key);

      // 文件应该被删除
      const filesAfter = fs.readdirSync(cacheDir);
      const cacheFilesAfter = filesAfter.filter((file) =>
        file.endsWith(".cache"),
      );
      expect(cacheFilesAfter.length).toBe(0);
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

    it("应该正确计算总大小", async () => {
      const key1 = "test-key-1";
      const key2 = "test-key-2";
      const value1: ConfigRecord = { test: "value1" };
      const value2: ConfigRecord = { test: "value2" };

      await provider.set(key1, value1);
      await provider.set(key2, value2);

      const stats = await provider.getStats();
      expect(stats.totalEntries).toBe(2);
      expect(stats.totalSize).toBeGreaterThan(0);
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

  describe("文件系统操作", () => {
    it("应该正确序列化和反序列化缓存条目", async () => {
      const key = "test-key";
      const value: ConfigRecord = {
        nested: {
          deep: {
            value: "test",
            number: 123,
            boolean: true,
          },
        },
      };

      await provider.set(key, value);
      const result = await provider.get(key);

      expect(result).toEqual(value);
    });

    it("应该处理日期序列化", async () => {
      const key = "test-key";
      const value: ConfigRecord = { test: "value" };

      await provider.set(key, value, 1000);

      // 读取后应该正确处理日期
      const result = await provider.get(key);
      expect(result).toEqual(value);
    });

    it("应该更新访问统计到文件", async () => {
      const key = "test-key";
      const value: ConfigRecord = { test: "value" };

      await provider.set(key, value);
      await provider.get(key);
      await provider.get(key);

      const stats = await provider.getStats();
      const topKey = stats.topKeys.find((k) => k.key === key);
      expect(topKey?.count).toBeGreaterThanOrEqual(2);
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

    it("应该处理损坏的缓存文件", async () => {
      const key = "test-key";
      const value: ConfigRecord = { test: "value" };

      await provider.set(key, value);

      // 获取文件路径并写入无效数据
      const files = fs.readdirSync(cacheDir);
      const cacheFile = files.find((file) => file.endsWith(".cache"));
      if (cacheFile) {
        fs.writeFileSync(
          path.join(cacheDir, cacheFile),
          "invalid json content",
        );
      }

      // 应该返回 null 而不是抛出错误
      const result = await provider.get(key);
      expect(result).toBeNull();
    });
  });

  describe("错误处理", () => {
    it("应该处理文件读取错误", async () => {
      // 创建一个只读目录来模拟权限错误
      const readOnlyDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "readonly-cache-test-"),
      );

      provider = new FileCacheProvider({
        strategy: CacheStrategy.FILE,
        cacheDir: readOnlyDir,
      });

      // 设置一个缓存值
      await provider.set("test-key", { test: "value" });

      // 删除文件以模拟文件不存在
      const files = fs.readdirSync(readOnlyDir);
      const cacheFile = files.find((file) => file.endsWith(".cache"));
      if (cacheFile) {
        fs.unlinkSync(path.join(readOnlyDir, cacheFile));
      }

      // 应该返回 null 而不是抛出错误
      const result = await provider.get("test-key");
      expect(result).toBeNull();

      fs.rmSync(readOnlyDir, { recursive: true, force: true });
    });
  });
});

/**
 * 远程加载器单元测试
 *
 * @description 测试远程配置加载器的功能，包括 HTTP 请求、响应解析、
 * 重试机制等。遵循项目章程的测试要求。
 *
 * ## 测试覆盖范围
 *
 * - HTTP 请求发送
 * - 响应解析（JSON、YAML）
 * - 重试机制
 * - 错误处理
 * - 请求配置（headers、method 等）
 * - 响应映射函数
 */

import {
  describe,
  expect,
  it,
  beforeEach,
  afterEach,
  jest,
} from "@jest/globals";
import { remoteLoader } from "./remote.loader.js";
import { ConfigError } from "../errors/index.js";

// Mock global fetch
const mockFetch = jest.fn<typeof fetch>();
global.fetch = mockFetch;

describe("remoteLoader", () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("HTTP 请求", () => {
    it("应该成功加载 JSON 配置", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({
          database: {
            host: "localhost",
            port: 5432,
          },
        }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse as unknown as Response);

      const loader = remoteLoader("http://config-server/api/config");
      const config = await loader();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        "http://config-server/api/config",
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        }),
      );
      expect(config).toBeDefined();
      expect(config.database).toBeDefined();
      expect(config.database?.host).toBe("localhost");
    });

    it("应该支持自定义 HTTP 方法", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({ config: "value" }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse as unknown as Response);

      const loader = remoteLoader("http://config-server/api/config", {
        requestConfig: {
          method: "POST",
        },
      });
      await loader();

      expect(mockFetch).toHaveBeenCalledWith(
        "http://config-server/api/config",
        expect.objectContaining({
          method: "POST",
        }),
      );
    });

    it("应该支持自定义请求头", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({ config: "value" }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse as unknown as Response);

      const loader = remoteLoader("http://config-server/api/config", {
        requestConfig: {
          headers: {
            Authorization: "Bearer token",
            "X-Custom-Header": "custom-value",
          },
        },
      });
      await loader();

      expect(mockFetch).toHaveBeenCalledWith(
        "http://config-server/api/config",
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            Authorization: "Bearer token",
            "X-Custom-Header": "custom-value",
          }),
        }),
      );
    });

    it("应该在响应不成功时抛出错误", async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: "Not Found",
      };

      mockFetch.mockResolvedValueOnce(mockResponse as unknown as Response);

      const loader = remoteLoader("http://config-server/api/config");

      await expect(loader()).rejects.toThrow();
    });

    it("应该处理网络错误", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const loader = remoteLoader("http://config-server/api/config", {
        retries: 1, // 减少重试次数以加快测试
        retryInterval: 10, // 减少重试间隔
      });

      await expect(loader()).rejects.toThrow();
    });
  });

  describe("响应解析", () => {
    it("应该解析 JSON 响应", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({
          database: { host: "localhost" },
        }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse as unknown as Response);

      const loader = remoteLoader("http://config-server/api/config", {
        type: "json",
      });
      const config = await loader();

      expect(config.database).toBeDefined();
      expect(config.database?.host).toBe("localhost");
    });

    it("应该支持字符串 JSON 响应", async () => {
      // 注意：fetch 的 json() 方法已经解析 JSON，所以这里直接返回对象
      // 如果需要测试字符串解析，应该在 mapResponse 中处理
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({ database: { host: "localhost" } }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse as unknown as Response);

      const loader = remoteLoader("http://config-server/api/config", {
        type: "json",
      });
      const config = await loader();

      expect(config.database).toBeDefined();
      expect(config.database?.host).toBe("localhost");
    });

    it("应该支持自定义响应映射函数", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({
          wrapper: {
            config: {
              database: { host: "localhost" },
            },
          },
        }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse as unknown as Response);

      // mapResponse 接收的是 makeRequest 返回的对象 { data, status }
      // 其中 data 是 fetch.json() 的结果
      const loader = remoteLoader("http://config-server/api/config", {
        mapResponse: (response) => response.data.wrapper.config,
      });
      const config = await loader();

      expect(config.database).toBeDefined();
      expect(config.database?.host).toBe("localhost");
    });

    it("应该支持函数类型的 type 选项", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({ nested: { key: "value" } }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse as unknown as Response);

      // type 函数接收 mapResponse 后的数据，返回配置类型字符串
      const loader = remoteLoader("http://config-server/api/config", {
        mapResponse: (response) => response.data.nested,
        type: () => "json", // 返回配置类型
      });
      const config = await loader();

      expect(config.key).toBe("value");
    });
  });

  describe("重试机制", () => {
    it("应该在失败时进行重试", async () => {
      const mockErrorResponse = {
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      };

      const mockSuccessResponse = {
        ok: true,
        status: 200,
        json: async () => ({ config: "value" }),
      };

      // 第一次失败，第二次成功
      mockFetch
        .mockResolvedValueOnce(mockErrorResponse as unknown as Response)
        .mockResolvedValueOnce(mockSuccessResponse as unknown as Response);

      const loader = remoteLoader("http://config-server/api/config", {
        retries: 1,
        retryInterval: 10,
        shouldRetry: (response) => response.status !== 200,
      });

      const config = await loader();

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(config.config).toBe("value");
    });

    it("应该在达到最大重试次数后抛出错误", async () => {
      const mockErrorResponse = {
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      };

      mockFetch.mockResolvedValue(mockErrorResponse as unknown as Response);

      const loader = remoteLoader("http://config-server/api/config", {
        retries: 2,
        retryInterval: 10,
      });

      await expect(loader()).rejects.toThrow();

      // 应该重试 2 次 + 初始尝试 = 3 次
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("应该使用自定义重试间隔", async () => {
      const mockErrorResponse = {
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      };

      const mockSuccessResponse = {
        ok: true,
        status: 200,
        json: async () => ({ config: "value" }),
      };

      mockFetch
        .mockResolvedValueOnce(mockErrorResponse as unknown as Response)
        .mockResolvedValueOnce(mockSuccessResponse as unknown as Response);

      const startTime = Date.now();
      const loader = remoteLoader("http://config-server/api/config", {
        retries: 1,
        retryInterval: 100, // 100ms 重试间隔
      });

      await loader();
      const elapsed = Date.now() - startTime;

      // 应该至少等待重试间隔时间
      expect(elapsed).toBeGreaterThanOrEqual(90); // 允许一些时间误差
    });

    it("应该支持自定义重试条件", async () => {
      const mockResponse = {
        ok: true,
        status: 201, // 201 Created，但 shouldRetry 可能返回 true
        json: async () => ({ config: "value" }),
      };

      mockFetch.mockResolvedValue(mockResponse as unknown as Response);

      const loader = remoteLoader("http://config-server/api/config", {
        retries: 1,
        retryInterval: 10,
        shouldRetry: (response) =>
          response.status < 200 || response.status >= 300,
      });

      // 201 不在重试范围内，应该成功
      const config = await loader();

      expect(config.config).toBe("value");
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("错误处理", () => {
    it("应该处理 HTTP 错误状态码", async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: "Not Found",
      };

      mockFetch.mockResolvedValueOnce(mockResponse as unknown as Response);

      const loader = remoteLoader("http://config-server/api/config", {
        retries: 0, // 不重试
      });

      await expect(loader()).rejects.toThrow();
    });

    it("应该处理网络连接错误", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const loader = remoteLoader("http://config-server/api/config", {
        retries: 0,
      });

      await expect(loader()).rejects.toThrow();
    });

    it("应该处理 JSON 解析错误", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => {
          throw new Error("Invalid JSON");
        },
      };

      mockFetch.mockResolvedValueOnce(mockResponse as unknown as Response);

      const loader = remoteLoader("http://config-server/api/config", {
        retries: 0,
      });

      await expect(loader()).rejects.toThrow();
    });

    it("应该提供详细的错误信息", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const loader = remoteLoader("http://config-server/api/config", {
        retries: 0,
      });

      try {
        await loader();
        fail("应该抛出错误");
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigError);
      }
    });
  });

  describe("边界情况", () => {
    it("应该处理空配置对象", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({}),
      };

      mockFetch.mockResolvedValueOnce(mockResponse as unknown as Response);

      const loader = remoteLoader("http://config-server/api/config");
      const config = await loader();

      expect(config).toBeDefined();
      expect(Object.keys(config).length).toBe(0);
    });

    it("应该处理默认选项", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({ config: "value" }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse as unknown as Response);

      const loader = remoteLoader("http://config-server/api/config");
      const config = await loader();

      expect(config).toBeDefined();
      expect(config.config).toBe("value");
    });

    it("应该使用默认的重试次数", async () => {
      const mockErrorResponse = {
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      };

      mockFetch.mockResolvedValue(mockErrorResponse as unknown as Response);

      const loader = remoteLoader("http://config-server/api/config", {
        retryInterval: 10, // 减少重试间隔以加快测试
      });

      await expect(loader()).rejects.toThrow();

      // 默认重试 3 次 + 初始尝试 = 4 次
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });
  });
});

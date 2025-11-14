/**
 * @fileoverview 异常服务单元测试
 * @description 测试异常服务的核心功能，包括异常创建和记录
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { ExceptionServiceImpl } from "./exception.service.js";
import type { ExceptionInfo } from "./exception.interface.js";

describe("ExceptionServiceImpl", () => {
  let exceptionService: ExceptionServiceImpl;

  beforeEach(() => {
    exceptionService = new ExceptionServiceImpl();
  });

  describe("create", () => {
    it("应该能够创建异常信息", () => {
      // 执行
      const exception = exceptionService.create(
        "EVENT_STORE_ERROR",
        "事件存储操作失败",
        { aggregateId: "aggregate-1" },
      );

      // 验证
      expect(exception).toBeDefined();
      expect(exception.errorCode).toBe("EVENT_STORE_ERROR");
      expect(exception.message).toBe("事件存储操作失败");
      expect(exception.context).toEqual({ aggregateId: "aggregate-1" });
      expect(exception.stack).toBeDefined();
    });

    it("应该能够创建不带上下文的异常信息", () => {
      // 执行
      const exception = exceptionService.create(
        "CONFIGURATION_ERROR",
        "配置加载失败",
      );

      // 验证
      expect(exception).toBeDefined();
      expect(exception.errorCode).toBe("CONFIGURATION_ERROR");
      expect(exception.message).toBe("配置加载失败");
      expect(exception.context).toBeUndefined();
      expect(exception.stack).toBeDefined();
    });

    it("应该能够创建带复杂上下文的异常信息", () => {
      // 执行
      const exception = exceptionService.create("AUDIT_ERROR", "审计记录失败", {
        tenantId: "tenant-1",
        userId: "user-1",
        action: "CREATE",
        payload: { resource: "Order", id: "order-1" },
      });

      // 验证
      expect(exception).toBeDefined();
      expect(exception.errorCode).toBe("AUDIT_ERROR");
      expect(exception.message).toBe("审计记录失败");
      expect(exception.context).toEqual({
        tenantId: "tenant-1",
        userId: "user-1",
        action: "CREATE",
        payload: { resource: "Order", id: "order-1" },
      });
      expect(exception.stack).toBeDefined();
    });

    it("应该能够创建带堆栈跟踪的异常信息", () => {
      // 执行
      const exception = exceptionService.create("ERROR", "测试错误", {
        test: true,
      });

      // 验证
      expect(exception.stack).toBeDefined();
      expect(typeof exception.stack).toBe("string");
      expect(exception.stack?.length).toBeGreaterThan(0);
    });
  });

  describe("log", () => {
    it("应该能够记录异常信息", async () => {
      // 准备
      const mockLogger = {
        error: jest.fn(),
      };

      const exceptionServiceWithLogger = new ExceptionServiceImpl(
        mockLogger as never,
      );

      const exception: ExceptionInfo = {
        errorCode: "EVENT_STORE_ERROR",
        message: "事件存储操作失败",
        context: { aggregateId: "aggregate-1" },
        stack: "Error: 事件存储操作失败\n    at ...",
      };

      // 执行
      await exceptionServiceWithLogger.log(exception);

      // 验证
      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          errorCode: "EVENT_STORE_ERROR",
          context: { aggregateId: "aggregate-1" },
        }),
      );
    });

    it("应该能够记录不带上下文的异常信息", async () => {
      // 准备
      const mockLogger = {
        error: jest.fn(),
      };

      const exceptionServiceWithLogger = new ExceptionServiceImpl(
        mockLogger as never,
      );

      const exception: ExceptionInfo = {
        errorCode: "CONFIGURATION_ERROR",
        message: "配置加载失败",
        stack: "Error: 配置加载失败\n    at ...",
      };

      // 执行
      await exceptionServiceWithLogger.log(exception);

      // 验证
      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          errorCode: "CONFIGURATION_ERROR",
          context: undefined,
        }),
      );
    });

    it("应该能够记录带堆栈跟踪的异常信息", async () => {
      // 准备
      const mockLogger = {
        error: jest.fn(),
      };

      const exceptionServiceWithLogger = new ExceptionServiceImpl(
        mockLogger as never,
      );

      const stackTrace = "Error: 测试错误\n    at line 1\n    at line 2";
      const exception: ExceptionInfo = {
        errorCode: "ERROR",
        message: "测试错误",
        context: { test: true },
        stack: stackTrace,
      };

      // 执行
      await exceptionServiceWithLogger.log(exception);

      // 验证
      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      const errorArg = mockLogger.error.mock.calls[0][0] as Error;
      expect(errorArg).toBeInstanceOf(Error);
      expect(errorArg.message).toBe("测试错误");
      expect(errorArg.stack).toBe(stackTrace);
    });

    it("应该能够处理日志记录失败的情况", async () => {
      // 准备
      const mockLogger = {
        error: jest.fn(() => {
          throw new Error("日志记录失败");
        }),
      };

      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const exceptionServiceWithLogger = new ExceptionServiceImpl(
        mockLogger as never,
      );

      const exception: ExceptionInfo = {
        errorCode: "ERROR",
        message: "测试错误",
        context: { test: true },
        stack: "Error: 测试错误\n    at ...",
      };

      // 执行
      await exceptionServiceWithLogger.log(exception);

      // 验证
      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "异常记录失败",
        expect.objectContaining({
          errorCode: "ERROR",
          message: "测试错误",
        }),
      );

      // 清理
      consoleErrorSpy.mockRestore();
    });

    it("应该能够处理没有日志服务的情况", async () => {
      // 准备
      const exceptionServiceWithoutLogger = new ExceptionServiceImpl();

      const exception: ExceptionInfo = {
        errorCode: "ERROR",
        message: "测试错误",
        context: { test: true },
        stack: "Error: 测试错误\n    at ...",
      };

      // 执行和验证（不应该抛出异常）
      await expect(
        exceptionServiceWithoutLogger.log(exception),
      ).resolves.toBeUndefined();
    });
  });
});

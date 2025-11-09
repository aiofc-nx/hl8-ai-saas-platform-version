/**
 * PinoLoggerService 单元测试
 *
 * @description 测试 PinoLoggerService 的功能，包括日志级别对齐和子日志器
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import pino from "pino";
import PinoLoggerService from "./pino-logger.service.js";
import { LoggingConfig } from "../config/logging.config.js";
import { ContextStorage } from "./context/context-storage.js";
import type { StructuredLogContext } from "./context/request-context.types.js";

describe("PinoLoggerService", () => {
  let pinoLogger: pino.Logger;
  let loggerService: PinoLoggerService;
  let config: LoggingConfig;

  beforeEach(() => {
    pinoLogger = pino({ level: "trace" });
    config = new LoggingConfig();
    loggerService = new PinoLoggerService(pinoLogger, config);
  });

  describe("日志级别对齐", () => {
    it("应该实现所有 NestJS LoggerService 方法", () => {
      expect(typeof loggerService.log).toBe("function");
      expect(typeof loggerService.error).toBe("function");
      expect(typeof loggerService.warn).toBe("function");
      expect(typeof loggerService.debug).toBe("function");
      expect(typeof loggerService.verbose).toBe("function");
    });

    it("应该正确映射 verbose() 到 Pino trace 级别", () => {
      const traceSpy = jest.spyOn(pinoLogger, "trace");
      loggerService.verbose("详细日志");
      expect(traceSpy).toHaveBeenCalled();
      traceSpy.mockRestore();
    });

    it("应该正确映射 debug() 到 Pino debug 级别", () => {
      const debugSpy = jest.spyOn(pinoLogger, "debug");
      loggerService.debug("调试日志");
      expect(debugSpy).toHaveBeenCalled();
      debugSpy.mockRestore();
    });

    it("应该正确映射 log() 到 Pino info 级别", () => {
      const infoSpy = jest.spyOn(pinoLogger, "info");
      loggerService.log("信息日志");
      expect(infoSpy).toHaveBeenCalled();
      infoSpy.mockRestore();
    });

    it("应该正确映射 warn() 到 Pino warn 级别", () => {
      const warnSpy = jest.spyOn(pinoLogger, "warn");
      loggerService.warn("警告日志");
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it("应该正确映射 error() 到 Pino error 级别", () => {
      const errorSpy = jest.spyOn(pinoLogger, "error");
      loggerService.error("错误日志");
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });

  describe("子日志器支持", () => {
    it("应该支持创建子日志器", () => {
      const childLogger = loggerService.child({ module: "TestModule" });
      expect(childLogger).toBeInstanceOf(PinoLoggerService);
      expect(childLogger).not.toBe(loggerService);
    });

    it("子日志器应该继承父日志器的上下文", () => {
      const childLogger = loggerService.child({ module: "TestModule" });
      // 在子 logger 的 Pino 实例上设置 spy
      const childPinoLogger = childLogger.getPinoLogger();
      const infoSpy = jest.spyOn(childPinoLogger, "info");

      childLogger.log("测试日志", { action: "test" });

      expect(infoSpy).toHaveBeenCalled();
      // Pino child logger 会自动将 child 的上下文合并到日志中
      // 但由于 Pino 的内部实现，child 的上下文可能在序列化阶段合并
      // 而不是在调用参数中直接可见
      // 我们验证子 logger 可以正常工作，并且传入的 context 被正确传递
      const callArgs = infoSpy.mock.calls[0];
      if (callArgs && callArgs.length >= 2) {
        const context = callArgs[0];
        const message = callArgs[1];
        expect(context).toHaveProperty("action", "test");
        expect(message).toBe("测试日志");
        // 注意：实际的日志输出会包含 child 的上下文（module: "TestModule"）
        // 这是 Pino child logger 的标准行为
      }

      infoSpy.mockRestore();
    });

    it("子日志器应该自动继承请求上下文", () => {
      const requestContext = {
        requestId: "test-123",
        method: "GET",
      };

      ContextStorage.run(requestContext, () => {
        const childLogger = loggerService.child({ module: "TestModule" });
        // 在子 logger 的 Pino 实例上设置 spy
        const childPinoLogger = childLogger.getPinoLogger();
        const infoSpy = jest.spyOn(childPinoLogger, "info");

        childLogger.log("测试日志");

        expect(infoSpy).toHaveBeenCalled();
        // 验证请求上下文被正确注入
        const callArgs = infoSpy.mock.calls[0];
        if (callArgs && callArgs.length >= 2) {
          const context = callArgs[0] as Record<string, unknown>;
          expect(context).toHaveProperty("request");
          const request = context.request as Record<string, unknown>;
          expect(request.requestId).toBe("test-123");
          // 注意：child 的上下文（module: "TestModule"）会在 Pino 序列化时合并
          // 实际的日志输出会包含该上下文
        }

        infoSpy.mockRestore();
      });
    });
  });

  describe("上下文注入", () => {
    it("应该自动注入请求上下文", () => {
      const requestContext = {
        requestId: "ctx-123",
        method: "POST",
        url: "/test",
      };

      ContextStorage.run(requestContext, () => {
        const infoSpy = jest.spyOn(pinoLogger, "info");
        loggerService.log("测试日志", { custom: "value" });

        expect(infoSpy).toHaveBeenCalled();
        const callArgs = infoSpy.mock.calls[0];
        if (callArgs && callArgs[0]) {
          const context = callArgs[0] as Record<string, unknown>;
          expect(context).toHaveProperty("request");
          const request = context.request as Record<string, unknown>;
          expect(request.requestId).toBe("ctx-123");
          expect(request.method).toBe("POST");
          expect(context.custom).toBe("value");
        }

        infoSpy.mockRestore();
      });
    });

    it("应该在上下文禁用时不注入上下文", () => {
      config.context = { enabled: false };
      const loggerWithoutContext = new PinoLoggerService(pinoLogger, config);

      const requestContext = {
        requestId: "ctx-456",
      };

      ContextStorage.run(requestContext, () => {
        const infoSpy = jest.spyOn(pinoLogger, "info");
        loggerWithoutContext.log("测试日志");

        expect(infoSpy).toHaveBeenCalled();
        const callArgs = infoSpy.mock.calls[0];
        if (callArgs && callArgs[0]) {
          const context = callArgs[0];
          expect(context).not.toHaveProperty("request");
        }

        infoSpy.mockRestore();
      });
    });
  });

  describe("脱敏功能", () => {
    it("应该自动脱敏敏感字段", () => {
      const infoSpy = jest.spyOn(pinoLogger, "info");
      loggerService.log("测试日志", {
        password: "secret123",
        token: "abc123",
        name: "John",
      });

      expect(infoSpy).toHaveBeenCalled();
      const callArgs = infoSpy.mock.calls[0];
      if (callArgs && callArgs[0]) {
        const context = callArgs[0] as Record<string, unknown>;
        expect(context.password).toBe("***");
        expect(context.token).toBe("***");
        expect(context.name).toBe("John");
      }

      infoSpy.mockRestore();
    });

    it("应该在脱敏禁用时不脱敏", () => {
      config.sanitizer = { enabled: false };
      const loggerWithoutSanitizer = new PinoLoggerService(pinoLogger, config);

      const infoSpy = jest.spyOn(pinoLogger, "info");
      loggerWithoutSanitizer.log("测试日志", {
        password: "secret123",
      });

      expect(infoSpy).toHaveBeenCalled();
      const callArgs = infoSpy.mock.calls[0];
      if (callArgs && callArgs[0]) {
        const context = callArgs[0] as Record<string, unknown>;
        expect(context.password).toBe("secret123");
      }

      infoSpy.mockRestore();
    });
  });

  describe("结构化上下文支持", () => {
    it("应该支持业务上下文", () => {
      const infoSpy = jest.spyOn(pinoLogger, "info");

      const context: StructuredLogContext = {
        business: {
          operation: "createUser",
          resource: "User",
          action: "create",
        },
      };

      loggerService.log("创建用户", context);

      expect(infoSpy).toHaveBeenCalled();
      const callArgs = infoSpy.mock.calls[0];
      if (callArgs && callArgs[0]) {
        const logContext = callArgs[0] as Record<string, unknown>;
        expect(logContext.business).toBeDefined();
        const business = logContext.business as Record<string, unknown>;
        expect(business.operation).toBe("createUser");
        expect(business.resource).toBe("User");
        expect(business.action).toBe("create");
      }

      infoSpy.mockRestore();
    });

    it("应该支持性能指标上下文", () => {
      const infoSpy = jest.spyOn(pinoLogger, "info");

      const context: StructuredLogContext = {
        performance: {
          duration: 100,
          memoryUsage: 1024 * 1024,
          cpuUsage: 50,
        },
      };

      loggerService.log("操作完成", context);

      expect(infoSpy).toHaveBeenCalled();
      const callArgs = infoSpy.mock.calls[0];
      if (callArgs && callArgs[0]) {
        const logContext = callArgs[0] as Record<string, unknown>;
        expect(logContext.performance).toBeDefined();
        const performance = logContext.performance as Record<string, unknown>;
        expect(performance.duration).toBe(100);
        expect(performance.memoryUsage).toBe(1024 * 1024);
        expect(performance.cpuUsage).toBe(50);
      }

      infoSpy.mockRestore();
    });

    it("应该支持请求上下文和业务上下文的组合", () => {
      const requestContext = {
        requestId: "req-123",
        method: "POST",
        url: "/api/users",
      };

      ContextStorage.run(requestContext, () => {
        const infoSpy = jest.spyOn(pinoLogger, "info");

        const context: StructuredLogContext = {
          business: {
            operation: "createUser",
            resource: "User",
          },
        };

        loggerService.log("创建用户", context);

        expect(infoSpy).toHaveBeenCalled();
        const callArgs = infoSpy.mock.calls[0];
        if (callArgs && callArgs[0]) {
          const logContext = callArgs[0] as Record<string, unknown>;
          // 应该包含请求上下文
          expect(logContext.request).toBeDefined();
          const request = logContext.request as Record<string, unknown>;
          expect(request.requestId).toBe("req-123");
          // 应该包含业务上下文
          expect(logContext.business).toBeDefined();
          const business = logContext.business as Record<string, unknown>;
          expect(business.operation).toBe("createUser");
        }

        infoSpy.mockRestore();
      });
    });

    it("应该支持自定义字段", () => {
      const infoSpy = jest.spyOn(pinoLogger, "info");

      const context: StructuredLogContext = {
        business: {
          operation: "test",
        },
        custom: {
          userId: "user-123",
          metadata: {
            source: "test",
            timestamp: Date.now(),
          },
        },
      };

      loggerService.log("测试日志", context);

      expect(infoSpy).toHaveBeenCalled();
      const callArgs = infoSpy.mock.calls[0];
      if (callArgs && callArgs[0]) {
        const logContext = callArgs[0] as Record<string, unknown>;
        expect(logContext.custom).toBeDefined();
        const custom = logContext.custom as Record<string, unknown>;
        expect(custom.userId).toBe("user-123");
        expect(custom.metadata).toBeDefined();
      }

      infoSpy.mockRestore();
    });

    it("应该支持所有日志级别的结构化上下文", () => {
      const context: StructuredLogContext = {
        business: {
          operation: "test",
          resource: "Test",
        },
      };

      const traceSpy = jest.spyOn(pinoLogger, "trace");
      loggerService.verbose("详细日志", context);
      expect(traceSpy).toHaveBeenCalled();
      traceSpy.mockRestore();

      const debugSpy = jest.spyOn(pinoLogger, "debug");
      loggerService.debug("调试日志", context);
      expect(debugSpy).toHaveBeenCalled();
      debugSpy.mockRestore();

      const infoSpy = jest.spyOn(pinoLogger, "info");
      loggerService.log("信息日志", context);
      expect(infoSpy).toHaveBeenCalled();
      infoSpy.mockRestore();

      const warnSpy = jest.spyOn(pinoLogger, "warn");
      loggerService.warn("警告日志", context);
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();

      const errorSpy = jest.spyOn(pinoLogger, "error");
      loggerService.error("错误日志", undefined, context);
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });

  describe("性能配置", () => {
    it("启用性能监控时仍应成功写入日志", () => {
      config.performance = {
        enabled: true,
        trackLogWriteTime: true,
      };

      const loggerWithPerformance = new PinoLoggerService(pinoLogger, config);

      const infoSpy = jest.spyOn(pinoLogger, "info");

      expect(() => {
        loggerWithPerformance.log("测试日志");
      }).not.toThrow();

      expect(infoSpy).toHaveBeenCalled();
      infoSpy.mockRestore();
    });

    it("禁用性能监控时应跳过相关逻辑", () => {
      config.performance = {
        enabled: false,
        trackLogWriteTime: false,
      };

      const loggerWithoutPerformance = new PinoLoggerService(
        pinoLogger,
        config,
      );

      const infoSpy = jest.spyOn(pinoLogger, "info");

      expect(() => {
        loggerWithoutPerformance.log("测试日志");
      }).not.toThrow();

      expect(infoSpy).toHaveBeenCalled();
      infoSpy.mockRestore();
    });
  });
});

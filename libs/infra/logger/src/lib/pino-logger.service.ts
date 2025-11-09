/**
 * Fastify 日志服务
 *
 * @description 直接使用 Fastify 内置的 Pino 日志实例，零配置高性能
 *
 * ## 业务规则
 *
 * ### 日志记录规则
 * - 直接使用 Fastify 的 Pino 实例（零开销）
 * - 自动包含请求上下文
 * - 支持结构化日志
 * - 开发环境美化输出
 *
 * @since 0.1.0
 */

import {
  Injectable,
  LoggerService as NestLoggerService,
  Optional,
  Scope,
} from "@nestjs/common";
import type { Logger as PinoLogger } from "pino";
import { ContextStorage } from "./context/context-storage.js";
import { Sanitizer } from "./sanitizer/sanitizer.js";
import type { LoggingConfig } from "../config/logging.config.js";

/**
 * 日志上下文类型
 */
export interface LogContext {
  [key: string]: unknown;
}

/**
 * 错误对象类型
 */
export interface ErrorObject {
  type: string;
  message: string;
  stack?: string;
}

/**
 * 增强的日志上下文（包含错误对象）
 */
export interface EnrichedLogContext extends LogContext {
  err?: ErrorObject;
}

/**
 * Fastify 日志服务
 *
 * @description 全局统一的日志服务，基于 Fastify 内置 Pino
 * - 复用 Fastify Pino 实例（零开销）
 * - 实现 NestJS 和内部日志接口
 * - 作为全局服务提供给所有模块
 */
@Injectable({ scope: Scope.TRANSIENT })
export default class PinoLoggerService implements NestLoggerService {
  private readonly sanitizer: Sanitizer;

  constructor(
    private readonly pinoLogger: PinoLogger,
    @Optional() private readonly config?: LoggingConfig,
  ) {
    this.sanitizer = new Sanitizer();
  }

  /**
   * 记录信息日志
   *
   * @param message - 日志消息
   * @param context - 日志上下文（可选）
   */
  log(message: string, context?: LogContext): void;
  log(message: Error, context?: LogContext): void;
  log(message: string | Error, context?: LogContext): void {
    this.writeLog("info", message, context);
  }

  /**
   * 记录错误日志
   *
   * @param message - 日志消息
   * @param stack - 错误堆栈（可选）
   * @param context - 日志上下文（可选）
   */
  error(message: string, stack?: string, context?: LogContext): void;
  error(message: Error, context?: LogContext): void;
  error(
    message: string | Error,
    stackOrContext?: string | LogContext,
    context?: LogContext,
  ): void {
    if (message instanceof Error) {
      // Error 对象的情况
      this.writeLog("error", message, stackOrContext as LogContext);
    } else {
      // 字符串消息的情况
      const actualContext =
        typeof stackOrContext === "string" ? context : stackOrContext;
      const enrichedContext = this.enrichContext(actualContext);
      const errorContext = {
        ...enrichedContext,
        err: {
          type: "Error",
          message: message,
          stack:
            typeof stackOrContext === "string" ? stackOrContext : undefined,
        },
      };
      this.writeLogWithContext("error", message, errorContext);
    }
  }

  /**
   * 记录警告日志
   *
   * @param message - 日志消息
   * @param context - 日志上下文（可选）
   */
  warn(message: string, context?: LogContext): void;
  warn(message: Error, context?: LogContext): void;
  warn(message: string | Error, context?: LogContext): void {
    this.writeLog("warn", message, context);
  }

  /**
   * 记录调试日志
   *
   * @param message - 日志消息
   * @param context - 日志上下文（可选）
   */
  debug(message: string, context?: LogContext): void;
  debug(message: Error, context?: LogContext): void;
  debug(message: string | Error, context?: LogContext): void {
    this.writeLog("debug", message, context);
  }

  /**
   * 记录详细日志
   *
   * @param message - 日志消息
   * @param context - 日志上下文（可选）
   */
  verbose(message: string, context?: LogContext): void;
  verbose(message: Error, context?: LogContext): void;
  verbose(message: string | Error, context?: LogContext): void {
    this.writeLog("trace", message, context);
  }

  /**
   * 创建子日志器
   *
   * @description 创建带有预定义上下文的子日志器
   * 子日志器自动继承父日志器的上下文和配置
   *
   * ## 业务规则
   *
   * ### 上下文继承
   * - 子日志器自动继承父日志器的配置
   * - 子日志器自动继承请求上下文（如果可用）
   * - 子日志器自动继承父日志器的预定义上下文
   *
   * ### 性能要求
   * - 子日志器创建开销 < 0.1ms
   * - 使用 Pino child() 方法，零开销
   *
   * @param context - 预定义的上下文
   * @returns 子日志器实例
   *
   * @example
   * ```typescript
   * const moduleLogger = logger.child({ module: 'UserService' });
   * moduleLogger.log('创建用户', { userId: '123' });
   * // 日志自动包含: { module: 'UserService', userId: '123', request: {...} }
   * ```
   */
  child(context: Record<string, unknown>): PinoLoggerService {
    // 使用 Pino child() 方法创建子日志器
    const childPino = this.pinoLogger.child(context);

    // 创建新的 PinoLoggerService 实例，复用配置
    return new PinoLoggerService(childPino, this.config);
  }

  /**
   * 获取底层 Pino 实例
   *
   * @description 获取底层的 Pino 日志实例
   * 用于需要直接访问 Pino 功能的场景
   *
   * @returns Pino 日志实例
   */
  getPinoLogger(): PinoLogger {
    return this.pinoLogger;
  }

  /**
   * 写入日志（统一方法）
   *
   * @description 统一的日志写入方法，处理上下文注入、脱敏、性能监控和错误处理
   *
   * @param level - Pino 日志级别
   * @param message - 日志消息或 Error 对象
   * @param context - 日志上下文（可选）
   * @private
   */
  private writeLog(
    level: "trace" | "debug" | "info" | "warn" | "error",
    message: string | Error,
    context?: LogContext,
  ): void {
    const enrichedContext = this.enrichContext(context);
    const logMessage = message instanceof Error ? message.message : message;
    const errorContext =
      message instanceof Error
        ? {
            ...enrichedContext,
            err: {
              type: message.constructor.name,
              message: message.message,
              stack: message.stack,
            },
          }
        : enrichedContext;

    this.writeLogWithContext(level, logMessage, errorContext);
  }

  /**
   * 使用上下文写入日志
   *
   * @description 执行实际的日志写入，包括性能监控和错误处理
   *
   * @param level - Pino 日志级别
   * @param message - 日志消息
   * @param context - 增强后的日志上下文
   * @private
   */
  private writeLogWithContext(
    level: "trace" | "debug" | "info" | "warn" | "error",
    message: string,
    context: EnrichedLogContext,
  ): void {
    try {
      // 写入日志
      switch (level) {
        case "trace":
          this.pinoLogger.trace(context, message);
          break;
        case "debug":
          this.pinoLogger.debug(context, message);
          break;
        case "info":
          this.pinoLogger.info(context, message);
          break;
        case "warn":
          this.pinoLogger.warn(context, message);
          break;
        case "error":
          this.pinoLogger.error(context, message);
          break;
      }
    } catch (error) {
      // 错误处理
      this.handleLogError(error, level, message, context);
    }
  }

  /**
   * 记录日志性能指标
   *
   * @description 记录日志写入性能指标到 Metrics 服务
   *
   * @param level - 日志级别
   * @param duration - 写入耗时（毫秒）
   * @param context - 日志上下文
   * @private
   */
  /**
   * 处理日志写入错误
   *
   * @description 日志写入失败时的降级策略
   *
   * ## 业务规则
   *
   * ### 降级策略
   * - 降级到控制台：开发环境建议启用
   * - 记录错误指标：自动记录到 Metrics（如果可用）
   * - 静默失败：生产环境可以启用
   *
   * @param error - 日志写入错误
   * @param level - 日志级别
   * @param message - 日志消息
   * @param context - 日志上下文
   * @private
   */
  private handleLogError(
    error: unknown,
    level: string,
    message: string,
    _context: EnrichedLogContext,
  ): void {
    // 记录错误指标
    // 降级策略
    const errorHandling = this.config?.errorHandling;

    if (errorHandling?.fallbackToConsole) {
      // 降级到控制台
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        `[日志写入失败] 级别: ${level}, 消息: ${message}, 错误: ${errorMessage}`,
      );
    } else if (!errorHandling?.silentFailures) {
      // 静默失败（生产环境）
      // 不输出任何错误信息
    }
  }

  /**
   * 丰富日志上下文
   *
   * @description 自动注入请求上下文并应用脱敏
   *
   * ## 业务规则
   *
   * ### 上下文注入
   * - 如果启用上下文注入，自动从 AsyncLocalStorage 获取请求上下文
   * - 合并用户提供的上下文和请求上下文
   *
   * ### 脱敏处理
   * - 如果启用脱敏，自动脱敏敏感字段
   * - 支持自定义脱敏函数
   *
   * ### 性能要求
   * - 上下文注入开销 < 0.5ms
   * - 脱敏处理开销 < 2ms（普通对象）
   *
   * @param context - 原始上下文
   * @returns 丰富后的上下文
   * @private
   */
  private enrichContext(context?: LogContext): EnrichedLogContext {
    let enriched: EnrichedLogContext = context ? { ...context } : {};

    // 注入请求上下文（如果启用）
    if (this.config?.context?.enabled !== false) {
      const requestContext = ContextStorage.getContext();
      if (requestContext) {
        enriched = {
          ...enriched,
          request: requestContext,
        };
      }
    }

    // 应用脱敏（如果启用）
    if (this.config?.sanitizer?.enabled !== false) {
      enriched = this.sanitizer.sanitize(
        enriched,
        this.config?.sanitizer,
      ) as EnrichedLogContext;
    }

    return enriched;
  }
}

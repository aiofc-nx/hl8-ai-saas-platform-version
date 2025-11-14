/**
 * @fileoverview 异常服务实现
 * @description 实现异常服务，支持异常创建和记录
 *
 * ## 业务规则
 *
 * ### 异常创建规则
 * - 支持创建异常，包含错误码、中文错误信息和上下文信息
 * - 支持异常记录的日志输出
 * - 支持异常记录的上下文信息
 *
 * ### 异常记录规则
 * - 使用 `@hl8/logger` 记录包含完整上下文信息的日志
 * - 支持异常记录的堆栈跟踪
 * - 支持异常记录的上下文信息
 */

import { Inject, Injectable, Optional } from "@nestjs/common";
import { Logger } from "@hl8/logger";
import type { ExceptionService, ExceptionInfo } from "./exception.interface.js";

type LoggerService = InstanceType<typeof Logger>;

/**
 * @description 异常服务实现
 * @remarks 实现异常服务，支持异常创建和记录
 *
 * @example
 * ```typescript
 * // 注入异常服务
 * constructor(private readonly exceptionService: ExceptionServiceImpl) {}
 *
 * // 创建异常
 * const exception = exceptionService.create(
 *   'EVENT_STORE_ERROR',
 *   '事件存储操作失败',
 *   { aggregateId: 'aggregate-1' }
 * );
 *
 * // 记录异常
 * await exceptionService.log(exception);
 * ```
 */
@Injectable()
export class ExceptionServiceImpl implements ExceptionService {
  /**
   * @description 构造函数
   * @param logger - 日志服务（可选）
   */
  constructor(
    @Optional() @Inject(Logger) private readonly logger?: LoggerService,
  ) {}

  /**
   * @description 创建异常
   * @remarks 创建异常信息，包含错误码、中文错误信息和上下文信息
   *
   * @param errorCode - 错误码
   * @param message - 错误信息（中文）
   * @param context - 错误上下文
   * @returns 异常信息
   */
  create(
    errorCode: string,
    message: string,
    context?: Record<string, unknown>,
  ): ExceptionInfo {
    // 创建异常对象
    const error = new Error(message);

    // 返回异常信息
    return {
      errorCode,
      message,
      context,
      stack: error.stack,
    };
  }

  /**
   * @description 记录异常
   * @remarks 使用 `@hl8/logger` 记录包含完整上下文信息的日志
   *
   * @param exception - 异常信息
   * @returns Promise<void>
   */
  async log(exception: ExceptionInfo): Promise<void> {
    try {
      // 创建错误对象
      const error = new Error(exception.message);
      if (exception.stack) {
        error.stack = exception.stack;
      }

      // 记录异常日志
      this.logger?.error(error, {
        errorCode: exception.errorCode,
        context: exception.context,
      });
    } catch (error) {
      // 记录异常记录失败的错误（如果日志服务本身有问题）
      console.error("异常记录失败", {
        errorCode: exception.errorCode,
        message: exception.message,
        error: (error as Error).message,
      });
    }
  }
}

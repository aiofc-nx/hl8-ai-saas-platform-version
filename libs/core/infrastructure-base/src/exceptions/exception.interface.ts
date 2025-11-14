/**
 * @fileoverview 异常服务接口
 * @description 定义异常服务的接口规范，支持异常创建和记录
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

/**
 * @description 异常信息接口
 * @remarks 定义异常信息的数据结构
 */
export interface ExceptionInfo {
  /**
   * @description 错误码
   * @remarks 业务错误码，用于错误分类和追踪
   */
  readonly errorCode: string;

  /**
   * @description 错误信息（中文）
   * @remarks 面向用户的错误信息，使用中文
   */
  readonly message: string;

  /**
   * @description 错误上下文
   * @remarks 包含错误的上下文信息，如请求 ID、用户 ID 等
   */
  readonly context?: Record<string, unknown>;

  /**
   * @description 错误堆栈
   * @remarks 错误的堆栈跟踪信息，用于调试
   */
  readonly stack?: string;
}

/**
 * @description 异常服务接口
 * @remarks 定义异常服务的核心操作，包括异常创建和记录
 *
 * @example
 * ```typescript
 * // 注入异常服务
 * constructor(private readonly exceptionService: ExceptionService) {}
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
export interface ExceptionService {
  /**
   * @description 创建异常
   * @remarks 创建异常信息，包含错误码、中文错误信息和上下文信息
   *
   * ## 业务规则
   * - 错误信息必须使用中文
   * - 错误码必须符合规范
   * - 上下文信息可选
   *
   * @param errorCode - 错误码
   * @param message - 错误信息（中文）
   * @param context - 错误上下文
   * @returns 异常信息
   *
   * @example
   * ```typescript
   * const exception = exceptionService.create(
   *   'EVENT_STORE_ERROR',
   *   '事件存储操作失败',
   *   { aggregateId: 'aggregate-1' }
   * );
   * ```
   */
  create(
    errorCode: string,
    message: string,
    context?: Record<string, unknown>,
  ): ExceptionInfo;

  /**
   * @description 记录异常
   * @remarks 使用 `@hl8/logger` 记录包含完整上下文信息的日志
   *
   * ## 业务规则
   * - 使用 `@hl8/logger` 记录日志
   * - 记录包含完整上下文信息的日志
   * - 支持异常记录的堆栈跟踪
   *
   * @param exception - 异常信息
   * @returns Promise<void>
   *
   * @example
   * ```typescript
   * await exceptionService.log(exception);
   * ```
   */
  log(exception: ExceptionInfo): Promise<void>;
}

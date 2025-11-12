/**
 * 错误处理模块
 *
 * 配置模块的错误处理和异常管理，提供统一的错误处理机制和错误类型定义。
 * 包括配置错误、验证错误、加载错误等各种错误类型的处理。
 *
 * @description 此模块是配置系统的错误处理中心，提供统一的错误处理机制。
 * 包括自定义错误类、错误处理器、错误格式化等功能。
 * 遵循错误处理最佳实践，提供详细的错误信息和错误追踪。
 *
 * ## 业务规则
 *
 * ### 错误分类规则
 * - ConfigError：配置相关的通用错误
 * - ValidationError：配置验证错误
 * - FileNotFoundError：配置文件未找到错误
 * - ParseError：配置文件解析错误
 * - VariableExpansionError：环境变量替换错误
 *
 * ### 错误处理规则
 * - 所有错误都必须包含详细的错误信息
 * - 错误信息必须包含错误上下文和堆栈跟踪
 * - 支持错误链和错误包装
 * - 提供用户友好的错误消息
 *
 * ### 错误格式化规则
 * - 错误消息必须清晰易懂
 * - 包含错误发生的具体位置和原因
 * - 提供错误修复建议和解决方案
 * - 支持多语言错误消息
 *
 * @example
 * ```typescript
 * import { ConfigError, ErrorHandler } from '@hl8/config';
 *
 * // 抛出配置错误
 * throw new ConfigError('Configuration validation failed', {
 *   configPath: './config/app.yml',
 *   validationErrors: ['port must be a number']
 * });
 *
 * // 使用错误处理器
 * try {
 *   // 配置操作
 * } catch (error) {
 *   ErrorHandler.handleError(error);
 * }
 * ```
 */

export { ConfigError, ConfigErrorType } from "./config-error.js";
export { ErrorHandler } from "./error-handler.js";
export type { ErrorHandlerOptions } from "./error-handler.js";

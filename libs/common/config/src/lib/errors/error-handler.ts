/**
 * 错误处理器
 *
 * @description 配置模块的错误处理工具
 * @author HL8 SAAS Platform Team
 * @since 1.0.0
 */

import { ConfigLogger } from "../services/config-logger.service.js";
import { ErrorContext } from "../types/index.js";
import { ConfigError, ConfigErrorType } from "./config-error.js";

/**
 * 错误处理选项接口
 *
 * @description 定义错误处理的选项
 * @interface ErrorHandlerOptions
 * @since 1.0.0
 */
export interface ErrorHandlerOptions {
  /**
   * 是否记录错误日志
   * @description 是否将错误信息记录到日志
   * @default true
   */
  logErrors?: boolean;

  /**
   * 是否包含堆栈跟踪
   * @description 是否在错误信息中包含堆栈跟踪
   * @default true
   */
  includeStackTrace?: boolean;

  /**
   * 是否包含上下文信息
   * @description 是否在错误信息中包含上下文信息
   * @default true
   */
  includeContext?: boolean;

  /**
   * 错误重试次数
   * @description 发生错误时的重试次数
   * @default 0
   */
  retryCount?: number;

  /**
   * 重试间隔（毫秒）
   * @description 重试之间的间隔时间
   * @default 1000
   */
  retryInterval?: number;
}

/**
 * 错误处理器类
 *
 * @description 提供统一的错误处理功能
 * @class ErrorHandler
 * @since 1.0.0
 */
export class ErrorHandler {
  private static readonly defaultOptions: Required<ErrorHandlerOptions> = {
    logErrors: true,
    includeStackTrace: true,
    includeContext: true,
    retryCount: 0,
    retryInterval: 1000,
  };

  /**
   * 处理文件加载错误
   *
   * @description 处理文件加载相关的错误
   * @param error 原始错误
   * @param filePath 文件路径
   * @param context 额外上下文
   * @returns 配置错误实例
   * @since 1.0.0
   */
  public static handleFileLoadError(
    error: Error,
    filePath: string,
    context: ErrorContext = {},
  ): ConfigError {
    return new ConfigError(
      ConfigErrorType.FILE_LOAD_ERROR,
      `Failed to load configuration file: ${filePath}`,
      { filePath, ...context },
      error,
    );
  }

  /**
   * 处理文件格式错误
   *
   * @description 处理文件格式相关的错误
   * @param error 原始错误
   * @param filePath 文件路径
   * @param expectedFormat 期望的格式
   * @param context 额外上下文
   * @returns 配置错误实例
   * @since 1.0.0
   */
  public static handleFileFormatError(
    error: Error,
    filePath: string,
    expectedFormat: string,
    context: Record<string, unknown> = {},
  ): ConfigError {
    return new ConfigError(
      ConfigErrorType.FILE_FORMAT_ERROR,
      `Unsupported file format in ${filePath}. Expected: ${expectedFormat}`,
      { filePath, expectedFormat, ...context },
      error,
    );
  }

  /**
   * 处理文件不存在错误
   *
   * @description 处理文件不存在相关的错误
   * @param filePath 文件路径
   * @param context 额外上下文
   * @returns 配置错误实例
   * @since 1.0.0
   */
  public static handleFileNotFoundError(
    filePath: string,
    context: Record<string, unknown> = {},
  ): ConfigError {
    return new ConfigError(
      ConfigErrorType.FILE_NOT_FOUND,
      `Configuration file not found: ${filePath}`,
      { filePath, ...context },
    );
  }

  /**
   * 处理目录不存在错误
   *
   * @description 处理目录不存在相关的错误
   * @param directoryPath 目录路径
   * @param context 额外上下文
   * @returns 配置错误实例
   * @since 1.0.0
   */
  public static handleDirectoryNotFoundError(
    directoryPath: string,
    context: Record<string, unknown> = {},
  ): ConfigError {
    return new ConfigError(
      ConfigErrorType.DIRECTORY_NOT_FOUND,
      `Configuration directory not found: ${directoryPath}`,
      { directoryPath, ...context },
    );
  }

  /**
   * 处理网络请求错误
   *
   * @description 处理网络请求相关的错误
   * @param error 原始错误
   * @param url 请求URL
   * @param context 额外上下文
   * @returns 配置错误实例
   * @since 1.0.0
   */
  public static handleNetworkError(
    error: Error,
    url: string,
    context: Record<string, unknown> = {},
  ): ConfigError {
    return new ConfigError(
      ConfigErrorType.NETWORK_ERROR,
      `Failed to load configuration from remote URL: ${url}`,
      { url, ...context },
      error,
    );
  }

  /**
   * 处理配置验证错误
   *
   * @description 处理配置验证相关的错误
   * @param validationErrors 验证错误列表
   * @param context 额外上下文
   * @returns 配置错误实例
   * @since 1.0.0
   */
  public static handleValidationError(
    validationErrors: unknown[],
    context: Record<string, unknown> = {},
  ): ConfigError {
    return new ConfigError(
      ConfigErrorType.VALIDATION_ERROR,
      `Configuration validation failed with ${validationErrors.length} errors`,
      { validationErrors, ...context },
    );
  }

  /**
   * 处理环境变量错误
   *
   * @description 处理环境变量相关的错误
   * @param variableName 变量名
   * @param context 额外上下文
   * @returns 配置错误实例
   * @since 1.0.0
   */
  public static handleEnvVarError(
    variableName: string,
    context: Record<string, unknown> = {},
  ): ConfigError {
    return new ConfigError(
      ConfigErrorType.ENV_VAR_ERROR,
      `Required environment variable is not defined: ${variableName}`,
      { variableName, ...context },
    );
  }

  /**
   * 处理变量展开错误
   *
   * @description 处理变量展开相关的错误
   * @param error 原始错误
   * @param variableName 变量名
   * @param context 额外上下文
   * @returns 配置错误实例
   * @since 1.0.0
   */
  public static handleVariableExpansionError(
    error: Error,
    variableName: string,
    context: Record<string, unknown> = {},
  ): ConfigError {
    return new ConfigError(
      ConfigErrorType.VARIABLE_EXPANSION_ERROR,
      `Failed to expand variable: ${variableName}`,
      { variableName, ...context },
      error,
    );
  }

  /**
   * 处理配置解析错误
   *
   * @description 处理配置解析相关的错误
   * @param error 原始错误
   * @param content 配置内容
   * @param context 额外上下文
   * @returns 配置错误实例
   * @since 1.0.0
   */
  public static handleParseError(
    error: Error,
    content: string,
    context: Record<string, unknown> = {},
  ): ConfigError {
    return new ConfigError(
      ConfigErrorType.PARSE_ERROR,
      `Failed to parse configuration content`,
      { content: content.substring(0, 100) + "...", ...context },
      error,
    );
  }

  /**
   * 处理未知错误
   *
   * @description 处理未知类型的错误
   * @param error 原始错误
   * @param context 额外上下文
   * @returns 配置错误实例
   * @since 1.0.0
   */
  public static handleUnknownError(
    error: Error,
    context: Record<string, unknown> = {},
  ): ConfigError {
    return new ConfigError(
      ConfigErrorType.UNKNOWN_ERROR,
      `An unknown error occurred`,
      context,
      error,
    );
  }

  /**
   * 安全执行函数
   *
   * @description 安全执行函数，捕获并处理错误
   * @param fn 要执行的函数
   * @param errorType 错误类型
   * @param context 上下文
   * @param options 错误处理选项
   * @returns 执行结果或错误
   * @since 1.0.0
   */
  public static async safeExecute<T>(
    fn: () => Promise<T> | T,
    errorType: ConfigErrorType,
    context: Record<string, unknown> = {},
    options: Partial<ErrorHandlerOptions> = {},
  ): Promise<T | ConfigError> {
    const opts = { ...this.defaultOptions, ...options };
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= opts.retryCount; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        if (attempt < opts.retryCount) {
          await this.delay(opts.retryInterval);
          continue;
        }

        const configError = new ConfigError(
          errorType,
          lastError.message,
          context,
          lastError,
        );

        if (opts.logErrors) {
          const logger = ConfigLogger.getInstance();
          logger.error("配置错误", {
            type: configError.type,
            code: configError.code,
            message: configError.message,
            context: configError.context,
            originalError: configError.originalError?.message,
          });
        }

        return configError;
      }
    }

    return new ConfigError(
      ConfigErrorType.UNKNOWN_ERROR,
      "Unexpected error in safe execution",
      context,
    );
  }

  /**
   * 延迟函数
   *
   * @description 创建延迟
   * @param ms 延迟时间（毫秒）
   * @returns Promise
   * @since 1.0.0
   */
  private static delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

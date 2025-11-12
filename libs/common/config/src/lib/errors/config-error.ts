/**
 * 配置错误类
 *
 * @description 配置模块的专用错误类
 * @author HL8 SAAS Platform Team
 * @since 1.0.0
 */

/**
 * 配置错误类型枚举
 *
 * @description 定义配置错误的类型
 * @enum ConfigErrorType
 * @since 1.0.0
 */
export enum ConfigErrorType {
  /** 文件加载错误 */
  FILE_LOAD_ERROR = "FILE_LOAD_ERROR",
  /** 文件格式错误 */
  FILE_FORMAT_ERROR = "FILE_FORMAT_ERROR",
  /** 文件不存在错误 */
  FILE_NOT_FOUND = "FILE_NOT_FOUND",
  /** 目录不存在错误 */
  DIRECTORY_NOT_FOUND = "DIRECTORY_NOT_FOUND",
  /** 网络请求错误 */
  NETWORK_ERROR = "NETWORK_ERROR",
  /** 配置验证错误 */
  VALIDATION_ERROR = "VALIDATION_ERROR",
  /** 环境变量错误 */
  ENV_VAR_ERROR = "ENV_VAR_ERROR",
  /** 变量展开错误 */
  VARIABLE_EXPANSION_ERROR = "VARIABLE_EXPANSION_ERROR",
  /** 配置解析错误 */
  PARSE_ERROR = "PARSE_ERROR",
  /** 未知错误 */
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

/**
 * 配置错误类
 *
 * @description 配置模块的专用错误类，提供详细的错误信息和上下文
 * @class ConfigError
 * @extends Error
 * @since 1.0.0
 */
export class ConfigError extends Error {
  /**
   * 错误类型
   * @description 错误的类型标识
   */
  public readonly type: ConfigErrorType;

  /**
   * 错误代码
   * @description 错误的唯一标识码
   */
  public readonly code: string;

  /**
   * 错误上下文
   * @description 错误发生时的上下文信息
   */
  public readonly context: Record<string, unknown>;

  /**
   * 原始错误
   * @description 导致此错误的原始错误对象
   */
  public readonly originalError?: Error;

  /**
   * 时间戳
   * @description 错误发生的时间戳
   */
  public readonly timestamp: Date;

  /**
   * 构造函数
   *
   * @description 创建配置错误实例
   * @param type 错误类型
   * @param message 错误消息
   * @param context 错误上下文
   * @param originalError 原始错误
   * @since 1.0.0
   */
  constructor(
    type: ConfigErrorType,
    message: string,
    context: Record<string, unknown> = {},
    originalError?: Error,
  ) {
    super(message);
    this.name = "ConfigError";
    this.type = type;
    this.code = `${type}_${Date.now()}`;
    this.context = context;
    this.originalError = originalError;
    this.timestamp = new Date();

    // 确保堆栈跟踪正确
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ConfigError);
    }
  }

  /**
   * 获取详细错误信息
   *
   * @description 返回包含所有错误信息的详细字符串
   * @returns 详细的错误信息
   * @since 1.0.0
   */
  public getDetailedMessage(): string {
    const parts = [
      `[${this.type}] ${this.message}`,
      `Code: ${this.code}`,
      `Timestamp: ${this.timestamp.toISOString()}`,
    ];

    if (Object.keys(this.context).length > 0) {
      parts.push(`Context: ${JSON.stringify(this.context, null, 2)}`);
    }

    if (this.originalError) {
      parts.push(`Original Error: ${this.originalError.message}`);
      if (this.originalError.stack) {
        parts.push(`Stack: ${this.originalError.stack}`);
      }
    }

    return parts.join("\n");
  }

  /**
   * 转换为JSON格式
   *
   * @description 将错误信息转换为JSON格式
   * @returns JSON格式的错误信息
   * @since 1.0.0
   */
  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      type: this.type,
      code: this.code,
      message: this.message,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
      originalError: this.originalError
        ? {
            name: this.originalError.name,
            message: this.originalError.message,
            stack: this.originalError.stack,
          }
        : undefined,
      stack: this.stack,
    };
  }
}

/**
 * 配置日志服务
 *
 * @description 为配置模块提供轻量级日志记录功能，不依赖任何外部框架
 *
 * ## 设计原则
 *
 * - 零依赖：仅使用原生 console API
 * - 轻量级：适合配置加载阶段的早期使用
 * - 结构化：支持上下文信息记录
 * - 可配置：支持日志级别控制
 *
 * ## 使用场景
 *
 * - 配置文件加载失败
 * - 配置验证错误
 * - 配置缓存操作
 * - 环境变量处理
 *
 * @example
 * ```typescript
 * const logger = ConfigLogger.getInstance();
 * logger.error('配置文件加载失败', { filePath: '/config/app.json', error: 'ENOENT' });
 * // 输出: [CONFIG:ERROR] 配置文件加载失败 {"filePath":"/config/app.json","error":"ENOENT"}
 * ```
 *
 * @since 1.0.0
 */
export class ConfigLogger {
  private static instance: ConfigLogger;
  private readonly level: "error" | "warn" | "info" | "debug";
  private readonly prefix: string = "[CONFIG]";

  /**
   * 私有构造函数
   *
   * @param level 日志级别
   */
  private constructor(level: "error" | "warn" | "info" | "debug" = "info") {
    this.level = level;
  }

  /**
   * 获取单例实例
   *
   * @param level 日志级别（可选）
   * @returns ConfigLogger 实例
   */
  static getInstance(
    level?: "error" | "warn" | "info" | "debug",
  ): ConfigLogger {
    if (!this.instance) {
      this.instance = new ConfigLogger(level);
    }
    return this.instance;
  }

  /**
   * 记录错误级别日志
   *
   * @param message 日志消息
   * @param context 日志上下文
   */
  error(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog("error")) {
      this.log("ERROR", message, context);
    }
  }

  /**
   * 记录警告级别日志
   *
   * @param message 日志消息
   * @param context 日志上下文
   */
  warn(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog("warn")) {
      this.log("WARN", message, context);
    }
  }

  /**
   * 记录信息级别日志
   *
   * @param message 日志消息
   * @param context 日志上下文
   */
  info(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog("info")) {
      this.log("INFO", message, context);
    }
  }

  /**
   * 记录调试级别日志
   *
   * @param message 日志消息
   * @param context 日志上下文
   */
  debug(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog("debug")) {
      this.log("DEBUG", message, context);
    }
  }

  /**
   * 内部日志记录方法
   *
   * @param level 日志级别
   * @param message 日志消息
   * @param context 日志上下文
   * @private
   */
  private log(
    level: string,
    message: string,
    context?: Record<string, unknown>,
  ): void {
    const timestamp = new Date().toISOString();
    const logMessage = `${this.prefix}:${level} ${message}`;

    if (context && Object.keys(context).length > 0) {
      console.error(
        `${timestamp} ${logMessage}`,
        JSON.stringify(context, null, 2),
      );
    } else {
      console.error(`${timestamp} ${logMessage}`);
    }
  }

  /**
   * 检查是否应该记录指定级别的日志
   *
   * @param level 日志级别
   * @returns 是否应该记录
   * @private
   */
  private shouldLog(level: "error" | "warn" | "info" | "debug"): boolean {
    const levels = { error: 0, warn: 1, info: 2, debug: 3 };
    return levels[level] <= levels[this.level];
  }
}

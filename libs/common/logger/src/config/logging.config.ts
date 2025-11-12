/**
 * 日志模块配置
 *
 * 定义 Fastify 日志模块的配置选项，包括日志级别、格式、输出目标等。
 *
 * @description 提供类型安全的日志配置管理，支持运行时配置验证和环境变量覆盖。
 * 遵循 12-Factor App 配置原则，支持灵活的日志配置。
 *
 * ## 业务规则
 *
 * ### 日志级别规则
 * - fatal: 致命错误，应用无法继续运行
 * - error: 错误信息，需要立即关注
 * - warn: 警告信息，可能存在问题
 * - info: 常规信息，正常业务流程
 * - debug: 调试信息，开发阶段使用
 * - trace: 跟踪信息，详细的执行路径
 * - silent: 禁用所有日志
 *
 * ### 格式化规则
 * - 生产环境：使用 JSON 格式，便于日志聚合和分析
 * - 开发环境：使用 pretty 格式，便于阅读和调试
 * - 支持自定义格式化函数
 *
 * ### 输出规则
 * - 支持标准输出（stdout）
 * - 支持文件输出
 * - 支持远程日志服务
 * - 支持多个输出目标
 *
 * @example
 * ```typescript
 * import { LoggingConfig } from '@hl8/logger';
 * import { Type } from 'class-transformer';
 * import { IsString, IsBoolean, ValidateNested } from 'class-validator';
 *
 * class AppConfig {
 *   @ValidateNested()
 *   @Type(() => LoggingConfig)
 *   logging: LoggingConfig;
 * }
 *
 * // 使用配置
 * const config = {
 *   logging: {
 *     level: 'info',
 *     prettyPrint: false,
 *   }
 * };
 * ```
 *
 * @since 0.1.0
 */

import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
  IsArray,
} from "class-validator";
import { Type } from "class-transformer";

/**
 * 日志级别类型
 *
 * @description 定义支持的日志级别
 */
export type LogLevel =
  | "fatal"
  | "error"
  | "warn"
  | "info"
  | "debug"
  | "trace"
  | "silent";

/**
 * 上下文配置类
 *
 * @description 请求上下文自动注入配置
 *
 * @class ContextConfig
 */
export class ContextConfig {
  /**
   * 是否启用上下文注入
   *
   * @description 启用后，所有日志自动包含请求上下文
   *
   * @default true
   */
  @IsBoolean()
  @IsOptional()
  enabled?: boolean = true;

  /**
   * 是否包含请求详情
   *
   * @description 包括 method、url、path、query、ip、userAgent
   *
   * @default true
   */
  @IsBoolean()
  @IsOptional()
  includeRequestDetails?: boolean = true;

  /**
   * 是否包含响应详情
   *
   * @description 包括 statusCode、responseTime
   * 仅在响应阶段可用
   *
   * @default false
   */
  @IsBoolean()
  @IsOptional()
  includeResponseDetails?: boolean = false;

  /**
   * 是否包含用户信息
   *
   * @description 包括 userId、sessionId
   * 从请求头或认证信息提取
   *
   * @default false
   */
  @IsBoolean()
  @IsOptional()
  includeUserInfo?: boolean = false;
}

/**
 * 脱敏配置类
 *
 * @description 敏感信息脱敏配置
 *
 * @class SanitizerConfig
 */
export class SanitizerConfig {
  /**
   * 是否启用脱敏
   *
   * @description 启用后，自动脱敏敏感字段
   *
   * @default true
   */
  @IsBoolean()
  @IsOptional()
  enabled?: boolean = true;

  /**
   * 敏感字段列表
   *
   * @description 支持字符串和正则表达式
   * 默认包含：password、token、secret、apiKey、accessToken 等
   *
   * @default 默认敏感字段列表
   */
  @IsArray()
  @IsOptional()
  sensitiveFields?: (string | RegExp)[];

  /**
   * 脱敏占位符
   *
   * @description 脱敏后的替换值
   *
   * @default '***'
   */
  @IsString()
  @IsOptional()
  placeholder?: string = "***";

  /**
   * 自定义脱敏函数
   *
   * @description 自定义脱敏逻辑
   * 函数签名: (fieldName: string, value: unknown) => unknown
   *
   * @optional
   * @description 注意：class-validator 不提供 IsFunction 装饰器
   * 函数类型由 TypeScript 类型系统保证，运行时验证由调用方处理
   */
  @IsOptional()
  customSanitizer?: (fieldName: string, value: unknown) => unknown;
}

/**
 * 性能监控配置类
 *
 * @description 日志性能监控配置
 *
 * @class PerformanceConfig
 */
export class PerformanceConfig {
  /**
   * 是否启用性能监控
   *
   * @description 启用后，自动记录日志写入性能指标
   *
   * @default false
   */
  @IsBoolean()
  @IsOptional()
  enabled?: boolean = false;

  /**
   * 是否记录写入耗时
   *
   * @description 记录每次日志写入的耗时
   *
   * @default true
   */
  @IsBoolean()
  @IsOptional()
  trackLogWriteTime?: boolean = true;
}

/**
 * 错误处理配置类
 *
 * @description 日志写入失败时的降级策略配置
 *
 * @class ErrorHandlingConfig
 */
export class ErrorHandlingConfig {
  /**
   * 失败时降级到控制台
   *
   * @description 日志写入失败时，降级到 console.error
   * 开发环境建议启用
   *
   * @default false
   */
  @IsBoolean()
  @IsOptional()
  fallbackToConsole?: boolean = false;

  /**
   * 静默失败
   *
   * @description 日志写入失败时，不输出任何错误信息
   * 生产环境可以启用，避免日志错误影响应用
   *
   * @default false
   */
  @IsBoolean()
  @IsOptional()
  silentFailures?: boolean = false;
}

/**
 * 日志配置类
 *
 * @description 日志模块的配置选项
 *
 * @class LoggingConfig
 */
export class LoggingConfig {
  /**
   * 日志级别
   *
   * @description 设置最低日志级别，低于此级别的日志将被忽略
   *
   * ## 业务规则
   * - 生产环境建议使用 'info' 或 'warn'
   * - 开发环境建议使用 'debug' 或 'trace'
   * - 性能测试时可使用 'silent' 禁用日志
   *
   * @default 'info'
   */
  @IsIn(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
  @IsOptional()
  level: LogLevel = "info";

  /**
   * 是否使用美化输出
   *
   * @description 启用后将使用 pino-pretty 进行格式化，便于阅读
   *
   * ## 业务规则
   * - 开发环境建议启用
   * - 生产环境建议禁用（使用 JSON 格式）
   * - 禁用时输出 JSON 格式，便于日志分析系统处理
   *
   * @default false
   */
  @IsBoolean()
  @IsOptional()
  prettyPrint: boolean = false;

  /**
   * 是否包含时间戳
   *
   * @description 是否在日志中包含时间戳
   *
   * ## 业务规则
   * - 生产环境必须启用
   * - 便于日志时序分析
   * - ISO 8601 格式
   *
   * @default true
   */
  @IsBoolean()
  @IsOptional()
  timestamp: boolean = true;

  /**
   * 日志文件路径
   *
   * @description 日志文件的输出路径，未设置则仅输出到控制台
   *
   * ## 业务规则
   * - 生产环境建议设置
   * - 支持日志轮转
   * - 路径必须可写
   *
   * @optional
   */
  @IsString()
  @IsOptional()
  logFile?: string;

  /**
   * 是否记录请求详情
   *
   * @description 是否记录 HTTP 请求的详细信息（headers、body等）
   *
   * ## 业务规则
   * - 开发环境建议启用
   * - 生产环境需谨慎启用（可能包含敏感信息）
   * - 可能影响性能
   *
   * @default false
   */
  @IsBoolean()
  @IsOptional()
  logRequestDetails: boolean = false;

  /**
   * 是否记录响应详情
   *
   * @description 是否记录 HTTP 响应的详细信息
   *
   * ## 业务规则
   * - 开发环境建议启用
   * - 生产环境需谨慎启用
   * - 可能影响性能
   *
   * @default false
   */
  @IsBoolean()
  @IsOptional()
  logResponseDetails: boolean = false;

  /**
   * 是否启用日志
   *
   * @description 全局开关，禁用后不会产生任何日志
   *
   * ## 业务规则
   * - 通常应保持启用
   * - 特殊场景（如性能测试）可临时禁用
   *
   * @default true
   */
  @IsBoolean()
  @IsOptional()
  enabled: boolean = true;

  /**
   * 上下文配置
   *
   * @description 请求上下文自动注入配置
   *
   * ## 业务规则
   * - 启用后，所有日志自动包含请求上下文（requestId、method、url 等）
   * - 上下文提取开销 < 1ms
   * - 支持按需包含请求详情、响应详情、用户信息
   *
   * @default { enabled: true, includeRequestDetails: true, includeResponseDetails: false, includeUserInfo: false }
   */
  @ValidateNested()
  @Type(() => ContextConfig)
  @IsOptional()
  context?: ContextConfig;

  /**
   * 脱敏配置
   *
   * @description 敏感信息脱敏配置
   *
   * ## 业务规则
   * - 启用后，自动脱敏敏感字段（password、token 等）
   * - 支持自定义敏感字段列表和正则表达式
   * - 支持自定义脱敏函数
   * - 脱敏处理开销 < 2ms（普通对象）
   *
   * @default { enabled: true, placeholder: '***' }
   */
  @ValidateNested()
  @Type(() => SanitizerConfig)
  @IsOptional()
  sanitizer?: SanitizerConfig;

  /**
   * 性能监控配置
   *
   * @description 日志性能监控配置
   *
   * ## 业务规则
   * - 启用后，自动记录日志写入性能指标
   * - 指标包括：写入耗时、频率、级别分布、大小分布
   * - 性能监控开销 < 0.5ms
   *
   * @default { enabled: false, trackLogWriteTime: true }
   */
  @ValidateNested()
  @Type(() => PerformanceConfig)
  @IsOptional()
  performance?: PerformanceConfig;

  /**
   * 错误处理配置
   *
   * @description 日志写入失败时的降级策略配置
   *
   * ## 业务规则
   * - 降级到控制台：开发环境建议启用
   * - 静默失败：生产环境可以启用，避免日志错误影响应用
   * - 错误指标会自动记录到 Metrics（如果可用）
   *
   * @default { fallbackToConsole: false, silentFailures: false }
   */
  @ValidateNested()
  @Type(() => ErrorHandlingConfig)
  @IsOptional()
  errorHandling?: ErrorHandlingConfig;
}

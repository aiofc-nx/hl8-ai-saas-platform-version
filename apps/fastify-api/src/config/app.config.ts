/**
 * 应用配置类
 *
 * @description 定义 Fastify API 应用的完整配置结构，支持类型安全和运行时验证
 *
 * ## 设计原则
 *
 * ### 单一配置源
 * - 日志配置在 @hl8/logger 中定义（单一真相源）
 * - 应用层只负责组合和使用这些配置类
 * - 避免重复定义，遵循 DRY 原则
 *
 * ### 配置组合
 * - 应用配置类（AppConfig）组合多个库级配置类
 * - 每个配置类职责单一，易于维护
 * - 支持独立演进和版本管理
 *
 * ### 环境变量规则
 * - 使用 `__` 作为嵌套分隔符（例如：REDIS__HOST、LOGGING__LEVEL）
 * - 支持 .env 和 .env.local 文件
 * - 环境变量优先级高于配置文件
 *
 * ### 验证规则
 * - 使用 class-validator 装饰器进行验证
 * - 使用 class-transformer 进行类型转换
 * - 支持嵌套配置对象的验证
 *
 * @example
 * ```typescript
 * // .env 文件
 * NODE_ENV=development
 * PORT=3000
 * LOGGING__LEVEL=info
 * LOGGING__PRETTY_PRINT=true
 * REDIS__HOST=localhost
 * REDIS__PORT=6379
 * CACHE__TTL=3600
 * METRICS__PATH=/metrics
 *
 * // 使用配置
 * constructor(private readonly config: AppConfig) {}
 *
 * // 访问配置
 * const logLevel = this.config.logging.level;
 * const redisHost = this.config.redis.host;
 * ```
 */

import { Type } from "class-transformer";
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";

// 从 @hl8/logger 导入日志配置类（单一配置源）
import { LoggingConfig } from "@hl8/logger";
import {
  SwaggerConfig as BaseSwaggerConfig,
  SwaggerServer,
} from "@hl8/swagger";

/**
 * Swagger 配置
 *
 * @description Swagger API 文档相关配置
 */
export class SwaggerConfig extends BaseSwaggerConfig {
  /**
   * @description 是否启用 Swagger 文档
   */
  enabled = true;

  /**
   * @description Swagger UI 默认访问路径
   */
  swaggerPath = "api-docs";

  /**
   * @description API 文档标题
   */
  title = "HL8 SAAS Platform API";

  /**
   * @description 文档详细描述
   */
  description =
    "🚀 HL8 SAAS 平台企业级 RESTful API\n\n" +
    "## 特性\n" +
    "- 🔐 基于 JWT 的认证和授权\n" +
    "- 🏢 多租户数据隔离\n" +
    "- 📊 完整的 CRUD 操作\n" +
    "- ⚡ 高性能缓存\n" +
    "- 🛡️ 安全防护和限流\n" +
    "- 📝 标准化错误响应（RFC7807）\n\n" +
    "## 认证\n" +
    "大部分 API 需要 Bearer Token 认证。\n" +
    '点击右上角 "Authorize" 按钮输入您的 Token。';

  /**
   * @description 文档版本号
   */
  version = "1.0.0";

  /**
   * @description 联系人名称
   */
  contactName = "HL8 SAAS Platform Team";

  /**
   * @description 联系人邮箱
   */
  contactEmail = "support@hl8.com";

  /**
   * @description 联系人官网链接
   */
  contactUrl = "https://github.com/your-org/hl8-saas-platform";

  /**
   * @description 公开的服务器列表
   */
  servers: SwaggerServer[] = [
    SwaggerConfig.createServer("http://localhost:3001", "Development Server"),
    SwaggerConfig.createServer("https://staging-api.hl8.com", "Staging Server"),
    SwaggerConfig.createServer("https://api.hl8.com", "Production Server"),
  ];

  /**
   * @description 创建 SwaggerServer 实例，确保通过 class-validator 校验
   * @param url 服务器访问地址
   * @param description 服务器描述信息
   * @returns SwaggerServer 实例
   */
  private static createServer(url: string, description: string): SwaggerServer {
    const server = new SwaggerServer();
    server.url = url;
    server.description = description;
    return server;
  }
}

/**
 * 应用配置
 *
 * @description Fastify API 应用的根配置
 */
export class AppConfig {
  /**
   * 应用运行环境
   *
   * @default 'development'
   */
  @IsString()
  @IsIn(["development", "production", "test"])
  @IsOptional()
  public readonly NODE_ENV: string = "development";

  /**
   * 应用端口
   *
   * @default 3000
   */
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  public readonly PORT: number = 3000;

  /**
   * 应用主机地址
   *
   * @default '0.0.0.0'
   */
  @IsString()
  @IsOptional()
  public readonly HOST: string = "0.0.0.0";

  /**
   * 日志级别（用于 Fastify 初始化）
   *
   * @description 兼容 LOG_LEVEL 和 LOGGING__LEVEL
   * @default 'info'
   */
  @IsString()
  @IsIn(["fatal", "error", "warn", "info", "debug", "trace"])
  @IsOptional()
  public readonly LOG_LEVEL?: string;

  /**
   * 日志配置
   *
   * @description 直接使用 @hl8/logger 的 LoggingConfig
   */
  @ValidateNested()
  @Type(() => LoggingConfig)
  @IsOptional()
  public readonly logging: LoggingConfig = new LoggingConfig();

  /**
   * Swagger 配置
   *
   * @description Swagger API 文档配置
   */
  @ValidateNested()
  @Type(() => SwaggerConfig)
  @IsOptional()
  public readonly swagger: SwaggerConfig = new SwaggerConfig();
}

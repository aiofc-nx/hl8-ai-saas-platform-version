import type { Abstract, ValidationPipeOptions } from "@nestjs/common";
import type { Type } from "@nestjs/common";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { FastifyAdapter } from "@nestjs/platform-fastify";
import type { Logger } from "@hl8/logger";
import type {
  SetupSwaggerOptions,
  SwaggerConfig as SwaggerDocumentConfig,
} from "../../../../swagger/dist/index.js";
import type { BuildFastifyAdapterOptions } from "./fastify-adapter.factory.js";

/**
 * @description Fastify 启动所需的基础配置模型，定义最小启动参数集合
 */
export interface FastifyBootstrapConfig {
  /**
   * @description 应用监听端口，如 3000
   */
  PORT: number;
  /**
   * @description 应用监听主机，如 0.0.0.0
   */
  HOST: string;
  /**
   * @description 当前运行环境字符串，如 development、production
   */
  NODE_ENV: string;
}

/**
 * @description 构建 Fastify 应用时的上下文数据，聚合引导阶段所有依赖
 * @typeParam TConfig 配置类型
 * @typeParam TLogger 日志类型
 */
export interface FastifyApplicationContext<
  TConfig extends FastifyBootstrapConfig,
  TLogger extends Logger = Logger,
> {
  /**
   * @description NestFastifyApplication 实例
   */
  app: NestFastifyApplication;
  /**
   * @description 应用配置对象，可能因依赖注入失败而为空
   */
  config?: TConfig;
  /**
   * @description 原始 Logger 实例，用于日志扩展
   */
  logger?: TLogger;
  /**
   * @description 引导阶段使用的 Logger 实例（可能是 child logger）
   */
  bootstrapLogger?: TLogger;
}

/**
 * @description 创建 Fastify 应用时的参数定义，控制应用初始化阶段的行为
 * @typeParam TConfig 配置类型
 * @typeParam TLogger 日志类型
 */
export interface CreateFastifyApplicationOptions<
  TConfig extends FastifyBootstrapConfig,
  TLogger extends Logger = Logger,
> {
  /**
   * @description 应用根模块类型
   */
  module: Type<unknown>;
  /**
   * @description 自定义 FastifyAdapter 实例
   */
  adapter?: FastifyAdapter;
  /**
   * @description FastifyAdapter 构建选项，仅在未提供 adapter 时生效
   */
  adapterOptions?: BuildFastifyAdapterOptions;
  /**
   * @description 配置类注入标识，用于获取 `FastifyBootstrapConfig`
   */
  appConfigToken?: NestProviderToken<TConfig>;
  /**
   * @description Logger 注入标识，默认从 Nest 容器内解析
   */
  loggerToken?: NestProviderToken<TLogger>;
  /**
   * @description Logger child 上下文字段，用于扩展日志上下文
   */
  loggerChildContext?: Record<string, unknown>;
  /**
   * @description 是否启用 Fastify 与 Express 兼容建议，默认开启
   */
  applyExpressCompatibility?: boolean;
  /**
   * @description 是否启用应用优雅关闭钩子，默认开启
   */
  enableShutdownHooks?: boolean;
  /**
   * @description 自定义应用创建完成后的钩子，可用于注入额外逻辑
   */
  onAppCreated?: (
    context: FastifyApplicationContext<TConfig, TLogger>,
  ) => Promise<void> | void;
}

/**
 * @description 启动 Fastify 应用的参数定义，涵盖 CORS、验证、横幅等常见配置
 * @typeParam TConfig 配置类型
 */
export interface BootstrapFastifyApplicationOptions<
  TConfig extends FastifyBootstrapConfig,
> {
  /**
   * @description 应用配置对象，驱动监听端口和横幅信息
   */
  config: TConfig;
  /**
   * @description CORS 配置对象，默认回退到通配策略
   */
  corsOptions?: Parameters<NestFastifyApplication["enableCors"]>[0];
  /**
   * @description 全局验证管道配置，默认使用启用白名单的 ValidationPipe
   */
  validationPipeOptions?: ValidationPipeOptions;
  /**
   * @description 自定义横幅输出函数，可覆盖默认控制台文案
   */
  bannerPrinter?: (config: TConfig) => void;
  /**
   * @description 监听完成后的钩子，用于执行额外初始化逻辑
   */
  onAfterListen?: (
    app: NestFastifyApplication,
    config: TConfig,
  ) => Promise<void> | void;
  /**
   * @description Swagger 文档集成配置，将在监听前自动执行 setupSwagger
   */
  swagger?: BootstrapSwaggerOptions;
}

/**
 * @description Nest 依赖注入标识类型，兼容字符串、Symbol 与构造函数
 * @typeParam T 目标实例类型
 */
export type NestProviderToken<T> =
  | string
  | symbol
  | Type<T>
  | Abstract<T>
  | ((...args: never[]) => T);

export type { Logger };

/**
 * @description Bootstrap 阶段 Swagger 集成配置，封装了文档配置与自定义选项
 */
export interface BootstrapSwaggerOptions extends SetupSwaggerOptions {
  /**
   * @description Swagger 文档配置对象
   */
  config: SwaggerDocumentConfig;
}

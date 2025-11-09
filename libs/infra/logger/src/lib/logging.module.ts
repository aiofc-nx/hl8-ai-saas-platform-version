/**
 * Fastify 日志模块
 *
 * @description 零配置的 Fastify 日志模块，自动使用 Fastify 内置的 Pino
 *
 * ## 特性
 * - ⚡ 零开销（复用 Fastify Pino）
 * - 🔍 便于日志分析和审计
 * - 🔧 支持配置化（可选）
 *
 * @since 0.1.0
 */

import { ConfigValidator } from "@hl8/config";
import { DynamicModule, Global, Module } from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import pino from "pino";
import { LoggingConfig } from "../config/logging.config.js";
import PinoLoggerService from "./pino-logger.service.js";

/**
 * 日志模块选项
 */
export interface PinoLoggerModuleOptions {
  /** 日志配置 */
  config?: Partial<LoggingConfig>;
}

@Global()
@Module({})
export class PinoLoggingModule {
  /**
   * 注册日志模块
   *
   * @description 创建并配置日志模块
   *
   * ## 业务规则
   * - 优先使用 Fastify 的 Pino 实例（零开销）
   * - 支持配置验证
   *
   * @param {PinoLoggerModuleOptions} options - 日志配置选项
   * @returns {DynamicModule} 动态模块
   *
   * @example
   * ```typescript
   * @Module({
   *   imports: [
   *     PinoLoggingModule.forRoot({
   *       config: {
   *         level: 'debug',
   *         prettyPrint: true,
   *       }
   *     })
   *   ]
   * })
   * export class AppModule {}
   * ```
   */
  static forRoot(options?: PinoLoggerModuleOptions): DynamicModule {
    // 验证和规范化配置
    const loggingConfig = options?.config
      ? ConfigValidator.validate(LoggingConfig, {
          ...new LoggingConfig(),
          ...options.config,
        })
      : new LoggingConfig();

    return {
      module: PinoLoggingModule,
      global: true,
      providers: [
        // 提供配置实例
        {
          provide: LoggingConfig,
          useValue: loggingConfig,
        },
        // 提供日志服务
        {
          provide: PinoLoggerService,
          useFactory: (
            httpAdapterHost: HttpAdapterHost,
            config: LoggingConfig,
          ) => {
            // 如果日志被禁用，返回静默日志实例
            if (!config.enabled) {
              return new PinoLoggerService(pino({ level: "silent" }), config);
            }

            // 获取 Fastify 实例
            const fastifyInstance =
              httpAdapterHost?.httpAdapter?.getInstance?.();

            // 如果 Fastify 实例不可用（例如在测试环境中），创建一个独立的 Pino 实例
            if (!fastifyInstance?.log) {
              // 在测试环境中，创建一个独立的 Pino 实例
              // 注意：这不会注册请求上下文钩子，因为需要 Fastify 实例
              const testLogger = pino({
                level: loggingConfig.level || "info",
                ...(loggingConfig.prettyPrint && {
                  transport: {
                    target: "pino-pretty",
                  },
                }),
              });

              return new PinoLoggerService(testLogger, loggingConfig);
            }

            // 使用 Fastify 的 Pino 实例（零开销）
            return new PinoLoggerService(fastifyInstance.log, loggingConfig);
          },
          inject: [HttpAdapterHost, LoggingConfig],
        },
      ],
      exports: [PinoLoggerService, LoggingConfig],
    };
  }
}

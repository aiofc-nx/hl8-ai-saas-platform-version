/**
 * @fileoverview 基础设施配置模块
 * @description 集成 @hl8/config 提供配置管理，支持配置加载、验证和依赖注入
 *
 * ## 业务规则
 *
 * ### 配置加载规则
 * - 支持环境变量覆盖
 * - 支持配置文件加载
 * - 支持多环境配置（开发、测试、生产）
 * - 配置加载失败时阻止应用启动
 *
 * ### 配置验证规则
 * - 使用 class-validator 进行配置验证
 * - 配置验证失败时阻止应用启动
 * - 提供详细的验证错误信息
 *
 * ### 模块注册规则
 * - 默认注册为全局模块（isGlobal: true）
 * - 自动注册配置类为提供者
 * - 支持依赖注入使用配置
 */

import { TypedConfigModule, directoryLoader, dotenvLoader } from "@hl8/config";
import { DynamicModule, Module, Provider } from "@nestjs/common";
import { Logger } from "@hl8/logger";
import { InfrastructureConfig } from "./schemas/infrastructure-config.schema.js";
import type { ConfigurationService } from "./configuration.interface.js";
import { ConfigurationServiceImpl } from "./configuration.service.js";

/**
 * @description 基础设施配置模块选项
 * @remarks 定义基础设施配置模块的配置选项
 */
export interface InfrastructureConfigModuleOptions {
  /**
   * @description 是否注册为全局模块
   * @remarks 默认 true，配置模块全局可用
   */
  isGlobal?: boolean;

  /**
   * @description 配置数据
   * @remarks 配置数据对象，支持环境变量覆盖
   */
  config?: Partial<InfrastructureConfig>;

  /**
   * @description 配置目录路径
   * @remarks 配置文件目录路径，用于加载配置文件
   */
  configDirectory?: string;

  /**
   * @description 是否启用环境变量加载
   * @remarks 默认 true，启用环境变量加载
   */
  enableEnvLoader?: boolean;

  /**
   * @description 环境变量分隔符
   * @remarks 环境变量分隔符，默认 '__'
   */
  envSeparator?: string;
}

/**
 * @description 基础设施配置模块
 * @remarks 提供基础设施模块的配置管理功能
 *
 * @example
 * ```typescript
 * @Module({
 *   imports: [
 *     InfrastructureConfigModule.forRoot({
 *       isGlobal: true,
 *       config: {
 *         eventStore: {
 *           connectionString: process.env.EVENT_STORE_CONNECTION_STRING,
 *           optimisticLockRetryCount: 3,
 *         },
 *       },
 *     }),
 *   ],
 * })
 * export class AppModule {}
 * ```
 */
@Module({})
export class InfrastructureConfigModule {
  /**
   * @description 注册基础设施配置模块
   * @remarks 创建并配置基础设施配置模块，支持启动时加载和校验配置信息
   *
   * ## 业务规则
   * - 配置加载失败时阻止应用启动
   * - 配置验证失败时阻止应用启动并给出明确的错误信息
   * - 支持多环境配置覆盖（开发、测试、生产）
   * - 支持环境变量覆盖
   *
   * @param options - 配置模块选项
   * @returns 动态模块
   * @throws {ConfigurationException} 当配置加载或验证失败时，阻止应用启动
   */
  static forRoot(
    options: InfrastructureConfigModuleOptions = {},
  ): DynamicModule {
    const {
      isGlobal = true,
      config = {},
      configDirectory,
      enableEnvLoader = true,
      envSeparator = "__",
    } = options;

    // 构建配置加载器列表
    // 使用 ConfigLoader 类型，它是 (...args: unknown[]) => ConfigRecord 的别名
    const loaders: Array<
      (previousConfig?: unknown) => Record<string, unknown>
    > = [];

    // 添加配置文件加载器（如果提供配置目录）
    if (configDirectory) {
      loaders.push(
        directoryLoader({
          directory: configDirectory,
          include: /\.(json|yml|yaml)$/,
        }),
      );
    }

    // 添加环境变量加载器（如果启用）
    if (enableEnvLoader) {
      loaders.push(
        dotenvLoader({
          separator: envSeparator,
          envFilePath: ".env",
          ignoreEnvFile: false,
          ignoreEnvVars: false,
          enableExpandVariables: true,
        }),
      );
    }

    // 添加配置数据加载器（最后加载，优先级最高）
    loaders.push(() => config as Record<string, unknown>);

    // 创建配置模块
    const configModule = TypedConfigModule.forRoot({
      schema: InfrastructureConfig,
      load: loaders.length > 1 ? loaders : loaders[0]!,
      isGlobal,
      validationOptions: {
        whitelist: true, // 只允许已定义的属性
        forbidNonWhitelisted: true, // 禁止未定义的属性
      },
    });

    // 创建配置服务提供者
    const providers: Provider[] = [
      // 配置服务
      {
        provide: "ConfigurationService",
        useFactory: (
          infrastructureConfig: InfrastructureConfig,
          logger?: Logger,
        ): ConfigurationService => {
          return new ConfigurationServiceImpl(infrastructureConfig, logger);
        },
        inject: [InfrastructureConfig, { token: Logger, optional: true }],
      },
    ];

    // 合并提供者
    return {
      ...configModule,
      providers: [...(configModule.providers || []), ...providers],
      exports: [
        ...(configModule.exports || []),
        "ConfigurationService",
        InfrastructureConfig,
      ],
    };
  }
}

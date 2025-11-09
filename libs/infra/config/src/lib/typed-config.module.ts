import { DynamicModule, Module, Provider } from "@nestjs/common";
import chalk from "chalk";
import type { ClassConstructor } from "class-transformer";
import type { ValidationError, ValidatorOptions } from "class-validator";
import merge from "lodash.merge";
import { CacheManager, CacheOptions } from "./cache/index.js";
import { ErrorHandler } from "./errors/index.js";
import {
  TypedConfigModuleAsyncOptions,
  TypedConfigModuleOptions,
} from "./interfaces/typed-config-module-options.interface.js";
import { ConfigRecord } from "./types/index.js";
import { debug } from "./utils/debug.util.js";
import { forEachDeep } from "./utils/for-each-deep.util.js";
import { identity } from "./utils/identity.util.js";
import { plainToClass, validateSync } from "./utils/imports.util.js";

@Module({})
export class TypedConfigModule {
  /**
   * 创建类型化配置模块
   *
   * 同步创建类型化配置模块，加载和验证配置后返回可用的动态模块。
   * 适用于配置数据已准备好且无需异步加载的场景。
   *
   * @description 此方法执行同步的配置加载、验证和模块创建流程。
   * 支持多个配置加载器的链式调用，后续加载器会覆盖前面的配置。
   * 配置验证失败时会抛出详细的错误信息并阻止模块创建。
   *
   * ## 业务规则
   *
   * ### 配置加载规则
   * - 支持单个或多个同步配置加载器
   * - 配置加载器按数组顺序执行
   * - 后续配置会深度合并到前面的配置中
   * - 配置加载失败时抛出 ConfigError 异常
   *
   * ### 配置验证规则
   * - 使用 class-validator 进行配置验证
   * - 支持自定义验证选项和验证函数
   * - 验证失败时提供详细的错误路径和约束信息
   * - 验证通过后返回类型化的配置对象
   *
   * ### 模块注册规则
   * - 默认注册为全局模块（isGlobal: true）
   * - 自动注册配置类和嵌套配置对象为提供者
   * - 支持可选的缓存管理器注册
   * - 提供者可在整个应用中进行依赖注入
   *
   * ## 业务逻辑流程
   *
   * 1. **配置加载**：执行所有配置加载器获取原始配置
   * 2. **配置合并**：深度合并多个配置加载器的结果
   * 3. **配置标准化**：执行自定义的配置转换逻辑
   * 4. **配置验证**：使用 class-validator 验证配置完整性
   * 5. **提供者创建**：创建配置类和嵌套对象的提供者
   * 6. **缓存初始化**：初始化配置缓存（如果启用）
   * 7. **模块返回**：返回完整的动态模块
   *
   * @param options - 配置模块选项，包含配置类、加载器和验证选项
   * @returns 配置完成的动态模块，可直接导入到 NestJS 应用中
   *
   * @throws {ConfigError} 当配置加载失败时抛出
   * @throws {ValidationError} 当配置验证失败时抛出
   * @throws {Error} 当模块创建过程中发生未知错误时抛出
   *
   * @example
   * ```typescript
   * // 基础用法
   * const module = TypedConfigModule.forRoot({
   *   schema: RootConfig,
   *   load: fileLoader({ path: './config/app.yml' })
   * });
   *
   * // 多加载器用法
   * const module = TypedConfigModule.forRoot({
   *   schema: RootConfig,
   *   load: [
   *     fileLoader({ path: './config/default.yml' }),
   *     dotenvLoader({ separator: '__' }),
   *     fileLoader({ path: './config/local.yml' })
   *   ],
   *   validationOptions: { whitelist: true }
   * });
   *
   * // 自定义验证函数用法
   * const module = TypedConfigModule.forRoot({
   *   schema: RootConfig,
   *   load: fileLoader(),
   *   validate: (config) => {
   *     // 自定义验证逻辑
   *     if (config.port < 1024) {
   *       throw new Error('Port must be >= 1024');
   *     }
   *     return config;
   *   }
   * });
   * ```
   */
  public static forRoot(options: TypedConfigModuleOptions): DynamicModule {
    const rawConfig = this.getRawConfig(options.load);
    return this.getDynamicModule(options, rawConfig);
  }

  /**
   * 异步创建类型化配置模块
   *
   * 异步创建类型化配置模块，支持从远程服务或异步数据源加载配置。
   * 适用于需要从数据库、远程API或其他异步源加载配置的场景。
   *
   * @description 此方法执行异步的配置加载、验证和模块创建流程。
   * 支持异步配置加载器，如远程配置服务、数据库配置等。
   * 配置加载和验证失败时会抛出详细的错误信息并阻止模块创建。
   *
   * ## 业务规则
   *
   * ### 异步加载规则
   * - 支持单个或多个异步配置加载器
   * - 异步加载器按顺序执行，支持 Promise 链式调用
   * - 支持同步和异步加载器混合使用
   * - 异步加载失败时抛出 ConfigError 异常
   *
   * ### 配置合并规则
   * - 多个加载器按数组顺序执行
   * - 后续加载器的配置会深度合并到前面的配置中
   * - 支持配置对象的深度合并和覆盖
   * - 配置合并失败时抛出合并错误
   *
   * ### 错误处理规则
   * - 配置加载失败时提供详细的错误信息
   * - 支持错误上下文和堆栈跟踪
   * - 错误信息包含加载器名称和配置路径
   * - 错误会阻止模块创建和应用启动
   *
   * ## 业务逻辑流程
   *
   * 1. **异步加载**：顺序执行异步配置加载器
   * 2. **配置合并**：深度合并多个配置加载器的结果
   * 3. **配置标准化**：执行自定义的配置转换逻辑
   * 4. **配置验证**：使用 class-validator 验证配置完整性
   * 5. **提供者创建**：创建配置类和嵌套对象的提供者
   * 6. **缓存初始化**：初始化配置缓存（如果启用）
   * 7. **模块返回**：返回完整的动态模块
   *
   * @param options - 异步配置模块选项，包含配置类、异步加载器和验证选项
   * @returns Promise<DynamicModule> 配置完成的动态模块，可直接导入到 NestJS 应用中
   *
   * @throws {ConfigError} 当配置加载失败时抛出
   * @throws {ValidationError} 当配置验证失败时抛出
   * @throws {Error} 当模块创建过程中发生未知错误时抛出
   *
   * @example
   * ```typescript
   * import { TypedConfigModule, fileLoader, dotenvLoader, remoteLoader } from '@hl8/config';
   *
   * // 远程配置加载
   * const module = await TypedConfigModule.forRootAsync({
   *   schema: RootConfig,
   *   load: remoteLoader('http://config-server/api/config')
   * });
   *
   * // 混合加载器用法
   * const module = await TypedConfigModule.forRootAsync({
   *   schema: RootConfig,
   *   load: [
   *     fileLoader({ path: './config/default.yml' }),
   *     remoteLoader('http://config-server/api/config'),
   *     dotenvLoader({ separator: '__' })
   *   ]
   * });
   *
   * // 数据库配置加载
   * const module = await TypedConfigModule.forRootAsync({
   *   schema: RootConfig,
   *   load: async () => {
   *     const config = await database.getConfig('app');
   *     return config;
   *   }
   * });
   * ```
   */
  public static async forRootAsync(
    options: TypedConfigModuleAsyncOptions,
  ): Promise<DynamicModule> {
    const rawConfig = await this.getRawConfigAsync(options.load);
    return this.getDynamicModule(options, rawConfig);
  }

  /**
   * 获取动态模块
   *
   * @description 创建动态模块
   * @param options 配置模块选项
   * @param rawConfig 原始配置
   * @returns 动态模块
   * @since 1.0.0
   */
  private static getDynamicModule(
    options: TypedConfigModuleOptions | TypedConfigModuleAsyncOptions,
    rawConfig: ConfigRecord,
  ) {
    const {
      schema: Config,
      normalize = identity,
      validationOptions,
      isGlobal = true,
      validate = this.validateWithClassValidator.bind(this),
      cacheOptions,
    } = options;

    if (typeof rawConfig !== "object") {
      throw new Error(
        `Configuration should be an object, received: ${rawConfig}. Please check the return value of \`load()\``,
      );
    }

    const normalized = normalize(rawConfig);
    const config = validate(normalized, Config, validationOptions) as unknown;
    const providers = this.getProviders(config, Config, cacheOptions);

    return {
      global: isGlobal,
      module: TypedConfigModule,
      providers,
      exports: providers,
    };
  }

  /**
   * 获取原始配置
   *
   * @description 同步获取原始配置
   * @param load 配置加载器
   * @returns 原始配置对象
   * @author HL8 SAAS Platform Team
   * @since 1.0.0
   */
  private static getRawConfig(load: TypedConfigModuleOptions["load"]) {
    if (Array.isArray(load)) {
      const config = {};
      for (const fn of load) {
        try {
          const conf = fn(config);
          merge(config, conf);
        } catch (e: unknown) {
          const error = e as Error & { details?: unknown };
          debug(
            `Config load failed: ${error}. Details: ${JSON.stringify(
              error.details,
            )}`,
          );
          throw e;
        }
      }
      return config;
    }
    return load();
  }

  /**
   * 异步获取原始配置
   *
   * @description 异步获取原始配置
   * @param load 配置加载器
   * @returns Promise<原始配置对象>
   * @author HL8 SAAS Platform Team
   * @since 1.0.0
   */
  private static async getRawConfigAsync(
    load: TypedConfigModuleAsyncOptions["load"],
  ) {
    if (Array.isArray(load)) {
      const config = {};
      for (const fn of load) {
        try {
          const conf = await fn(config);
          merge(config, conf);
        } catch (e: unknown) {
          const error = e as Error & { details?: unknown };
          debug(
            `Config load failed: ${error}. Details: ${JSON.stringify(
              error.details,
            )}`,
          );
          throw e;
        }
      }
      return config;
    }
    return load();
  }

  /**
   * 获取提供者
   *
   * @description 创建配置提供者
   * @param config 配置对象
   * @param Config 配置类
   * @returns 提供者数组
   * @author HL8 SAAS Platform Team
   * @since 1.0.0
   *
   * @remarks
   * 使用 any 符合宪章 IX 允许场景：配置对象和配置类类型动态。
   */

  private static getProviders(
    config: unknown,
    Config: ClassConstructor<unknown>,
    cacheOptions?: CacheOptions,
  ): Provider[] {
    const providers: Provider[] = [
      {
        provide: Config,
        useValue: config,
      },
    ];

    // 添加缓存管理器提供者
    if (cacheOptions) {
      providers.push({
        provide: CacheManager,
        useValue: new CacheManager(cacheOptions),
      });
    }

    forEachDeep(config, (value: unknown) => {
      if (
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        value.constructor !== Object
      ) {
        providers.push({ provide: value.constructor, useValue: value });
      }
    });

    return providers;
  }

  /**
   * 使用 class-validator 验证配置
   *
   * @description 使用 class-validator 验证配置
   * @param rawConfig 原始配置
   * @param Config 配置类
   * @param options 验证选项
   * @returns 验证后的配置
   * @author HL8 SAAS Platform Team
   * @since 1.0.0
   */
  private static validateWithClassValidator(
    rawConfig: ConfigRecord,
    Config: ClassConstructor<ConfigRecord>,
    options?: Partial<ValidatorOptions>,
  ) {
    const config = plainToClass(Config, rawConfig, {
      enableImplicitConversion: true,
      exposeDefaultValues: true,
    });

    // 默认使用最严格的验证规则
    const schemaErrors = validateSync(config, {
      forbidUnknownValues: true,
      whitelist: true,
      ...options,
    });

    if (schemaErrors.length > 0) {
      throw ErrorHandler.handleValidationError(schemaErrors, {
        configClass: Config.name,
        rawConfigKeys: Object.keys(rawConfig),
        validationOptions: options,
      });
    }

    return config;
  }

  /**
   * 获取配置错误消息
   *
   * @description 格式化配置错误消息
   * @param errors 验证错误数组
   * @returns 格式化的错误消息
   * @author HL8 SAAS Platform Team
   * @since 1.0.0
   */
  static getConfigErrorMessage(errors: ValidationError[]): string {
    const messages = this.formatValidationError(errors)
      .map(({ property, value, constraints }) => {
        const constraintMessage = Object.entries(constraints || {})
          .map(
            ([key, val]) =>
              `    - ${key}: ${chalk.yellow(
                val,
              )}, current config is \`${chalk.blue(JSON.stringify(value))}\``,
          )
          .join(`\n`);
        const msg = [
          `  - config ${chalk.cyan(
            property,
          )} does not match the following rules:`,
          `${constraintMessage}`,
        ].join(`\n`);
        return msg;
      })
      .filter(Boolean)
      .join(`\n`);

    const configErrorMessage = chalk.red(
      `Configuration is not valid:\n${messages}\n`,
    );
    return configErrorMessage;
  }

  /**
   * 格式化验证错误
   *
   * @description 将 class-validator 返回的验证错误对象转换为更可读的错误消息
   * @param errors 验证错误数组
   * @returns 格式化的错误对象数组
   * @author HL8 SAAS Platform Team
   * @since 1.0.0
   */
  private static formatValidationError(errors: ValidationError[]) {
    const result: {
      property: string;
      constraints: ValidationError["constraints"];
      value: ValidationError["value"];
    }[] = [];

    const helper = (
      { property, constraints, children, value }: ValidationError,
      prefix: string,
    ) => {
      const keyPath = prefix ? `${prefix}.${property}` : property;
      if (constraints) {
        result.push({
          property: keyPath,
          constraints,
          value,
        });
      }
      if (children && children.length) {
        children.forEach((child) => helper(child, keyPath));
      }
    };

    errors.forEach((error) => helper(error, ""));
    return result;
  }
}

/**
 * 类型化配置模块选项接口
 *
 * 定义类型化配置模块的配置选项和参数接口，支持同步和异步配置加载。
 * 提供完整的配置管理选项，包括加载器、验证器、缓存等配置。
 *
 * @description 此接口定义了配置模块的所有可用选项，支持灵活的配置管理。
 * 包括配置类定义、加载器配置、验证选项、缓存设置等完整功能。
 * 遵循 TypeScript 接口设计原则，提供类型安全和智能提示。
 *
 * ## 业务规则
 *
 * ### 配置类规则
 * - 配置类必须继承自基础配置类或使用装饰器
 * - 支持嵌套配置类和配置对象
 * - 配置类必须支持 class-transformer 转换
 * - 配置类必须支持 class-validator 验证
 *
 * ### 加载器规则
 * - 支持单个或多个配置加载器
 * - 配置加载器按顺序执行
 * - 后续配置会深度合并到前面的配置
 * - 支持同步和异步加载器混合使用
 *
 * ### 验证规则
 * - 默认使用 class-validator 进行配置验证
 * - 支持自定义验证函数和验证选项
 * - 验证失败时阻止应用启动
 * - 提供详细的验证错误信息
 *
 * ### 缓存规则
 * - 支持可选的配置缓存功能
 * - 缓存键基于配置内容和配置类
 * - 支持缓存失效和更新策略
 * - 提供缓存统计和监控功能
 */

import type { ClassConstructor } from "class-transformer";
import type { ValidatorOptions } from "class-validator";
import { CacheOptions } from "../types/cache.types.js";
import {
  AsyncConfigLoader,
  ConfigLoader,
  ConfigNormalizer,
  ConfigRecord,
  ConfigValidator,
} from "../types/index.js";

// 重新导出类型以保持向后兼容
export type {
  AsyncConfigLoader,
  ConfigLoader,
  ConfigNormalizer,
  ConfigRecord,
  ConfigValidator,
} from "../types/index.js";

/**
 * 类型化配置模块选项接口
 *
 * 定义同步配置模块的所有配置选项，包括配置类、加载器、验证器等。
 * 支持完整的配置管理功能，提供类型安全的配置选项定义。
 *
 * @description 此接口定义了同步配置模块的所有可用选项。
 * 包括必需的配置类和加载器，以及可选的验证、缓存等高级功能。
 * 遵循 TypeScript 接口设计原则，提供完整的类型定义。
 *
 * ## 业务规则
 *
 * ### 必需选项规则
 * - schema：配置类必须提供，用于类型推断和验证
 * - load：配置加载器必须提供，支持单个或多个加载器
 *
 * ### 可选选项规则
 * - isGlobal：默认为 true，配置模块为全局可用
 * - normalize：自定义配置标准化函数，在验证前执行
 * - validate：自定义验证函数，覆盖默认验证逻辑
 * - validationOptions：class-validator 验证选项
 * - cacheOptions：配置缓存选项
 *
 * @example
 * ```typescript
 * import { fileLoader, dotenvLoader } from '@hl8/config';
 *
 * // 基础配置选项
 * const options: TypedConfigModuleOptions = {
 *   schema: RootConfig,
 *   load: fileLoader({ path: './config/app.yml' })
 * };
 *
 * // 完整配置选项
 * const options: TypedConfigModuleOptions = {
 *   schema: RootConfig,
 *   load: [fileLoader(), dotenvLoader()],
 *   isGlobal: true,
 *   normalize: (config) => ({ ...config, processed: true }),
 *   validationOptions: { whitelist: true },
 *   cacheOptions: { ttl: 3600 }
 * };
 * ```
 */
export interface TypedConfigModuleOptions {
  /**
   * 应用配置的根对象类
   *
   * 配置的根类定义，用于类型推断、配置验证和依赖注入。
   * 必须是支持 class-transformer 和 class-validator 的类。
   *
   * @description 配置类的构造函数，用于创建类型化的配置实例。
   * 支持嵌套配置类，提供完整的 TypeScript 类型支持。
   *
   * ## 业务规则
   * - 配置类必须支持 class-transformer 装饰器
   * - 配置类必须支持 class-validator 验证
   * - 支持嵌套配置类和配置对象
   * - 配置类会自动注册为 NestJS 提供者
   */
  schema: ClassConstructor<ConfigRecord>;

  /**
   * 加载配置的函数，必须是同步的
   *
   * 配置加载器函数或函数数组，用于从各种数据源加载配置。
   * 支持文件系统、环境变量、内存等多种配置源。
   *
   * @description 同步配置加载器，支持单个或多个加载器的链式调用。
   * 配置加载器按顺序执行，后续配置会深度合并到前面的配置中。
   *
   * ## 业务规则
   * - 支持单个加载器函数或加载器数组
   * - 加载器按数组顺序执行
   * - 后续配置会深度合并到前面的配置
   * - 配置加载失败时抛出 ConfigError 异常
   */
  load: ConfigLoader | ConfigLoader[];

  /**
   * 是否为全局模块
   *
   * 控制配置模块是否为全局模块，全局模块可在整个应用中直接使用。
   *
   * @description 默认为 true，将配置模块注册为全局模块。
   * 全局模块无需在需要使用的模块中显式导入。
   *
   * ## 业务规则
   * - 默认为 true，配置模块全局可用
   * - 设置为 false 时需要显式导入到使用模块
   * - 全局模块支持在整个应用中进行依赖注入
   *
   * @default true
   */
  isGlobal?: boolean;

  /**
   * 自定义配置标准化函数
   *
   * 在配置验证之前执行的自定义转换函数，用于类型转换、变量展开等。
   *
   * @description 配置标准化函数，在验证前对配置进行预处理。
   * 支持类型转换、环境变量展开、配置合并等操作。
   *
   * ## 业务规则
   * - 在配置验证之前执行
   * - 支持配置对象的深度转换
   * - 支持环境变量替换和默认值设置
   * - 转换失败时会抛出异常并阻止模块创建
   *
   * @param config - 包含环境变量的配置对象
   * @returns 标准化后的配置对象
   */
  normalize?: ConfigNormalizer;

  /**
   * 自定义配置验证函数
   *
   * 自定义的配置验证函数，用于覆盖默认的 class-validator 验证逻辑。
   *
   * @description 验证配置的函数，如果抛出异常将阻止应用启动。
   * 支持自定义验证逻辑，如业务规则验证、跨字段验证等。
   *
   * ## 业务规则
   * - 验证失败时抛出异常并阻止应用启动
   * - 支持自定义验证逻辑和业务规则
   * - 可以结合 class-validator 使用
   * - 验证通过后返回验证后的配置对象
   *
   * @param config - 待验证的配置对象
   * @returns 验证后的配置对象
   */
  validate?: ConfigValidator;

  /**
   * 验证器选项
   *
   * 传递给 class-validator 的验证选项，控制验证行为。
   *
   * @description class-validator 的验证选项，用于控制验证行为。
   * 支持白名单、黑名单、未知值处理等验证选项。
   *
   * ## 业务规则
   * - 传递给 class-validator 的 validateSync 方法
   * - 支持白名单、黑名单等验证选项
   * - 支持自定义验证错误消息
   * - 验证选项会影响验证的严格程度
   *
   * @see https://github.com/typestack/class-validator
   */
  validationOptions?: ValidatorOptions;

  /**
   * 缓存选项
   *
   * 配置缓存的选项设置，包括缓存时间、缓存键等。
   *
   * @description 配置缓存选项，用于提高配置访问性能。
   * 支持缓存时间设置、缓存键配置、缓存统计等功能。
   *
   * ## 业务规则
   * - 可选功能，不设置时不启用缓存
   * - 支持缓存时间（TTL）设置
   * - 支持缓存键自定义
   * - 提供缓存统计和监控功能
   */
  cacheOptions?: CacheOptions;
}

/**
 * 异步类型化配置模块选项接口
 *
 * 定义异步配置模块的所有配置选项，支持异步配置加载和远程配置源。
 * 继承同步配置模块的所有功能，并扩展异步加载能力。
 *
 * @description 此接口定义了异步配置模块的所有可用选项。
 * 支持异步配置加载器，如远程API、数据库等异步配置源。
 * 提供完整的异步配置管理功能，包括配置合并、验证等。
 *
 * ## 业务规则
 *
 * ### 异步加载规则
 * - 支持同步和异步配置加载器混合使用
 * - 异步加载器支持 Promise 和 async/await 语法
 * - 支持远程配置服务和数据库配置源
 * - 异步加载失败时提供详细的错误信息
 *
 * ### 配置合并规则
 * - 多个加载器按顺序执行
 * - 后续配置会深度合并到前面的配置中
 * - 支持配置对象的深度合并和覆盖
 * - 配置合并失败时抛出合并错误
 *
 * ### 错误处理规则
 * - 配置加载失败时提供详细的错误信息
 * - 支持错误上下文和堆栈跟踪
 * - 错误信息包含加载器名称和配置路径
 * - 错误会阻止模块创建和应用启动
 *
 * @example
 * ```typescript
 * import { fileLoader, remoteLoader } from '@hl8/config';
 *
 * // 异步配置选项
 * const options: TypedConfigModuleAsyncOptions = {
 *   schema: RootConfig,
 *   load: remoteLoader('http://config-server/api/config')
 * };
 *
 * // 混合异步配置选项
 * const options: TypedConfigModuleAsyncOptions = {
 *   schema: RootConfig,
 *   load: [
 *     fileLoader({ path: './config/default.yml' }),
 *     remoteLoader('http://config-server/api/config'),
 *     async () => await database.getConfig('app')
 *   ],
 *   isGlobal: true,
 *   cacheOptions: { ttl: 3600 }
 * };
 * ```
 */
export interface TypedConfigModuleAsyncOptions {
  /**
   * 应用配置的根对象类
   *
   * 配置的根类定义，用于类型推断、配置验证和依赖注入。
   * 与同步配置模块的 schema 选项功能完全相同。
   *
   * @description 配置类的构造函数，用于创建类型化的配置实例。
   * 支持嵌套配置类，提供完整的 TypeScript 类型支持。
   *
   * ## 业务规则
   * - 配置类必须支持 class-transformer 装饰器
   * - 配置类必须支持 class-validator 验证
   * - 支持嵌套配置类和配置对象
   * - 配置类会自动注册为 NestJS 提供者
   */
  schema: ClassConstructor<ConfigRecord>;

  /**
   * 加载配置的函数，可以是同步或异步的
   *
   * 配置加载器函数或函数数组，支持同步和异步加载器混合使用。
   * 支持远程API、数据库、文件系统等多种配置源。
   *
   * @description 异步配置加载器，支持同步和异步加载器的混合使用。
   * 配置加载器按顺序执行，支持 Promise 链式调用和并发执行。
   *
   * ## 业务规则
   * - 支持同步和异步配置加载器混合使用
   * - 异步加载器支持 Promise 和 async/await 语法
   * - 支持远程配置服务和数据库配置源
   * - 配置加载失败时抛出 ConfigError 异常
   */
  load: ConfigLoader | AsyncConfigLoader | (ConfigLoader | AsyncConfigLoader)[];

  /**
   * 是否为全局模块
   *
   * 控制配置模块是否为全局模块，全局模块可在整个应用中直接使用。
   * 与同步配置模块的 isGlobal 选项功能完全相同。
   *
   * @description 默认为 true，将配置模块注册为全局模块。
   * 全局模块无需在需要使用的模块中显式导入。
   *
   * ## 业务规则
   * - 默认为 true，配置模块全局可用
   * - 设置为 false 时需要显式导入到使用模块
   * - 全局模块支持在整个应用中进行依赖注入
   *
   * @default true
   */
  isGlobal?: boolean;

  /**
   * 自定义配置标准化函数
   *
   * 在配置验证之前执行的自定义转换函数，用于类型转换、变量展开等。
   * 与同步配置模块的 normalize 选项功能完全相同。
   *
   * @description 配置标准化函数，在验证前对配置进行预处理。
   * 支持类型转换、环境变量展开、配置合并等操作。
   *
   * ## 业务规则
   * - 在配置验证之前执行
   * - 支持配置对象的深度转换
   * - 支持环境变量替换和默认值设置
   * - 转换失败时会抛出异常并阻止模块创建
   *
   * @param config - 包含环境变量的配置对象
   * @returns 标准化后的配置对象
   */
  normalize?: ConfigNormalizer;

  /**
   * 自定义配置验证函数
   *
   * 自定义的配置验证函数，用于覆盖默认的 class-validator 验证逻辑。
   * 与同步配置模块的 validate 选项功能完全相同。
   *
   * @description 验证配置的函数，如果抛出异常将阻止应用启动。
   * 支持自定义验证逻辑，如业务规则验证、跨字段验证等。
   *
   * ## 业务规则
   * - 验证失败时抛出异常并阻止应用启动
   * - 支持自定义验证逻辑和业务规则
   * - 可以结合 class-validator 使用
   * - 验证通过后返回验证后的配置对象
   *
   * @param config - 待验证的配置对象
   * @returns 验证后的配置对象
   */
  validate?: ConfigValidator;

  /**
   * 验证器选项
   *
   * 传递给 class-validator 的验证选项，控制验证行为。
   * 与同步配置模块的 validationOptions 选项功能完全相同。
   *
   * @description class-validator 的验证选项，用于控制验证行为。
   * 支持白名单、黑名单、未知值处理等验证选项。
   *
   * ## 业务规则
   * - 传递给 class-validator 的 validateSync 方法
   * - 支持白名单、黑名单等验证选项
   * - 支持自定义验证错误消息
   * - 验证选项会影响验证的严格程度
   *
   * @see https://github.com/typestack/class-validator
   */
  validationOptions?: ValidatorOptions;

  /**
   * 缓存选项
   *
   * 配置缓存的选项设置，包括缓存时间、缓存键等。
   * 与同步配置模块的 cacheOptions 选项功能完全相同。
   *
   * @description 配置缓存选项，用于提高配置访问性能。
   * 支持缓存时间设置、缓存键配置、缓存统计等功能。
   *
   * ## 业务规则
   * - 可选功能，不设置时不启用缓存
   * - 支持缓存时间（TTL）设置
   * - 支持缓存键自定义
   * - 提供缓存统计和监控功能
   */
  cacheOptions?: CacheOptions;
}

/**
 * 配置类型定义
 *
 * @description 配置模块的通用类型定义
 * @author HL8 SAAS Platform Team
 * @since 1.0.0
 */

/**
 * 基础配置值类型
 *
 * @description 配置值可以是的基本类型
 * @type ConfigValue
 * @since 1.0.0
 */
export type ConfigValue = string | number | boolean | null | undefined;

/**
 * 配置对象类型
 *
 * @description 配置对象的类型定义
 * @type ConfigObject
 * @since 1.0.0
 */
export type ConfigObject = {
  [key: string]: ConfigValue | ConfigObject | ConfigValue[] | ConfigObject[];
};

/**
 * 配置记录类型
 *
 * @description 配置记录的类型定义，用于替代 Record<string, any>
 * @type ConfigRecord
 * @since 1.0.0
 *
 * @remarks
 * 使用 any 符合宪章 IX 允许场景：配置值可以是任意类型（字符串、数字、对象等）。
 * 配置库必须支持动态配置的灵活性。
 */

export type ConfigRecord = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

/**
 * 配置加载器函数类型
 *
 * @description 同步配置加载器的类型定义
 * @type ConfigLoader
 * @since 1.0.0
 */
export type ConfigLoader = (...args: unknown[]) => ConfigRecord;

/**
 * 异步配置加载器函数类型
 *
 * @description 异步配置加载器的类型定义
 * @type AsyncConfigLoader
 * @since 1.0.0
 */
export type AsyncConfigLoader = (...args: unknown[]) => Promise<ConfigRecord>;

/**
 * 配置规范化函数类型
 *
 * @description 配置规范化函数的类型定义
 * @type ConfigNormalizer
 * @since 1.0.0
 */
export type ConfigNormalizer = (config: ConfigRecord) => ConfigRecord;

/**
 * 配置验证函数类型
 *
 * @description 配置验证函数的类型定义
 * @type ConfigValidator
 * @since 1.0.0
 */
export type ConfigValidator = (config: ConfigRecord) => ConfigRecord;

/**
 * 键转换器函数类型
 *
 * @description 键转换器函数的类型定义
 * @type KeyTransformer
 * @since 1.0.0
 */
export type KeyTransformer = (key: string) => string;

/**
 * 响应映射器函数类型
 *
 * @description 响应映射器函数的类型定义
 * @type ResponseMapper
 * @since 1.0.0
 */
export type ResponseMapper<T = unknown> = (response: T) => ConfigRecord;

/**
 * 重试条件函数类型
 *
 * @description 重试条件函数的类型定义
 * @type RetryCondition
 * @since 1.0.0
 */
export type RetryCondition<T = unknown> = (response: T) => boolean;

/**
 * 配置解析器函数类型
 *
 * @description 配置解析器函数的类型定义
 * @type ConfigParser
 * @since 1.0.0
 */
export type ConfigParser = (content: string) => ConfigRecord;

/**
 * 环境变量替换器函数类型
 *
 * @description 环境变量替换器函数的类型定义
 * @type EnvSubstitutor
 * @since 1.0.0
 */
export type EnvSubstitutor = (config: ConfigRecord) => ConfigRecord;

/**
 * 深度遍历回调函数类型
 *
 * @description 深度遍历回调函数的类型定义
 * @type DeepTraverseCallback
 * @since 1.0.0
 */
export type DeepTraverseCallback = (
  value: ConfigValue | ConfigObject,
  key: string,
  path: string,
) => void;

/**
 * 错误上下文类型
 *
 * @description 错误上下文的类型定义
 * @type ErrorContext
 * @since 1.0.0
 */
export type ErrorContext = Record<string, ConfigValue | ConfigObject>;

/**
 * 验证错误类型
 *
 * @description 验证错误的类型定义
 * @type ValidationError
 * @since 1.0.0
 */
export interface ValidationError {
  property: string;
  value: ConfigValue | ConfigObject;
  constraints?: Record<string, string>;
  children?: ValidationError[];
}

/**
 * 网络响应类型
 *
 * @description 网络响应的类型定义
 * @type NetworkResponse
 * @since 1.0.0
 */
export interface NetworkResponse {
  status: number;
  data: ConfigRecord;
  headers?: Record<string, string>;
}

/**
 * 请求配置类型
 *
 * @description 请求配置的类型定义
 * @type RequestConfig
 * @since 1.0.0
 */
export interface RequestConfig {
  method?: string;
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  retryInterval?: number;
}

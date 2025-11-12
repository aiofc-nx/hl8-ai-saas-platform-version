/**
 * Config 模块常量定义
 *
 * @description 定义配置模块中使用的常量
 * 用于依赖注入、缓存键、加载器类型和默认配置
 *
 * ## 最佳实践
 *
 * - ✅ 使用 `as const` 确保类型推断
 * - ✅ 按功能模块分类组织
 * - ✅ 使用 UPPER_SNAKE_CASE 命名规范
 * - ✅ 避免魔法数字和硬编码字符串
 * - ✅ 提供类型安全的常量访问
 *
 * @fileoverview 配置模块常量定义文件
 * @since 1.0.0
 */

// ============================================================================
// 依赖注入令牌 (Dependency Injection Tokens)
// ============================================================================

/**
 * 依赖注入令牌常量
 *
 * @description 用于 NestJS 依赖注入系统的令牌集合
 * 使用 as const 确保类型安全和自动补全
 */
export const DI_TOKENS = {
  /**
   * 配置模块选项令牌
   *
   * @description 用于注入配置模块的选项
   *
   * @example
   * ```typescript
   * @Inject(DI_TOKENS.CONFIG_MODULE_OPTIONS)
   * private readonly options: TypedConfigModuleOptions
   * ```
   */
  CONFIG_MODULE_OPTIONS: "CONFIG_MODULE_OPTIONS",

  /**
   * 配置 Schema 令牌
   *
   * @description 用于注入配置 Schema 类
   *
   * @example
   * ```typescript
   * @Inject(DI_TOKENS.CONFIG_SCHEMA)
   * private readonly schema: Type<unknown>
   * ```
   */
  CONFIG_SCHEMA: "CONFIG_SCHEMA",

  /**
   * 缓存提供者令牌
   *
   * @description 用于注入缓存提供者实例
   *
   * @example
   * ```typescript
   * @Inject(DI_TOKENS.CACHE_PROVIDER)
   * private readonly cacheProvider: CacheProvider
   * ```
   */
  CACHE_PROVIDER: "CACHE_PROVIDER",

  /**
   * 日志记录器提供者令牌
   *
   * @description 用于注入日志记录器实例
   *
   * @example
   * ```typescript
   * @Inject(DI_TOKENS.LOGGER_PROVIDER)
   * private readonly logger: PinoLogger
   * ```
   */
  LOGGER_PROVIDER: "LOGGER_PROVIDER",
} as const;

// ============================================================================
// 缓存键前缀 (Cache Key Prefixes)
// ============================================================================

/**
 * 缓存键前缀常量
 *
 * @description 定义缓存键的标准前缀
 * 使用 as const 确保类型安全
 */
export const CACHE_KEYS = {
  /**
   * 配置缓存键前缀
   *
   * @description 用于配置数据的缓存键
   */
  CONFIG: "config",

  /**
   * 文件缓存键前缀
   *
   * @description 用于文件内容的缓存键
   */
  FILE: "file",

  /**
   * 远程配置缓存键前缀
   *
   * @description 用于远程配置的缓存键
   */
  REMOTE: "remote",

  /**
   * 环境变量缓存键前缀
   *
   * @description 用于环境变量的缓存键
   */
  ENV: "env",
} as const;

// ============================================================================
// 加载器类型 (Loader Types)
// ============================================================================

/**
 * 加载器类型常量
 *
 * @description 定义配置加载器的类型
 */
export const LOADER_TYPES = {
  /**
   * 文件加载器
   *
   * @description 从文件系统加载配置
   */
  FILE: "file",

  /**
   * Dotenv 加载器
   *
   * @description 从 .env 文件加载配置
   */
  DOTENV: "dotenv",

  /**
   * 远程加载器
   *
   * @description 从远程服务加载配置
   */
  REMOTE: "remote",

  /**
   * 目录加载器
   *
   * @description 从目录批量加载配置文件
   */
  DIRECTORY: "directory",

  /**
   * 数据库加载器
   *
   * @description 从数据库加载配置
   */
  DATABASE: "database",
} as const;

// ============================================================================
// 文件格式类型 (File Format Types)
// ============================================================================

/**
 * 文件格式类型常量
 *
 * @description 定义支持的配置文件格式
 */
export const FILE_FORMATS = {
  /**
   * JSON 格式
   */
  JSON: "json",

  /**
   * YAML 格式
   */
  YAML: "yaml",

  /**
   * YML 格式（YAML 的别名）
   */
  YML: "yml",

  /**
   * ENV 格式
   */
  ENV: "env",

  /**
   * TOML 格式
   */
  TOML: "toml",
} as const;

// ============================================================================
// 默认配置值 (Default Configuration Values)
// ============================================================================

/**
 * 配置模块默认值
 *
 * @description 定义配置模块的默认配置值
 * 避免在代码中出现魔法数字和硬编码字符串
 */
export const CONFIG_DEFAULTS = {
  /**
   * 默认缓存 TTL（秒）
   *
   * @description 配置缓存的默认过期时间
   */
  CACHE_TTL: 3600,

  /**
   * 默认缓存键前缀
   *
   * @description 缓存键的默认前缀
   */
  CACHE_PREFIX: "typed-config",

  /**
   * 默认环境变量分隔符
   *
   * @description 用于环境变量路径分隔的字符
   */
  ENV_SEPARATOR: "__",

  /**
   * 默认配置文件路径
   *
   * @description 配置文件的默认路径
   */
  DEFAULT_CONFIG_PATH: "./config",

  /**
   * 默认 .env 文件名
   *
   * @description 环境变量文件的默认名称
   */
  DEFAULT_ENV_FILE: ".env",

  /**
   * 默认重试次数
   *
   * @description 远程配置加载的默认重试次数
   */
  RETRY_ATTEMPTS: 3,

  /**
   * 默认重试延迟（毫秒）
   *
   * @description 重试之间的默认延迟时间
   */
  RETRY_DELAY: 1000,

  /**
   * 默认超时时间（毫秒）
   *
   * @description 请求的默认超时时间
   */
  TIMEOUT: 5000,

  /**
   * 是否启用验证
   *
   * @description 是否默认启用配置验证
   */
  ENABLE_VALIDATION: true,

  /**
   * 是否启用缓存
   *
   * @description 是否默认启用配置缓存
   */
  ENABLE_CACHE: true,

  /**
   * 是否启用环境变量替换
   *
   * @description 是否默认启用环境变量替换功能
   */
  ENABLE_ENV_SUBSTITUTION: true,
} as const;

// ============================================================================
// 缓存事件类型 (Cache Event Types)
// ============================================================================

/**
 * 缓存事件类型常量
 *
 * @description 定义缓存事件的类型
 */
export const CACHE_EVENTS = {
  /**
   * 缓存命中事件
   */
  HIT: "hit",

  /**
   * 缓存未命中事件
   */
  MISS: "miss",

  /**
   * 缓存设置事件
   */
  SET: "set",

  /**
   * 缓存删除事件
   */
  DELETE: "delete",

  /**
   * 缓存清空事件
   */
  CLEAR: "clear",

  /**
   * 缓存过期事件
   */
  EXPIRE: "expire",
} as const;

// ============================================================================
// 错误代码 (Error Codes)
// ============================================================================

/**
 * 错误代码常量
 *
 * @description 定义配置模块的错误代码
 */
export const ERROR_CODES = {
  /**
   * 配置验证失败
   */
  VALIDATION_ERROR: "CONFIG_VALIDATION_ERROR",

  /**
   * 配置加载失败
   */
  LOAD_ERROR: "CONFIG_LOAD_ERROR",

  /**
   * 文件不存在
   */
  FILE_NOT_FOUND: "CONFIG_FILE_NOT_FOUND",

  /**
   * 文件格式错误
   */
  INVALID_FORMAT: "CONFIG_INVALID_FORMAT",

  /**
   * 远程加载失败
   */
  REMOTE_LOAD_ERROR: "CONFIG_REMOTE_LOAD_ERROR",

  /**
   * 缓存错误
   */
  CACHE_ERROR: "CONFIG_CACHE_ERROR",

  /**
   * 环境变量替换错误
   */
  ENV_SUBSTITUTION_ERROR: "CONFIG_ENV_SUBSTITUTION_ERROR",
} as const;

// ============================================================================
// 类型导出 (Type Exports)
// ============================================================================

/**
 * 依赖注入令牌类型
 *
 * @description 从常量对象中提取值类型，确保类型安全
 */
export type DITokenType = (typeof DI_TOKENS)[keyof typeof DI_TOKENS];

/**
 * 缓存键类型
 *
 * @description 从常量对象中提取值类型，确保类型安全
 */
export type CacheKeyType = (typeof CACHE_KEYS)[keyof typeof CACHE_KEYS];

/**
 * 加载器类型
 *
 * @description 从常量对象中提取值类型，确保类型安全
 */
export type LoaderType = (typeof LOADER_TYPES)[keyof typeof LOADER_TYPES];

/**
 * 文件格式类型
 *
 * @description 从常量对象中提取值类型，确保类型安全
 */
export type FileFormatType = (typeof FILE_FORMATS)[keyof typeof FILE_FORMATS];

/**
 * 缓存事件类型
 *
 * @description 从常量对象中提取值类型，确保类型安全
 */
export type CacheEventType = (typeof CACHE_EVENTS)[keyof typeof CACHE_EVENTS];

/**
 * 错误代码类型
 *
 * @description 从常量对象中提取值类型，确保类型安全
 */
export type ErrorCodeType = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

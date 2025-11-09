/**
 * 加载器类型定义
 *
 * @description 各种配置加载器的类型定义
 * @author HL8 SAAS Platform Team
 * @since 1.0.0
 */

import {
  ConfigParser,
  ConfigRecord,
  KeyTransformer,
  ResponseMapper,
  RetryCondition,
} from "./config.types.js";

/**
 * 文件加载器选项类型
 *
 * @description 文件加载器的选项类型定义
 * @interface FileLoaderOptions
 * @since 1.0.0
 */
export interface FileLoaderOptions {
  /** 文件路径 */
  path?: string;
  /** 搜索起始目录 */
  searchFrom?: string;
  /** 文件名基础名 */
  basename?: string;
  /** 是否忽略环境变量替换 */
  ignoreEnvironmentVariableSubstitution?: boolean;
}

/**
 * 环境变量加载器选项类型
 *
 * @description 环境变量加载器的选项类型定义
 * @interface DotenvLoaderOptions
 * @since 1.0.0
 */
export interface DotenvLoaderOptions {
  /** 环境变量文件路径 */
  envFilePath?: string | string[];
  /** 是否忽略环境变量文件 */
  ignoreEnvFile?: boolean;
  /** 是否忽略环境变量 */
  ignoreEnvVars?: boolean;
  /** 分隔符 */
  separator?: string;
  /** 键转换器 */
  keyTransformer?: KeyTransformer;
  /** 是否展开变量 */
  enableExpandVariables?: boolean;
}

/**
 * 远程加载器选项类型
 *
 * @description 远程加载器的选项类型定义
 * @interface RemoteLoaderOptions
 * @since 1.0.0
 */
export interface RemoteLoaderOptions {
  /** 请求配置 */
  requestConfig?: {
    method?: string;
    headers?: Record<string, string>;
    timeout?: number;
  };
  /** 响应类型 */
  type?: "json" | "yaml" | "yml" | ResponseMapper;
  /** 响应映射器 */
  mapResponse?: ResponseMapper;
  /** 重试条件 */
  shouldRetry?: RetryCondition;
  /** 重试次数 */
  retries?: number;
  /** 重试间隔 */
  retryInterval?: number;
}

/**
 * 目录加载器选项类型
 *
 * @description 目录加载器的选项类型定义
 * @interface DirectoryLoaderOptions
 * @since 1.0.0
 */
export interface DirectoryLoaderOptions {
  /** 目录路径 */
  directory: string;
  /** 文件匹配模式 */
  include?: RegExp;
  /** 是否忽略环境变量替换 */
  ignoreEnvironmentVariableSubstitution?: boolean;
  /** 是否不允许未定义的环境变量 */
  disallowUndefinedEnvironmentVariables?: boolean;
}

/**
 * 配置解析器类型
 *
 * @description 配置解析器的类型定义
 * @interface ConfigParserType
 * @since 1.0.0
 */
export interface ConfigParserType {
  /** JSON 解析器 */
  json: ConfigParser;
  /** YAML 解析器 */
  yaml: ConfigParser;
  /** YML 解析器 */
  yml: ConfigParser;
}

/**
 * 文件扩展名类型
 *
 * @description 支持的文件扩展名类型
 * @type SupportedFileExtension
 * @since 1.0.0
 */
export type SupportedFileExtension = ".json" | ".yml" | ".yaml";

/**
 * 文件信息类型
 *
 * @description 文件信息的类型定义
 * @interface FileInfo
 * @since 1.0.0
 */
export interface FileInfo {
  /** 文件路径 */
  path: string;
  /** 文件扩展名 */
  extension: SupportedFileExtension;
  /** 文件内容 */
  content: string;
  /** 文件大小 */
  size: number;
  /** 修改时间 */
  mtime: Date;
}

/**
 * 目录信息类型
 *
 * @description 目录信息的类型定义
 * @interface DirectoryInfo
 * @since 1.0.0
 */
export interface DirectoryInfo {
  /** 目录路径 */
  path: string;
  /** 文件列表 */
  files: FileInfo[];
  /** 是否递归搜索 */
  recursive?: boolean;
}

/**
 * 网络请求结果类型
 *
 * @description 网络请求结果的类型定义
 * @interface NetworkRequestResult
 * @since 1.0.0
 */
export interface NetworkRequestResult {
  /** 响应状态 */
  status: number;
  /** 响应数据 */
  data: ConfigRecord;
  /** 响应头 */
  headers: Record<string, string>;
  /** 请求URL */
  url: string;
  /** 请求方法 */
  method: string;
}

/**
 * 重试信息类型
 *
 * @description 重试信息的类型定义
 * @interface RetryInfo
 * @since 1.0.0
 */
export interface RetryInfo {
  /** 当前尝试次数 */
  attempt: number;
  /** 最大重试次数 */
  maxRetries: number;
  /** 重试间隔 */
  interval: number;
  /** 上次错误 */
  lastError?: Error;
}

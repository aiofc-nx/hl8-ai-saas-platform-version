/**
 * 文件加载器
 *
 * 从文件系统加载配置文件的加载器，支持多种文件格式和环境变量替换。
 * 提供完整的文件配置加载功能，包括文件查找、格式解析、变量扩展等。
 *
 * @description 此加载器是配置模块的核心加载器之一，支持从本地文件系统加载配置。
 * 支持 JSON、YAML、YML 格式的配置文件，并提供环境变量替换功能。
 * 遵循文件系统最佳实践，提供完整的错误处理和文件查找机制。
 *
 * ## 业务规则
 *
 * ### 文件格式支持规则
 * - 支持 JSON 格式配置文件（.json）
 * - 支持 YAML 格式配置文件（.yml, .yaml）
 * - 文件格式不区分大小写
 * - 不支持的文件格式会抛出 FileFormatError 异常
 *
 * ### 文件查找规则
 * - 优先使用指定的文件路径
 * - 未指定路径时在搜索目录中查找配置文件
 * - 支持多种文件名扩展名的自动查找
 * - 文件不存在时抛出 FileNotFoundError 异常
 *
 * ### 环境变量替换规则
 * - 支持 ${VAR} 语法的环境变量替换
 * - 支持 ${VAR:-DEFAULT} 默认值语法
 * - 支持嵌套对象和数组中的变量替换
 * - 可以禁用环境变量替换功能
 *
 * ### 错误处理规则
 * - 文件不存在时抛出 FileNotFoundError 异常
 * - 文件格式不支持时抛出 FileFormatError 异常
 * - 文件解析失败时抛出 ParseError 异常
 * - 变量替换失败时抛出 VariableExpansionError 异常
 *
 * ## 业务逻辑流程
 *
 * 1. **文件路径确定**：使用指定路径或自动查找配置文件
 * 2. **文件存在性检查**：验证配置文件是否存在
 * 3. **文件格式识别**：根据文件扩展名确定解析方式
 * 4. **文件内容读取**：读取文件内容并进行格式解析
 * 5. **环境变量替换**：替换配置中的环境变量引用
 * 6. **配置返回**：返回处理后的配置对象
 *
 * @example
 * ```typescript
 * // 基础用法
 * const loader = fileLoader({ path: './config/app.yml' });
 *
 * // 自动查找配置文件
 * const loader = fileLoader({ basename: 'config' });
 *
 * // 禁用环境变量替换
 * const loader = fileLoader({
 *   path: './config/app.json',
 *   ignoreEnvironmentVariableSubstitution: true
 * });
 *
 * // 自定义搜索目录
 * const loader = fileLoader({
 *   searchFrom: '/custom/path',
 *   basename: 'app'
 * });
 * ```
 */

import * as fs from "fs";
import * as yaml from "js-yaml";
import * as path from "path";
import { ConfigError, ErrorHandler } from "../errors/index.js";
import { ConfigLoader } from "../interfaces/typed-config-module-options.interface.js";
import { ConfigRecord } from "../types/index.js";

/**
 * 文件加载器选项接口
 *
 * 定义文件加载器的配置选项，包括文件路径、搜索目录、文件名等。
 * 提供灵活的文件配置加载选项，支持多种文件查找和加载方式。
 *
 * @description 此接口定义了文件加载器的所有可用选项。
 * 支持指定文件路径、自动文件查找、环境变量替换等功能。
 * 遵循配置选项设计原则，提供合理的默认值和灵活的定制选项。
 *
 * ## 业务规则
 *
 * ### 文件路径规则
 * - path：优先使用指定的文件路径
 * - searchFrom：指定文件搜索的起始目录
 * - basename：指定配置文件的基名（不含扩展名）
 *
 * ### 环境变量规则
 * - ignoreEnvironmentVariableSubstitution：控制是否进行环境变量替换
 * - 默认启用环境变量替换功能
 * - 支持 ${VAR} 和 ${VAR:-DEFAULT} 语法
 *
 * @example
 * ```typescript
 * // 基础选项
 * const options: FileLoaderOptions = {
 *   path: './config/app.yml'
 * };
 *
 * // 完整选项
 * const options: FileLoaderOptions = {
 *   path: './config/app.yml',
 *   searchFrom: process.cwd(),
 *   basename: 'config',
 *   ignoreEnvironmentVariableSubstitution: false
 * };
 * ```
 */
import { FileLoaderOptions } from "../types/loader.types.js";

/**
 * 文件加载器
 *
 * 创建从文件系统加载配置文件的配置加载器函数。
 * 支持多种文件格式、环境变量替换和灵活的文件查找机制。
 *
 * @description 此函数返回一个配置加载器函数，用于从文件系统加载配置。
 * 支持 JSON、YAML 格式的配置文件，并提供环境变量替换功能。
 * 提供完整的错误处理和文件查找机制。
 *
 * ## 业务规则
 *
 * ### 文件加载规则
 * - 优先使用指定的文件路径（path 选项）
 * - 未指定路径时在搜索目录中查找配置文件
 * - 支持多种文件扩展名的自动查找
 * - 文件不存在时抛出 FileNotFoundError 异常
 *
 * ### 格式解析规则
 * - 支持 JSON 格式配置文件（.json）
 * - 支持 YAML 格式配置文件（.yml, .yaml）
 * - 文件格式不区分大小写
 * - 不支持的文件格式会抛出 FileFormatError 异常
 *
 * ### 环境变量替换规则
 * - 默认启用环境变量替换功能
 * - 支持 ${VAR} 语法的环境变量替换
 * - 支持 ${VAR:-DEFAULT} 默认值语法
 * - 可以禁用环境变量替换功能
 *
 * ### 错误处理规则
 * - 文件不存在时抛出 FileNotFoundError 异常
 * - 文件格式不支持时抛出 FileFormatError 异常
 * - 文件解析失败时抛出 ParseError 异常
 * - 变量替换失败时抛出 VariableExpansionError 异常
 *
 * ## 业务逻辑流程
 *
 * 1. **选项处理**：处理文件加载器选项，设置默认值
 * 2. **文件路径确定**：使用指定路径或自动查找配置文件
 * 3. **文件存在性检查**：验证配置文件是否存在
 * 4. **文件格式识别**：根据文件扩展名确定解析方式
 * 5. **文件内容读取**：读取文件内容并进行格式解析
 * 6. **环境变量替换**：替换配置中的环境变量引用
 * 7. **配置返回**：返回处理后的配置对象
 *
 * @param options - 文件加载器选项，控制文件查找和加载行为
 * @returns 配置加载器函数，返回加载的配置对象
 *
 * @throws {FileNotFoundError} 当指定的配置文件不存在时抛出
 * @throws {FileFormatError} 当文件格式不支持时抛出
 * @throws {ParseError} 当文件解析失败时抛出
 * @throws {VariableExpansionError} 当环境变量替换失败时抛出
 *
 * @example
 * ```typescript
 * // 基础用法
 * const loader = fileLoader({ path: './config/app.yml' });
 * const config = loader();
 *
 * // 自动查找配置文件
 * const loader = fileLoader({ basename: 'config' });
 * const config = loader();
 *
 * // 禁用环境变量替换
 * const loader = fileLoader({
 *   path: './config/app.json',
 *   ignoreEnvironmentVariableSubstitution: true
 * });
 *
 * // 自定义搜索目录
 * const loader = fileLoader({
 *   searchFrom: '/custom/path',
 *   basename: 'app'
 * });
 * ```
 */
export const fileLoader = (options: FileLoaderOptions = {}): ConfigLoader => {
  const {
    path: filePath,
    searchFrom = process.cwd(),
    basename = "config",
    ignoreEnvironmentVariableSubstitution = false,
  } = options;

  return (): ConfigRecord => {
    try {
      const configPath = filePath || findConfigFile(searchFrom, basename);

      if (!configPath) {
        throw ErrorHandler.handleFileNotFoundError(basename, {
          searchFrom,
          filePath,
          basename,
        });
      }

      const content = fs.readFileSync(configPath, "utf8");
      const ext = path.extname(configPath).toLowerCase();

      let config: ConfigRecord;

      try {
        switch (ext) {
          case ".json":
            config = JSON.parse(content) as ConfigRecord;
            break;
          case ".yml":
          case ".yaml":
            config = yaml.load(content) as ConfigRecord;
            break;
          default:
            throw ErrorHandler.handleFileFormatError(
              new Error(`Unsupported file format: ${ext}`),
              configPath,
              "json, yml, yaml",
              { ext, configPath },
            );
        }
      } catch (error) {
        if (error instanceof ConfigError) {
          throw error;
        }
        throw ErrorHandler.handleParseError(error as Error, content, {
          configPath,
          ext,
        });
      }

      if (!ignoreEnvironmentVariableSubstitution) {
        try {
          config = substituteEnvironmentVariables(config);
        } catch (error) {
          throw ErrorHandler.handleVariableExpansionError(
            error as Error,
            "substituteEnvironmentVariables",
            { configPath, ignoreEnvironmentVariableSubstitution },
          );
        }
      }

      return config;
    } catch (error) {
      if (error instanceof ConfigError) {
        throw error;
      }
      throw ErrorHandler.handleUnknownError(error as Error, {
        searchFrom,
        basename,
        filePath,
      });
    }
  };
};

/**
 * 查找配置文件
 *
 * @description 在指定目录中查找配置文件
 * @param searchFrom 搜索目录
 * @param basename 文件名
 * @returns 配置文件路径或 null
 * @author HL8 SAAS Platform Team
 * @since 1.0.0
 */
function findConfigFile(searchFrom: string, basename: string): string | null {
  const extensions = [".json", ".yml", ".yaml"];

  for (const ext of extensions) {
    const filePath = path.join(searchFrom, `${basename}${ext}`);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }

  return null;
}

/**
 * 替换环境变量
 *
 * @description 在配置对象中替换环境变量
 * @param config 配置对象
 * @returns 替换后的配置对象
 * @author HL8 SAAS Platform Team
 * @since 1.0.0
 */
function substituteEnvironmentVariables(config: ConfigRecord): ConfigRecord {
  if (typeof config === "string") {
    return (config as string).replace(
      /\$\{([^}]+)\}/g,
      (match: string, key: string): string => {
        // 支持 ${VAR:-DEFAULT} 语法
        const defaultMatch = key.match(/^([^:]+):-(.*)$/);
        if (defaultMatch) {
          const [, envKey, defaultValue] = defaultMatch;
          return process.env[envKey ?? ""] !== undefined
            ? (process.env[envKey ?? ""] as string)
            : (defaultValue ?? match);
        }

        // 支持 ${VAR} 语法
        const value = process.env[key];
        return value !== undefined ? value : match;
      },
    ) as unknown as ConfigRecord;
  }

  if (Array.isArray(config)) {
    return config.map(
      substituteEnvironmentVariables,
    ) as unknown as ConfigRecord;
  }

  if (config && typeof config === "object") {
    const result: ConfigRecord = {};
    for (const [key, value] of Object.entries(config)) {
      result[key] = substituteEnvironmentVariables(value as ConfigRecord);
    }
    return result;
  }

  return config;
}

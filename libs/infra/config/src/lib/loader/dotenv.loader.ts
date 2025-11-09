/**
 * 环境变量加载器
 *
 * @description 从环境变量加载配置的加载器
 * @since 1.0.0
 */

import * as dotenv from "dotenv";
import * as dotenvExpand from "dotenv-expand";
import * as fs from "fs";
import * as path from "path";
import { CONFIG_DEFAULTS } from "../constants.js";
import { ConfigError, ErrorHandler } from "../errors/index.js";
import { ConfigLoader } from "../interfaces/typed-config-module-options.interface.js";
import { ConfigRecord, KeyTransformer } from "../types/index.js";

/**
 * 环境变量加载器选项接口
 *
 * @description 定义环境变量加载器的选项
 * @interface DotenvLoaderOptions
 * @since 1.0.0
 */
import { DotenvLoaderOptions } from "../types/loader.types.js";

/**
 * 环境变量加载器
 *
 * @description 从环境变量加载配置的加载器
 * @param options 环境变量加载器选项
 * @returns 配置加载器函数
 * @example
 * ```typescript
 * const loader = dotenvLoader({
 *   envFilePath: '.env',
 *   separator: '__',
 *   keyTransformer: (key) => key.toLowerCase()
 * });
 * ```
 * @since 1.0.0
 */
export const dotenvLoader = (
  options: DotenvLoaderOptions = {},
): ConfigLoader => {
  const {
    envFilePath = CONFIG_DEFAULTS.DEFAULT_ENV_FILE,
    ignoreEnvFile = false,
    ignoreEnvVars = false,
    separator = CONFIG_DEFAULTS.ENV_SEPARATOR,
    keyTransformer,
    enableExpandVariables = true,
  } = options;

  return (_previousConfig: ConfigRecord = {}): ConfigRecord => {
    let config: ConfigRecord = {};

    // 智能加载策略：
    // 1. 首先尝试加载配置文件（JSON/YAML）和远程配置源
    // 2. 只有在无法获得其他配置源时，才加载 .env 文件作为 fallback
    // 3. .env 文件不存在时静默忽略，不会报错（因为进程环境变量仍然可用）
    // 注意：.env 文件可以作为可选的覆盖源，用于覆盖配置文件中的值
    if (!ignoreEnvFile && envFilePath) {
      try {
        // 处理多个文件路径的情况
        const filePaths = Array.isArray(envFilePath)
          ? envFilePath
          : [envFilePath];

        for (const filePath of filePaths) {
          // 检查文件是否存在，如果不存在则跳过（.env 文件是可选的）
          const resolvedPath = path.isAbsolute(filePath)
            ? filePath
            : path.resolve(process.cwd(), filePath);

          if (!fs.existsSync(resolvedPath)) {
            // 文件不存在是正常的，静默跳过
            // 配置可以从其他来源（如配置文件、环境变量）加载
            continue;
          }

          // 文件存在，尝试加载
          const result = dotenv.config({
            path: resolvedPath,
          });

          // 如果 result.error 存在，检查是否是文件不存在错误
          if (result.error) {
            const error = result.error as NodeJS.ErrnoException;
            const isFileNotFound = error.code === "ENOENT";
            if (isFileNotFound) {
              // 文件不存在是正常的，静默忽略
              continue;
            } else {
              // 其他错误（如权限错误、格式错误）应该抛出
              throw ErrorHandler.handleFileLoadError(result.error, filePath, {
                ignoreEnvFile,
                ignoreEnvVars,
              });
            }
          } else if (result.parsed) {
            // 只有成功解析时才合并配置
            config = { ...config, ...result.parsed };
          }
        }
      } catch (error) {
        if (error instanceof ConfigError) {
          throw error;
        }

        // 检查是否是文件不存在错误
        const err = error as NodeJS.ErrnoException;
        const isFileNotFound = err.code === "ENOENT";

        if (isFileNotFound) {
          // 文件不存在是正常的，静默忽略
          // 配置可以从其他来源（如配置文件、环境变量）加载
        } else {
          // 其他错误应该抛出
          throw ErrorHandler.handleFileLoadError(
            error as Error,
            Array.isArray(envFilePath) ? envFilePath.join(", ") : envFilePath,
            { ignoreEnvFile, ignoreEnvVars },
          );
        }
      }
    }

    // 加载环境变量
    if (!ignoreEnvVars) {
      config = { ...config, ...process.env };
    }

    // 展开变量
    if (enableExpandVariables) {
      try {
        config = expandVariables(config);
      } catch (error) {
        throw ErrorHandler.handleVariableExpansionError(
          error as Error,
          "expandVariables",
          { enableExpandVariables, configKeys: Object.keys(config) },
        );
      }
    }

    // 应用键转换器
    if (keyTransformer) {
      config = transformKeys(config, keyTransformer);
    }

    // 应用分隔符解析
    if (separator) {
      config = parseWithSeparator(config, separator);
    }

    return config;
  };
};

/**
 * 展开变量
 *
 * @description 展开配置中的变量引用
 * @param config 配置对象
 * @returns 展开后的配置对象
 * @since 1.0.0
 */
function expandVariables(config: ConfigRecord): ConfigRecord {
  const expanded = dotenvExpand.expand({
    parsed: config as Record<string, string>,
  });
  return (expanded.parsed || config) as ConfigRecord;
}

/**
 * 转换键
 *
 * @description 转换配置对象的键
 * @param config 配置对象
 * @param transformer 键转换器
 * @returns 转换后的配置对象
 * @since 1.0.0
 */
function transformKeys(
  config: ConfigRecord,
  transformer: KeyTransformer,
): ConfigRecord {
  const result: ConfigRecord = {};
  for (const [key, value] of Object.entries(config)) {
    const transformedKey = transformer(key);
    result[transformedKey] = value as ConfigRecord;
  }
  return result;
}

/**
 * 使用分隔符解析
 *
 * @description 使用分隔符将扁平化的键解析为嵌套对象
 * @param config 配置对象
 * @param separator 分隔符
 * @returns 解析后的配置对象
 * @since 1.0.0
 */
function parseWithSeparator(
  config: ConfigRecord,
  separator: string,
): ConfigRecord {
  const result: ConfigRecord = {};

  for (const [key, value] of Object.entries(config)) {
    const keys = key.split(separator);
    let current = result;

    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!k || !(k in current)) {
        if (k) current[k] = {};
      }
      if (k) current = current[k] as ConfigRecord;
    }

    const lastKey = keys[keys.length - 1];
    if (lastKey) current[lastKey] = value as ConfigRecord;
  }

  return result;
}

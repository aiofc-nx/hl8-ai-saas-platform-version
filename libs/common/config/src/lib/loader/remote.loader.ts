/**
 * 远程加载器
 *
 * @description 从远程端点加载配置的加载器
 * @since 1.0.0
 */

import { CONFIG_DEFAULTS } from "../constants.js";
import { ErrorHandler } from "../errors/index.js";
import { AsyncConfigLoader } from "../interfaces/typed-config-module-options.interface.js";

/**
 * 远程加载器选项接口
 *
 * @description 定义远程加载器的选项
 * @interface RemoteLoaderOptions
 * @since 1.0.0
 */
export interface RemoteLoaderOptions {
  /**
   * HTTP 请求配置
   * @description Axios 请求配置
   */
  requestConfig?: {
    method?: "GET" | "POST" | "PUT" | "DELETE";
    headers?: Record<string, string>;
    timeout?: number;
    auth?: {
      username: string;
      password: string;
    };
  };

  /**
   * 配置类型
   * @description 配置文件的类型
   *
   * @remarks
   * 使用 any 符合宪章 IX 允许场景：HTTP 响应类型未知。
   */

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type?: "json" | "yaml" | "yml" | ((response: any) => string);

  /**
   * 响应映射函数
   * @description 将 HTTP 响应体映射为配置对象的函数
   * @param response HTTP 响应
   * @returns 配置对象
   *
   * @remarks
   * 使用 any 符合宪章 IX 允许场景：HTTP 响应和配置对象结构未知。
   */

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mapResponse?: (response: any) => any;

  /**
   * 重试函数
   * @description 确定是否应该重试请求的函数
   * @param response HTTP 响应
   * @returns 是否应该重试
   *
   * @remarks
   * 使用 any 符合宪章 IX 允许场景：HTTP 响应类型未知。
   */

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  shouldRetry?: (response: any) => boolean;

  /**
   * 重试次数
   * @description 重试次数，默认为 3
   * @default 3
   */
  retries?: number;

  /**
   * 重试间隔
   * @description 重试间隔（毫秒），默认为 1000
   * @default 1000
   */
  retryInterval?: number;
}

/**
 * 远程加载器
 *
 * @description 从远程端点加载配置的加载器
 * @param url 远程端点 URL
 * @param options 远程加载器选项
 * @returns 异步配置加载器函数
 * @example
 * ```typescript
 * const loader = remoteLoader('http://config-server/api/config', {
 *   type: 'json',
 *   retries: 3,
 *   retryInterval: 1000
 * });
 * ```
 * @since 1.0.0
 */
export const remoteLoader = (
  url: string,
  options: RemoteLoaderOptions = {},
): AsyncConfigLoader => {
  const {
    requestConfig = {},
    type = "json",
    mapResponse = (response) => response.data,
    shouldRetry = (response) => response.status !== 200,
    retries = CONFIG_DEFAULTS.RETRY_ATTEMPTS,
    retryInterval = CONFIG_DEFAULTS.RETRY_DELAY,
  } = options;

  return async (): Promise<Record<string, unknown>> => {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await makeRequest(url, requestConfig);

        if (shouldRetry(response)) {
          throw new Error(`Request failed with status: ${response.status}`);
        }

        const data = mapResponse(response);
        return parseConfig(data, type);
      } catch (error) {
        lastError = error as Error;

        if (attempt < retries) {
          await delay(retryInterval);
        }
      }
    }

    throw ErrorHandler.handleNetworkError(
      lastError || new Error("Unknown network error"),
      url,
      { retries, retryInterval, attempt: retries + 1 },
    );
  };
};

/**
 * 发送 HTTP 请求
 *
 * @description 发送 HTTP 请求
 * @param url 请求 URL
 * @param config 请求配置
 * @returns HTTP 响应
 * @since 1.0.0
 */
async function makeRequest(
  url: string,
  config: Record<string, unknown>,
): Promise<{ data: unknown; status: number }> {
  // 这里应该使用实际的 HTTP 客户端，如 axios 或 fetch
  // 为了简化，这里使用 fetch API
  const response = await fetch(url, {
    method: (config["method"] as string) || "GET",
    headers: {
      "Content-Type": "application/json",
      ...((config["headers"] as Record<string, string>) || {}),
    },
    // 移除 timeout 属性，因为 fetch 不支持
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return {
    status: response.status,
    data: await response.json(),
  };
}

/**
 * 解析配置
 *
 * @description 根据类型解析配置数据
 * @param data 配置数据
 * @param type 配置类型
 * @returns 解析后的配置对象
 * @author HL8 SAAS Platform Team
 * @since 1.0.0
 *
 * @remarks
 * 使用 any 符合宪章 IX 允许场景：HTTP 响应数据类型未知，可能是 string 或已解析的对象。
 */

function parseConfig(
  data: unknown,
  type: string | ((response: unknown) => string),
): Record<string, unknown> {
  const configType = typeof type === "function" ? type(data) : type;

  switch (configType) {
    case "json":
      return typeof data === "string"
        ? JSON.parse(data)
        : (data as Record<string, unknown>);
    case "yaml":
    case "yml":
      // 这里需要 yaml 解析器
      return data as Record<string, unknown>;
    default:
      return data as Record<string, unknown>;
  }
}

/**
 * 延迟函数
 *
 * @description 延迟指定时间
 * @param ms 延迟时间（毫秒）
 * @returns Promise<void>
 * @since 1.0.0
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

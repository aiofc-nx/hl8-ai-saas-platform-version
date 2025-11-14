/**
 * @fileoverview 配置服务实现
 * @description 实现配置服务，支持配置值的获取和检查
 *
 * ## 业务规则
 *
 * ### 配置获取规则
 * - 支持获取配置值，支持类型安全
 * - 支持检查配置是否存在
 * - 支持默认值设置
 * - 配置不存在时抛出明确的错误信息
 *
 * ### 配置类型安全规则
 * - 配置值支持类型推断
 * - 配置值支持类型转换
 * - 配置值支持类型验证
 * - 配置值支持默认值类型匹配
 */

import { Inject, Injectable, Optional } from "@nestjs/common";
import { Logger } from "@hl8/logger";
import { ConfigurationException } from "../exceptions/infrastructure-exception.js";
import { InfrastructureConfig } from "./schemas/infrastructure-config.schema.js";
import type { ConfigurationService } from "./configuration.interface.js";

type LoggerService = InstanceType<typeof Logger>;

/**
 * @description 配置服务实现
 * @remarks 实现配置服务，支持配置值的获取和检查
 *
 * @example
 * ```typescript
 * // 注入配置服务
 * constructor(private readonly configService: ConfigurationServiceImpl) {}
 *
 * // 获取配置值
 * const value = configService.get<string>('eventStore.connectionString');
 *
 * // 获取配置值（带默认值）
 * const retryCount = configService.get<number>('eventStore.optimisticLockRetryCount', 3);
 *
 * // 检查配置是否存在
 * if (configService.has('eventStore.connectionString')) {
 *   const connectionString = configService.get<string>('eventStore.connectionString');
 * }
 * ```
 */
@Injectable()
export class ConfigurationServiceImpl implements ConfigurationService {
  /**
   * @description 构造函数
   * @param config - 基础设施配置
   * @param logger - 日志服务（可选）
   */
  constructor(
    @Inject(InfrastructureConfig)
    private readonly config: InfrastructureConfig,
    @Optional() @Inject(Logger) private readonly logger?: LoggerService,
  ) {}

  /**
   * @description 获取配置值
   * @remarks 根据配置键获取配置值，支持类型安全
   *
   * @param key - 配置键，支持点号分隔的嵌套路径
   * @param defaultValue - 默认值，如果配置不存在则返回默认值
   * @returns 配置值
   * @throws {ConfigurationException} 当配置不存在且没有默认值时
   */
  get<T>(key: string, defaultValue?: T): T {
    try {
      // 获取配置值
      const value = this.getNestedValue(this.config, key);

      // 如果配置值存在，返回配置值
      if (value !== undefined) {
        return value as T;
      }

      // 如果配置值不存在但有默认值，返回默认值
      if (defaultValue !== undefined) {
        return defaultValue;
      }

      // 如果配置值不存在且没有默认值，抛出异常
      throw new ConfigurationException(
        `配置项 "${key}" 不存在且没有默认值`,
        "CONFIGURATION_KEY_NOT_FOUND",
        {
          key,
        },
      );
    } catch (error) {
      // 如果是配置异常，直接抛出
      if (error instanceof ConfigurationException) {
        throw error;
      }

      // 记录错误日志
      this.logger?.error(error as Error, {
        key,
      });

      // 抛出异常
      throw new ConfigurationException(
        `配置值获取失败: ${(error as Error).message}`,
        "CONFIGURATION_GET_ERROR",
        {
          key,
        },
        error,
      );
    }
  }

  /**
   * @description 检查配置是否存在
   * @remarks 根据配置键检查配置是否存在
   *
   * @param key - 配置键，支持点号分隔的嵌套路径
   * @returns 是否存在
   */
  has(key: string): boolean {
    try {
      // 获取配置值
      const value = this.getNestedValue(this.config, key);

      // 返回配置值是否存在
      return value !== undefined;
    } catch {
      // 如果获取配置值失败，返回 false
      return false;
    }
  }

  /**
   * @description 获取嵌套配置值
   * @remarks 根据点号分隔的路径获取嵌套配置值
   *
   * @param obj - 配置对象
   * @param path - 配置路径，支持点号分隔
   * @returns 配置值
   */
  private getNestedValue(obj: unknown, path: string): unknown {
    if (!obj || typeof obj !== "object") {
      return undefined;
    }

    // 分割路径
    const keys = path.split(".");

    // 递归获取嵌套值
    let current: unknown = obj;

    for (const key of keys) {
      if (
        current === null ||
        current === undefined ||
        typeof current !== "object"
      ) {
        return undefined;
      }

      current = (current as Record<string, unknown>)[key];

      if (current === undefined) {
        return undefined;
      }
    }

    return current;
  }
}

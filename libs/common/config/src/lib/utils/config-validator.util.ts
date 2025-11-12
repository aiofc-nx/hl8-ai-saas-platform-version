/**
 * 配置验证器工具类
 *
 * 提供配置对象的验证功能，使用 class-validator 和 class-transformer
 * 进行类型验证和转换。
 *
 * @description 这是一个轻量级的配置验证工具类，用于在运行时验证配置对象
 * 并转换为指定的类型。主要用于模块配置验证场景。
 *
 * ## 业务规则
 *
 * ### 验证规则
 * - 使用 class-validator 进行验证
 * - 自动进行类型转换
 * - 验证失败抛出详细错误
 *
 * @example
 * ```typescript
 * import { ConfigValidator } from '@hl8/config';
 * import { IsString, IsNumber } from 'class-validator';
 * import { Type } from 'class-transformer';
 *
 * class MyConfig {
 *   @IsString()
 *   name: string;
 *
 *   @IsNumber()
 *   @Type(() => Number)
 *   port: number;
 * }
 *
 * const config = ConfigValidator.validate(MyConfig, { name: 'app', port: '3000' });
 * console.log(config instanceof MyConfig); // true
 * console.log(typeof config.port); // 'number'
 * ```
 *
 * @since 1.0.0
 */

import { plainToClass } from "class-transformer";
import { validateSync, ValidationError } from "class-validator";

/**
 * 配置验证器类
 *
 * @description 提供静态方法进行配置验证和转换
 */
export class ConfigValidator {
  /**
   * 验证并转换配置对象
   *
   * @description 将普通对象转换为指定的配置类实例并进行验证
   *
   * ## 业务规则
   * - 自动执行类型转换
   * - 验证所有装饰器约束
   * - 验证失败时抛出错误并包含详细信息
   *
   * @template T - 配置类类型
   * @param {new () => T} schema - 配置类构造函数
   * @param {Record<string, any>} config - 待验证的配置对象
   * @returns {T} 验证并转换后的配置实例
   * @throws {Error} 验证失败时抛出包含详细信息的错误
   *
   * @example
   * ```typescript
   * const config = ConfigValidator.validate(AppConfig, rawConfig);
   * ```
   */
  static validate<T extends object>(
    schema: new () => T,
    config: Record<string, unknown>,
  ): T {
    // 转换为类实例
    const configInstance = plainToClass(schema, config, {
      enableImplicitConversion: true,
      exposeDefaultValues: true,
    });

    // 验证配置
    const errors = validateSync(configInstance as object, {
      skipMissingProperties: false,
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    if (errors.length > 0) {
      const message = ConfigValidator.formatErrors(errors);
      throw new Error(`Configuration validation failed:\n${message}`);
    }

    return configInstance;
  }

  /**
   * 格式化验证错误信息
   *
   * @param {ValidationError[]} errors - 验证错误数组
   * @returns {string} 格式化后的错误信息
   */
  private static formatErrors(errors: ValidationError[]): string {
    return errors
      .map((error) => {
        const constraints = error.constraints
          ? Object.values(error.constraints).join(", ")
          : "";
        return `  - ${error.property}: ${constraints}`;
      })
      .join("\n");
  }
}

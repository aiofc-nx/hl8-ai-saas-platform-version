/**
 * @fileoverview 配置服务接口
 * @description 定义配置服务的接口规范，支持配置值的获取和检查
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

/**
 * @description 配置服务接口
 * @remarks 定义配置服务的核心操作，包括配置值的获取和检查
 *
 * @example
 * ```typescript
 * // 注入配置服务
 * constructor(private readonly configService: ConfigurationService) {}
 *
 * // 获取配置值
 * const value = configService.get<string>('database.host');
 *
 * // 获取配置值（带默认值）
 * const port = configService.get<number>('database.port', 5432);
 *
 * // 检查配置是否存在
 * if (configService.has('database.host')) {
 *   const host = configService.get<string>('database.host');
 * }
 * ```
 */
export interface ConfigurationService {
  /**
   * @description 获取配置值
   * @remarks 根据配置键获取配置值，支持类型安全
   *
   * ## 业务规则
   * - 支持类型推断和类型转换
   * - 支持默认值设置
   * - 配置不存在时抛出明确的错误信息
   *
   * @param key - 配置键，支持点号分隔的嵌套路径
   * @param defaultValue - 默认值，如果配置不存在则返回默认值
   * @returns 配置值
   * @throws {ConfigurationException} 当配置不存在且没有默认值时
   *
   * @example
   * ```typescript
   * // 获取配置值
   * const host = configService.get<string>('database.host');
   *
   * // 获取配置值（带默认值）
   * const port = configService.get<number>('database.port', 5432);
   * ```
   */
  get<T>(key: string, defaultValue?: T): T;

  /**
   * @description 检查配置是否存在
   * @remarks 根据配置键检查配置是否存在
   *
   * ## 业务规则
   * - 支持点号分隔的嵌套路径
   * - 支持嵌套配置对象的检查
   * - 配置不存在时返回 false
   *
   * @param key - 配置键，支持点号分隔的嵌套路径
   * @returns 是否存在
   *
   * @example
   * ```typescript
   * if (configService.has('database.host')) {
   *   const host = configService.get<string>('database.host');
   * }
   * ```
   */
  has(key: string): boolean;
}

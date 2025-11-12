/**
 * 类型定义模块
 *
 * 配置模块的所有类型定义和接口声明，提供完整的 TypeScript 类型支持。
 * 包括配置记录、加载器、缓存等核心类型的定义。
 *
 * @description 此模块定义了配置系统的所有核心类型和接口。
 * 提供类型安全的配置管理，支持编译时类型检查和运行时类型验证。
 * 遵循 TypeScript 类型设计原则，提供清晰的类型定义和接口声明。
 *
 * ## 业务规则
 *
 * ### 类型安全规则
 * - 所有配置类型都必须是强类型的
 * - 支持嵌套配置对象的类型推断
 * - 配置加载器必须返回正确的配置类型
 * - 类型定义必须与运行时行为一致
 *
 * ### 接口设计规则
 * - 接口设计遵循单一职责原则
 * - 提供清晰的类型边界和约束
 * - 支持类型扩展和组合
 * - 接口命名遵循语义化原则
 *
 * ### 类型导出规则
 * - 所有公共类型都必须导出
 * - 类型导出必须保持向后兼容
 * - 内部类型使用 private 或 internal 标记
 * - 类型文档必须包含使用示例
 *
 * @example
 * ```typescript
 * import { ConfigRecord, ConfigLoader, ConfigNormalizer } from '@hl8/config';
 *
 * // 配置记录类型
 * type MyConfig = ConfigRecord;
 *
 * // 配置加载器类型
 * const loader: ConfigLoader = () => ({ port: 3000 });
 *
 * // 配置标准化函数类型
 * const normalizer: ConfigNormalizer = (config) => config;
 * ```
 */

// 基础配置类型
export * from "./config.types.js";

// 加载器类型
export * from "./loader.types.js";

// 缓存类型
export * from "./cache.types.js";

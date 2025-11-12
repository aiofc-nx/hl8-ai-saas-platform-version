/**
 * HL8 SAAS平台配置管理模块
 *
 * 提供完全类型安全的配置管理模块，支持配置文件解析、环境变量管理、
 * 配置验证、变量扩展等功能。基于 class-validator 和 class-transformer
 * 实现类型安全的配置管理。
 *
 * @description 此模块是 HL8 SAAS 平台的基础设施层核心模块，提供统一的配置管理接口。
 * 支持多格式配置文件加载、环境变量替换、配置验证和缓存功能。
 * 遵循 Clean Architecture 的基础设施层设计原则，为整个平台提供配置服务。
 *
 * ## 业务规则
 *
 * ### 类型安全规则
 * - 无需类型转换，直接注入配置类即可获得完整的 TypeScript 支持
 * - 支持嵌套配置的自动类型推断和智能提示
 * - 编译时类型检查确保配置正确性
 * - 运行时类型验证确保配置完整性
 *
 * ### 多格式支持规则
 * - 支持 .env、.json、.yml/.yaml 配置文件格式
 * - 支持环境变量覆盖和默认值设置
 * - 支持多个配置文件的深度合并
 * - 支持远程配置服务和数据库配置源
 *
 * ### 配置验证规则
 * - 集成 class-validator 进行配置验证
 * - 支持自定义验证规则和业务约束
 * - 提供详细的验证错误信息和错误路径
 * - 验证失败时阻止应用启动
 *
 * ### 变量扩展规则
 * - 支持 ${VAR} 语法进行环境变量替换
 * - 支持 ${VAR:-DEFAULT} 默认值语法
 * - 支持嵌套配置对象的变量引用
 * - 支持数组和对象中的变量替换
 *
 * ### 缓存管理规则
 * - 支持内存缓存和文件缓存策略
 * - 支持缓存键前缀和自定义键生成器
 * - 支持缓存过期时间（TTL）设置
 * - 支持缓存统计和事件监听
 * - 支持缓存失效和更新策略
 *
 * ## 业务逻辑流程
 *
 * 1. **配置加载**：从文件系统或远程服务加载配置
 * 2. **环境变量替换**：替换配置中的环境变量引用
 * 3. **配置合并**：深度合并多个配置源的结果
 * 4. **配置标准化**：执行自定义的配置转换逻辑
 * 5. **配置验证**：使用 class-validator 验证配置完整性
 * 6. **提供者注册**：将配置注册为 NestJS 提供者
 * 7. **缓存初始化**：初始化配置缓存（如果启用）
 *
 * @example
 * ```typescript
 * import { TypedConfigModule, fileLoader, dotenvLoader } from '@hl8/config';
 * import { Module, Injectable } from '@nestjs/common';
 * import { Type } from 'class-transformer';
 * import { IsString, IsNumber, ValidateNested } from 'class-validator';
 *
 * // 定义配置类
 * export class DatabaseConfig {
 *   @IsString()
 *   public readonly host!: string;
 *
 *   @IsNumber()
 *   @Type(() => Number)
 *   public readonly port!: number;
 * }
 *
 * export class RootConfig {
 *   @ValidateNested()
 *   @Type(() => DatabaseConfig)
 *   public readonly database!: DatabaseConfig;
 * }
 *
 * // 配置模块
 * @Module({
 *   imports: [
 *     TypedConfigModule.forRoot({
 *       schema: RootConfig,
 *       load: [
 *         fileLoader({ path: './config/app.yml' }),
 *         dotenvLoader({ separator: '__' })
 *       ]
 *     })
 *   ],
 * })
 * export class AppModule {}
 *
 * // 使用配置 - 完全类型安全
 * @Injectable()
 * export class DatabaseService {
 *   constructor(
 *     private readonly config: RootConfig,
 *     private readonly databaseConfig: DatabaseConfig
 *   ) {}
 *
 *   connect() {
 *     // 完全的类型推断和自动补全
 *     console.log(`${this.databaseConfig.host}:${this.databaseConfig.port}`);
 *   }
 * }
 * ```
 */

// 常量导出
export * from "./lib/constants.js";

// 核心模块导出
export { TypedConfigModule } from "./lib/typed-config.module.js";

// 接口导出
export * from "./lib/interfaces/typed-config-module-options.interface.js";

// 加载器导出
export * from "./lib/loader/index.js";

// 重新导出类型以避免冲突
export type {
  DirectoryLoaderOptions,
  DotenvLoaderOptions,
  FileLoaderOptions,
  RemoteLoaderOptions,
} from "./lib/types/loader.types.js";

// 工具函数导出
export { ConfigValidator } from "./lib/utils/config-validator.util.js";
export * from "./lib/utils/debug.util.js";
export * from "./lib/utils/for-each-deep.util.js";
export * from "./lib/utils/identity.util.js";
export * from "./lib/utils/imports.util.js";

// 错误处理导出
export * from "./lib/errors/index.js";

// 日志服务导出
export { ConfigLogger } from "./lib/services/config-logger.service.js";

// 类型定义导出
export type * from "./lib/types/index.js";

// 缓存功能导出
export * from "./lib/cache/index.js";

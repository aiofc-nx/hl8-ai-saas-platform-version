/**
 * @fileoverview CASL 权限能力模块
 * @description 注册 CASL 权限能力服务，导出 CaslAbilityService 接口
 *
 * ## 业务规则
 *
 * ### 模块注册规则
 * - 注册 CaslAbilityService 提供者
 * - 注册 AbilityCacheService 提供者
 * - 导出 CaslAbilityService 接口
 * - 支持多租户隔离
 * - 支持测试替身
 *
 * ### 依赖注入规则
 * - CaslAbilityService 接口可以通过依赖注入使用
 * - AbilityCacheService 接口可以通过依赖注入使用
 * - 支持注入权限规则构建器
 * - 支持注入缓存服务
 * - 支持注入配置和日志服务
 */

import { DynamicModule, Global, Module, Provider } from "@nestjs/common";
import { Logger } from "@hl8/logger";
import { CacheClientProvider } from "@hl8/cache";
import { AbilityCacheConfig } from "../configuration/schemas/infrastructure-config.schema.js";
import type { CaslAbilityService } from "./casl-ability.interface.js";
import type { AbilityCacheService } from "./casl-ability.interface.js";
import type { AbilityRuleBuilder } from "./casl-ability.interface.js";
import { CaslAbilityServiceImpl } from "./casl-ability.service.js";
import { AbilityCacheServiceImpl } from "./ability-cache.service.js";

/**
 * @description CASL 权限能力模块选项
 * @remarks 定义 CASL 权限能力模块的配置选项
 */
export interface CaslAbilityModuleOptions {
  /**
   * @description 是否注册为全局模块
   * @remarks 默认 false，需要显式导入
   */
  isGlobal?: boolean;

  /**
   * @description 权限缓存配置
   * @remarks 权限缓存的配置选项
   */
  config?: AbilityCacheConfig;

  /**
   * @description 权限规则构建器提供者
   * @remarks 权限规则构建器的提供者，如果未提供则使用默认规则
   */
  ruleBuilder?: Provider<AbilityRuleBuilder>;
}

/**
 * @description CASL 权限能力模块
 * @remarks 注册 CASL 权限能力服务，导出 CaslAbilityService 接口
 *
 * @example
 * ```typescript
 * @Module({
 *   imports: [
 *     CaslAbilityModule.forRoot({
 *       isGlobal: true,
 *       config: {
 *         ttlSeconds: 3600,
 *         enableCacheDegradation: true,
 *       },
 *     }),
 *   ],
 * })
 * export class AppModule {}
 * ```
 */
@Global()
@Module({})
export class CaslAbilityModule {
  /**
   * @description 注册 CASL 权限能力模块
   * @remarks 创建并配置 CASL 权限能力模块
   *
   * @param options - 模块选项
   * @returns 动态模块
   */
  static forRoot(options: CaslAbilityModuleOptions = {}): DynamicModule {
    const { isGlobal = false, config, ruleBuilder } = options;

    // 创建提供者
    const providers: Provider[] = [
      // 权限缓存服务
      {
        provide: "AbilityCacheService",
        useFactory: (
          cacheClientProvider: CacheClientProvider,
          logger?: Logger,
          abilityCacheConfig?: AbilityCacheConfig,
        ): AbilityCacheService => {
          return new AbilityCacheServiceImpl(
            cacheClientProvider,
            logger,
            abilityCacheConfig ?? config,
          );
        },
        inject: [
          CacheClientProvider,
          { token: Logger, optional: true },
          { token: AbilityCacheConfig, optional: true },
        ],
      },
      // 权限能力服务
      {
        provide: "CaslAbilityService",
        useFactory: (
          ruleBuilder?: AbilityRuleBuilder,
          cacheService?: AbilityCacheService,
          logger?: Logger,
        ): CaslAbilityService => {
          return new CaslAbilityServiceImpl(ruleBuilder, cacheService, logger);
        },
        inject: [
          { token: "AbilityRuleBuilder", optional: true },
          { token: "AbilityCacheService", optional: true },
          { token: Logger, optional: true },
        ],
      },
    ];

    // 如果提供了权限规则构建器，添加它
    if (ruleBuilder) {
      providers.push(ruleBuilder);
    }

    return {
      module: CaslAbilityModule,
      global: isGlobal,
      providers,
      exports: ["CaslAbilityService", "AbilityCacheService"],
    };
  }
}

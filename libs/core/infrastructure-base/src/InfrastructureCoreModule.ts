/**
 * @fileoverview 基础设施核心模块
 * @description 整合所有基础设施服务的核心模块，向应用层暴露统一的模块接口
 *
 * ## 业务规则
 *
 * ### 模块整合规则
 * - 整合所有基础设施服务（异常、配置、日志、缓存、事件存储、事件发布、权限缓存、审计）
 * - 提供统一的模块接口，简化应用层使用
 * - 支持多租户隔离，确保跨租户数据访问的隔离性达到 100%
 * - 支持测试替身，便于单元测试
 *
 * ### 模块注册规则
 * - 默认注册为全局模块（isGlobal: true）
 * - 自动注册所有基础设施服务为提供者
 * - 支持可选的配置选项，灵活适应不同场景
 * - 支持依赖注入使用所有基础设施服务
 *
 * ## 使用示例
 *
 * ```typescript
 * import { InfrastructureCoreModule } from '@hl8/infrastructure-base';
 *
 * @Module({
 *   imports: [
 *     InfrastructureCoreModule.forRoot({
 *       isGlobal: true,
 *       config: {
 *         eventStore: {
 *           connectionString: process.env.EVENT_STORE_CONNECTION_STRING,
 *         },
 *       },
 *     }),
 *   ],
 * })
 * export class AppModule {}
 * ```
 */

import { DynamicModule, Module } from "@nestjs/common";
import { CacheModule } from "./cache/cache.module.js";
import {
  InfrastructureConfigModule,
  InfrastructureConfigModuleOptions,
} from "./configuration/infrastructure-config.module.js";
import { LoggingModule } from "./logging/logger.provider.js";
import {
  EventStoreModule,
  EventStoreModuleOptions,
} from "./event-sourcing/event-store.module.js";
import {
  EventPublisherModule,
  EventPublisherModuleOptions,
} from "./eventing/event-publisher.module.js";
import {
  CaslAbilityModule,
  CaslAbilityModuleOptions,
} from "./casl/casl-ability.module.js";
import { AuditModule, AuditModuleOptions } from "./audit/audit.module.js";
import {
  ExceptionModule,
  ExceptionModuleOptions,
} from "./exceptions/exception.module.js";

/**
 * @description 基础设施核心模块选项
 * @remarks 定义基础设施核心模块的配置选项
 */
export interface InfrastructureCoreModuleOptions {
  /**
   * @description 是否注册为全局模块
   * @remarks 默认 true，基础设施模块全局可用
   */
  isGlobal?: boolean;

  /**
   * @description 配置模块选项
   * @remarks 配置模块的选项，支持配置加载、验证等
   */
  config?: InfrastructureConfigModuleOptions;

  /**
   * @description 事件存储模块选项
   * @remarks 事件存储模块的配置选项，如果提供则启用事件存储
   */
  eventStore?: EventStoreModuleOptions;

  /**
   * @description 事件发布模块选项
   * @remarks 事件发布模块的配置选项，如果提供则启用事件发布
   */
  eventPublisher?: EventPublisherModuleOptions;

  /**
   * @description 权限缓存模块选项
   * @remarks 权限缓存模块的配置选项，如果提供则启用权限缓存
   */
  abilityCache?: CaslAbilityModuleOptions;

  /**
   * @description 审计服务模块选项
   * @remarks 审计服务模块的配置选项，如果提供则启用审计服务
   */
  auditService?: AuditModuleOptions;

  /**
   * @description 异常服务模块选项
   * @remarks 异常服务模块的配置选项，如果提供则启用异常服务（默认启用）
   * 可以设置为 false 来禁用异常服务
   */
  exceptionService?: ExceptionModuleOptions | false;
}

/**
 * @description 基础设施核心模块
 * @remarks 整合所有基础设施服务的核心模块
 *
 * @example
 * ```typescript
 * @Module({
 *   imports: [
 *     InfrastructureCoreModule.forRoot({
 *       isGlobal: true,
 *       config: {
 *         isGlobal: true,
 *         config: {
 *           eventStore: {
 *             connectionString: process.env.EVENT_STORE_CONNECTION_STRING,
 *           },
 *         },
 *       },
 *       enableEventStore: true,
 *       enableEventPublisher: true,
 *       enableAbilityCache: true,
 *       enableAuditService: true,
 *     }),
 *   ],
 * })
 * export class AppModule {}
 * ```
 */
@Module({})
export class InfrastructureCoreModule {
  /**
   * @description 注册基础设施核心模块
   * @remarks 创建并配置基础设施核心模块
   *
   * @param options - 模块选项
   * @returns 动态模块
   */
  static forRoot(options: InfrastructureCoreModuleOptions = {}): DynamicModule {
    const {
      isGlobal = true,
      config = {},
      eventStore,
      eventPublisher,
      abilityCache,
      auditService,
      exceptionService,
    } = options;

    const imports: DynamicModule[] = [
      // 配置模块（必需）
      InfrastructureConfigModule.forRoot({
        isGlobal: config.isGlobal ?? true,
        config: config.config,
      }),
      // 日志模块（必需）
      LoggingModule,
      // 缓存模块（必需）
      CacheModule,
      // 事件存储模块（可选）
      ...(eventStore
        ? [
            EventStoreModule.forRoot({
              isGlobal: eventStore.isGlobal ?? false,
              config: eventStore.config ?? config.config?.eventStore,
              contextName: eventStore.contextName,
            }),
          ]
        : []),
      // 事件发布模块（可选）
      ...(eventPublisher
        ? [
            EventPublisherModule.forRoot({
              isGlobal: eventPublisher.isGlobal ?? false,
              config: eventPublisher.config ?? config.config?.eventPublisher,
              messageBrokerAdapter: eventPublisher.messageBrokerAdapter,
            }),
          ]
        : []),
      // 权限缓存模块（可选）
      ...(abilityCache
        ? [
            CaslAbilityModule.forRoot({
              isGlobal: abilityCache.isGlobal ?? false,
              config: abilityCache.config ?? config.config?.abilityCache,
              ruleBuilder: abilityCache.ruleBuilder,
            }),
          ]
        : []),
      // 审计服务模块（可选）
      ...(auditService
        ? [
            AuditModule.forRoot({
              isGlobal: auditService.isGlobal ?? false,
              config: auditService.config ?? config.config?.auditService,
              contextName: auditService.contextName,
              useNullService: auditService.useNullService,
            }),
          ]
        : []),
      // 异常服务模块（可选，默认启用）
      ...(exceptionService === false
        ? []
        : [
            ExceptionModule.forRoot({
              isGlobal:
                exceptionService && typeof exceptionService === "object"
                  ? (exceptionService.isGlobal ?? false)
                  : false,
            }),
          ]),
    ].filter(Boolean) as DynamicModule[];

    return {
      module: InfrastructureCoreModule,
      global: isGlobal,
      imports,
      exports: imports,
    };
  }
}

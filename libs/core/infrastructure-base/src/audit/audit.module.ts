/**
 * @fileoverview 审计模块
 * @description 注册审计服务，导出 AuditService 接口
 *
 * ## 业务规则
 *
 * ### 模块注册规则
 * - 注册 AuditService 提供者
 * - 注册 AuditRepository 提供者
 * - 导出 AuditService 接口
 * - 支持多租户隔离
 * - 支持测试替身
 *
 * ### 依赖注入规则
 * - AuditService 接口可以通过依赖注入使用
 * - AuditRepository 接口可以通过依赖注入使用
 * - 支持注入 MikroORM EntityManager
 * - 支持注入配置和日志服务
 */

import { DynamicModule, Global, Module, Provider } from "@nestjs/common";
import { EntityManager } from "@mikro-orm/core";
import { Logger } from "@hl8/logger";
import { getEntityManagerToken } from "@hl8/mikro-orm-nestjs";
import { AuditServiceConfig } from "../configuration/schemas/infrastructure-config.schema.js";
import type { AuditService } from "./audit.interface.js";
import { AuditServiceImpl } from "./audit.service.js";
import type { IAuditRepository } from "./repositories/audit.repository.js";
import { AuditRepository } from "./repositories/audit.repository.js";
import { NullAuditService } from "./null-audit.service.js";

/**
 * @description 审计模块选项
 * @remarks 定义审计模块的配置选项
 */
export interface AuditModuleOptions {
  /**
   * @description 是否注册为全局模块
   * @remarks 默认 false，需要显式导入
   */
  isGlobal?: boolean;

  /**
   * @description 审计服务配置
   * @remarks 审计服务的配置选项
   */
  config?: AuditServiceConfig;

  /**
   * @description EntityManager 上下文名称
   * @remarks 用于多数据源场景，指定使用的 EntityManager 上下文名称
   */
  contextName?: string;

  /**
   * @description 是否使用测试替身
   * @remarks 默认 false，使用实际的审计服务
   */
  useNullService?: boolean;
}

/**
 * @description 审计模块
 * @remarks 注册审计服务，导出 AuditService 接口
 *
 * @example
 * ```typescript
 * @Module({
 *   imports: [
 *     AuditModule.forRoot({
 *       isGlobal: true,
 *       config: {
 *         connectionString: process.env.AUDIT_CONNECTION_STRING,
 *       },
 *     }),
 *   ],
 * })
 * export class AppModule {}
 * ```
 */
@Global()
@Module({})
export class AuditModule {
  /**
   * @description 注册审计模块
   * @remarks 创建并配置审计模块
   *
   * @param options - 模块选项
   * @returns 动态模块
   */
  static forRoot(options: AuditModuleOptions = {}): DynamicModule {
    const {
      isGlobal = false,
      config,
      contextName,
      useNullService = false,
    } = options;

    // 获取 EntityManager 注入令牌
    const entityManagerToken = contextName
      ? getEntityManagerToken(contextName)
      : EntityManager;

    // 创建提供者
    const providers: Provider[] = [];

    if (useNullService) {
      // 使用测试替身
      providers.push({
        provide: "AuditService",
        useFactory: (): AuditService => {
          return new NullAuditService();
        },
      });
    } else {
      // 使用实际的审计服务
      // 审计仓储
      providers.push({
        provide: "AuditRepository",
        useFactory: (em: EntityManager, logger?: Logger): IAuditRepository => {
          return new AuditRepository(em, logger);
        },
        inject: [entityManagerToken, { token: Logger, optional: true }],
      });

      // 审计服务
      providers.push({
        provide: "AuditService",
        useFactory: (
          repository: IAuditRepository,
          logger?: Logger,
          auditServiceConfig?: AuditServiceConfig,
        ): AuditService => {
          return new AuditServiceImpl(
            repository,
            logger,
            auditServiceConfig ?? config,
          );
        },
        inject: [
          "AuditRepository",
          { token: Logger, optional: true },
          { token: AuditServiceConfig, optional: true },
        ],
      });
    }

    return {
      module: AuditModule,
      global: isGlobal,
      providers,
      exports: ["AuditService", "AuditRepository"],
    };
  }
}

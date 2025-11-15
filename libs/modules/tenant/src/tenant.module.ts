/**
 * @fileoverview 租户管理模块
 * @description NestJS 模块，注册租户管理相关的命令处理器、事件处理器和控制器
 *
 * ## 模块职责
 *
 * ### 命令处理
 * - 注册 CreateTenantHandler 等命令处理器
 *
 * ### 事件处理
 * - 注册 TenantProjectionHandler 等事件处理器
 *
 * ### 接口层
 * - 注册 TenantCommandController 等控制器
 *
 * ### 基础设施
 * - 注册 TenantRepository 实现
 * - 注册读模型实体
 *
 * ## 使用示例
 *
 * ```typescript
 * @Module({
 *   imports: [TenantModule],
 * })
 * export class AppModule {}
 * ```
 */

import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";
import { ApplicationCoreModule } from "@hl8/application-base";
import { EventStoreModule } from "@hl8/infrastructure-base";
import { EventPublisherModule } from "@hl8/infrastructure-base";
import { MikroOrmModule } from "@hl8/mikro-orm-nestjs";
import { CreateTenantHandler } from "./application/commands/create-tenant.handler.js";
import { ActivateTenantHandler } from "./application/commands/activate-tenant.handler.js";
import { DeactivateTenantHandler } from "./application/commands/deactivate-tenant.handler.js";
import { ArchiveTenantHandler } from "./application/commands/archive-tenant.handler.js";
import { TenantProjectionHandler } from "./infrastructure/projections/tenant-projection.handler.js";
import { TenantCommandController } from "./interfaces/controllers/tenant-command.controller.js";
import { TenantQueryController } from "./interfaces/controllers/tenant-query.controller.js";
import { GetTenantContextHandler } from "./application/queries/get-tenant-context.handler.js";
import { ListTenantsHandler } from "./application/queries/list-tenants.handler.js";
import { GetTenantByIdHandler } from "./application/queries/get-tenant-by-id.handler.js";
import { UpdateTenantProfileHandler } from "./application/commands/update-tenant-profile.handler.js";
import { TenantLifecycleSaga } from "./application/sagas/tenant-lifecycle.saga.js";
import { TenantRepositoryImpl } from "./infrastructure/repositories/tenant.repository.impl.js";
import { TenantProjection } from "./infrastructure/projections/tenant.projection.js";

/**
 * 租户管理模块
 *
 * @description 注册租户管理相关的所有组件
 */
/**
 * 租户管理模块配置选项
 *
 * @description 用于配置租户管理模块的依赖项
 */
export interface TenantModuleOptions {
  /**
   * EntityManager 上下文名称
   *
   * @description 用于多数据源场景，指定使用的 EntityManager 上下文名称
   * @default "postgres"
   */
  contextName?: string;

  /**
   * 是否注册为全局模块
   *
   * @description 如果为 true，则其他模块可以直接使用 TenantModule 导出的服务
   * @default false
   */
  isGlobal?: boolean;
}

/**
 * 租户管理模块
 *
 * @description 注册租户管理相关的所有组件
 *
 * ## 依赖项
 *
 * ### 必需依赖
 * - `ApplicationCoreModule`: 提供 CaslAbilityCoordinator 和 AuditCoordinator
 * - `EventStoreModule`: 提供 EventStore 和 SnapshotService
 * - `EventPublisherModule`: 提供 EventPublisher
 * - `MikroOrmModule`: 提供 EntityManager（需要在应用根模块中配置）
 * - `PinoLoggingModule`: 提供 Logger（需要在应用根模块中配置）
 *
 * ## 使用示例
 *
 * ```typescript
 * @Module({
 *   imports: [
 *     // 在应用根模块中配置
 *     PinoLoggingModule.forRoot({ ... }),
 *     MikroOrmModule.forRootAsync({ ... }),
 *     MikroOrmModule.forFeature([TenantProjection], "postgres"),
 *
 *     // 在业务模块中导入
 *     TenantModule.register({
 *       contextName: "postgres",
 *       isGlobal: false,
 *     }),
 *   ],
 * })
 * export class AppModule {}
 * ```
 */
@Module({})
export class TenantModule {
  /**
   * 注册租户管理模块
   *
   * @description 创建并配置租户管理模块，注册所有必要的依赖项
   *
   * @param options - 模块配置选项
   * @returns 动态模块
   */
  static register(
    options: TenantModuleOptions = {},
  ): import("@nestjs/common").DynamicModule {
    const { contextName = "postgres", isGlobal = false } = options;

    return {
      module: TenantModule,
      global: isGlobal,
      imports: [
        CqrsModule,
        // 应用层核心模块：提供 CaslAbilityCoordinator 和 AuditCoordinator
        ApplicationCoreModule.register({
          // TODO: 如果需要权限和审计功能，需要提供 abilityService 和 auditService
          // abilityService: { provide: ABILITY_SERVICE_TOKEN, useClass: ... },
          // auditService: { provide: AUDIT_SERVICE_TOKEN, useClass: ... },
        }),
        // 事件存储模块：提供 EventStore 和 SnapshotService
        EventStoreModule.forRoot({
          isGlobal: false,
          contextName,
        }),
        // 事件发布模块：提供 EventPublisher
        EventPublisherModule.forRoot({
          isGlobal: false,
        }),
        // MikroORM 实体注册：注册 TenantProjection 实体
        // 注意：MikroOrmModule.forRootAsync 需要在应用根模块中配置
        MikroOrmModule.forFeature([TenantProjection], contextName),
      ],
      controllers: [TenantCommandController, TenantQueryController],
      providers: [
        // 命令处理器
        CreateTenantHandler,
        ActivateTenantHandler,
        DeactivateTenantHandler,
        ArchiveTenantHandler,
        UpdateTenantProfileHandler,
        // 查询处理器
        GetTenantContextHandler,
        GetTenantByIdHandler,
        ListTenantsHandler,
        // 事件处理器
        TenantProjectionHandler,
        // Saga
        TenantLifecycleSaga,
        // 仓储实现
        {
          provide: "TenantRepository",
          useClass: TenantRepositoryImpl,
        },
      ],
      exports: [
        // 导出仓储接口供其他模块使用
        "TenantRepository",
      ],
    };
  }
}

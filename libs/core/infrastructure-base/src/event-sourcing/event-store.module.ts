/**
 * @fileoverview 事件存储模块
 * @description 注册事件存储服务，导出 EventStore 接口
 *
 * ## 业务规则
 *
 * ### 模块注册规则
 * - 注册 EventStore 提供者
 * - 导出 EventStore 接口
 * - 支持多租户隔离
 * - 支持测试替身
 *
 * ### 依赖注入规则
 * - EventStore 接口可以通过依赖注入使用
 * - 支持注入 MikroORM EntityManager
 * - 支持注入配置和日志服务
 */

import { DynamicModule, Global, Module, Provider } from "@nestjs/common";
import { EntityManager } from "@mikro-orm/core";
import { Logger } from "@hl8/logger";
import { getEntityManagerToken } from "@hl8/mikro-orm-nestjs";
import { EventStoreConfig } from "../configuration/schemas/infrastructure-config.schema.js";
import type { EventStore } from "./event-store.interface.js";
import { MikroORMEventStore } from "./mikro-orm-event-store.js";
import { SnapshotService } from "./snapshots/snapshot.service.js";

/**
 * @description 事件存储模块选项
 * @remarks 定义事件存储模块的配置选项
 */
export interface EventStoreModuleOptions {
  /**
   * @description 是否注册为全局模块
   * @remarks 默认 false，需要显式导入
   */
  isGlobal?: boolean;

  /**
   * @description 事件存储配置
   * @remarks 事件存储的配置选项
   */
  config?: EventStoreConfig;

  /**
   * @description EntityManager 上下文名称
   * @remarks 用于多数据源场景，指定使用的 EntityManager 上下文名称
   */
  contextName?: string;
}

/**
 * @description 事件存储模块
 * @remarks 注册事件存储服务，导出 EventStore 接口
 *
 * @example
 * ```typescript
 * @Module({
 *   imports: [
 *     EventStoreModule.forRoot({
 *       isGlobal: true,
 *       config: {
 *         connectionString: process.env.EVENT_STORE_CONNECTION_STRING,
 *         optimisticLockRetryCount: 3,
 *       },
 *     }),
 *   ],
 * })
 * export class AppModule {}
 * ```
 */
@Global()
@Module({})
export class EventStoreModule {
  /**
   * @description 注册事件存储模块
   * @remarks 创建并配置事件存储模块
   *
   * @param options - 模块选项
   * @returns 动态模块
   */
  static forRoot(options: EventStoreModuleOptions = {}): DynamicModule {
    const { isGlobal = false, config, contextName } = options;

    // 获取 EntityManager 注入令牌
    const entityManagerToken = contextName
      ? getEntityManagerToken(contextName)
      : EntityManager;

    // 创建提供者
    const providers: Provider[] = [
      // 事件存储服务
      {
        provide: "EventStore",
        useFactory: (
          em: EntityManager,
          logger?: Logger,
          eventStoreConfig?: EventStoreConfig,
        ): EventStore => {
          return new MikroORMEventStore(em, logger, eventStoreConfig ?? config);
        },
        inject: [
          entityManagerToken,
          { token: Logger, optional: true },
          { token: EventStoreConfig, optional: true },
        ],
      },
      // 快照服务
      {
        provide: SnapshotService,
        useFactory: (em: EntityManager, logger?: Logger): SnapshotService => {
          return new SnapshotService(em, logger);
        },
        inject: [entityManagerToken, { token: Logger, optional: true }],
      },
    ];

    return {
      module: EventStoreModule,
      global: isGlobal,
      providers,
      exports: ["EventStore", SnapshotService],
    };
  }
}

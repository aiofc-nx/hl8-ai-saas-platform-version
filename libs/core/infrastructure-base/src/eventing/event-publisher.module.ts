/**
 * @fileoverview 事件发布模块
 * @description 注册事件发布服务，导出 EventPublisher 接口
 *
 * ## 业务规则
 *
 * ### 模块注册规则
 * - 注册 EventPublisher 提供者
 * - 导出 EventPublisher 接口
 * - 支持多租户隔离
 * - 支持测试替身
 *
 * ### 依赖注入规则
 * - EventPublisher 接口可以通过依赖注入使用
 * - 支持注入 @nestjs/cqrs EventBus
 * - 支持注入消息队列适配器
 * - 支持注入配置和日志服务
 */

import { DynamicModule, Global, Module, Provider } from "@nestjs/common";
import { EventBus } from "@nestjs/cqrs";
import { Logger } from "@hl8/logger";
import { EventPublisherConfig } from "../configuration/schemas/infrastructure-config.schema.js";
import { EventBusModule } from "./event-bus.module.js";
import type { EventPublisher } from "./event-publisher.interface.js";
import { EventPublisherService } from "./event-publisher.service.js";
import type { MessageBrokerAdapter } from "./message-broker/message-broker.adapter.interface.js";
import { MemoryMessageBrokerAdapter } from "./message-broker/memory-message-broker.adapter.js";

/**
 * @description 事件发布模块选项
 * @remarks 定义事件发布模块的配置选项
 */
export interface EventPublisherModuleOptions {
  /**
   * @description 是否注册为全局模块
   * @remarks 默认 false，需要显式导入
   */
  isGlobal?: boolean;

  /**
   * @description 事件发布配置
   * @remarks 事件发布的配置选项
   */
  config?: EventPublisherConfig;

  /**
   * @description 消息队列适配器提供者
   * @remarks 消息队列适配器的提供者，如果未提供则使用内存适配器
   */
  messageBrokerAdapter?: Provider<MessageBrokerAdapter>;
}

/**
 * @description 事件发布模块
 * @remarks 注册事件发布服务，导出 EventPublisher 接口
 *
 * @example
 * ```typescript
 * @Module({
 *   imports: [
 *     EventPublisherModule.forRoot({
 *       isGlobal: true,
 *       config: {
 *         messageBrokerType: 'kafka',
 *         messageBrokerConnectionString: 'kafka://localhost:9092',
 *       },
 *     }),
 *   ],
 * })
 * export class AppModule {}
 * ```
 */
@Global()
@Module({})
export class EventPublisherModule {
  /**
   * @description 注册事件发布模块
   * @remarks 创建并配置事件发布模块
   *
   * @param options - 模块选项
   * @returns 动态模块
   */
  static forRoot(options: EventPublisherModuleOptions = {}): DynamicModule {
    const { isGlobal = false, config, messageBrokerAdapter } = options;

    // 创建提供者
    const providers: Provider[] = [
      // 事件发布服务
      {
        provide: "EventPublisher",
        useFactory: (
          eventBus: EventBus,
          messageBroker?: MessageBrokerAdapter,
          logger?: Logger,
          eventPublisherConfig?: EventPublisherConfig,
        ): EventPublisher => {
          return new EventPublisherService(
            eventBus,
            messageBroker,
            logger,
            eventPublisherConfig ?? config,
          );
        },
        inject: [
          EventBus,
          { token: "MessageBrokerAdapter", optional: true },
          { token: Logger, optional: true },
          { token: EventPublisherConfig, optional: true },
        ],
      },
    ];

    // 如果未提供消息队列适配器，使用内存适配器
    if (!messageBrokerAdapter) {
      providers.push({
        provide: "MessageBrokerAdapter",
        useFactory: (logger?: Logger): MessageBrokerAdapter => {
          return new MemoryMessageBrokerAdapter(logger);
        },
        inject: [{ token: Logger, optional: true }],
      });
    } else {
      providers.push(messageBrokerAdapter);
    }

    return {
      module: EventPublisherModule,
      global: isGlobal,
      imports: [EventBusModule.forRoot({ isGlobal: false })],
      providers,
      exports: ["EventPublisher", "MessageBrokerAdapter"],
    };
  }
}

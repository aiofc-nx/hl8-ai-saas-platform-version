/**
 * @fileoverview 事件总线模块
 * @description 集成 @nestjs/cqrs 提供内部事件总线，支持事件发布和订阅
 *
 * ## 业务规则
 *
 * ### 事件总线规则
 * - 使用 @nestjs/cqrs EventBus 发布事件
 * - 支持事件处理器订阅和处理事件
 * - 支持投影处理器和 Saga 处理器
 * - 支持多租户隔离
 *
 * ### 事件处理器规则
 * - 事件处理器必须使用 @EventsHandler 装饰器
 * - 事件处理器必须实现 IEventHandler 接口
 * - 事件处理器必须处理特定类型的事件
 * - 事件处理器必须支持多租户隔离
 */

import { DynamicModule, Global, Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";

/**
 * @description 事件总线模块
 * @remarks 集成 @nestjs/cqrs 提供内部事件总线，支持事件发布和订阅
 *
 * @example
 * ```typescript
 * @Module({
 *   imports: [
 *     EventBusModule.forRoot({
 *       isGlobal: true,
 *     }),
 *   ],
 * })
 * export class AppModule {}
 * ```
 */
@Global()
@Module({})
export class EventBusModule {
  /**
   * @description 注册事件总线模块
   * @remarks 创建并配置事件总线模块
   *
   * @param options - 模块选项
   * @returns 动态模块
   */
  static forRoot(options: { isGlobal?: boolean } = {}): DynamicModule {
    const { isGlobal = false } = options;

    return {
      module: EventBusModule,
      global: isGlobal,
      imports: [CqrsModule],
      exports: [CqrsModule],
    };
  }
}

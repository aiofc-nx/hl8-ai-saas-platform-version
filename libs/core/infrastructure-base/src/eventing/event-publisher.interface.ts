/**
 * @fileoverview 事件发布接口
 * @description 定义事件发布的接口规范，支持事件发布到内部事件总线和外部消息队列
 *
 * ## 业务规则
 *
 * ### 事件发布规则
 * - 事件必须发布到内部事件总线
 * - 事件必须转发到外部消息队列（如果配置）
 * - 事件发布失败时支持重试机制
 * - 事件发布失败时支持降级处理
 *
 * ### 内部事件总线规则
 * - 使用 @nestjs/cqrs EventBus 发布事件
 * - 支持事件处理器订阅和处理事件
 * - 支持投影处理器和 Saga 处理器
 *
 * ### 外部消息队列规则
 * - 支持 Kafka、RabbitMQ、RocketMQ 等消息队列
 * - 消息队列不可用时支持降级处理
 * - 消息队列不可用时仅记录日志而不阻塞主流程
 */

import type { StoredEvent } from "../event-sourcing/event-store.interface.js";

/**
 * @description 事件发布接口
 * @remarks 定义事件发布的核心操作，包括事件发布到内部事件总线和外部消息队列
 *
 * @example
 * ```typescript
 * // 注入事件发布服务
 * constructor(private readonly eventPublisher: EventPublisher) {}
 *
 * // 发布事件
 * const events: StoredEvent[] = [
 *   {
 *     eventId: 'event-1',
 *     aggregateId: 'aggregate-1',
 *     tenantId: 'tenant-1',
 *     version: 1,
 *     payload: { type: 'UserCreated', name: 'John' },
 *     occurredAt: new Date(),
 *     metadata: { userId: 'user-1' },
 *   },
 * ];
 * await eventPublisher.publish(events);
 * ```
 */
export interface EventPublisher {
  /**
   * @description 发布事件到内部事件总线和外部消息队列
   * @remarks 将事件发布到内部事件总线和外部消息队列，支持批量发布
   *
   * ## 业务规则
   * - 事件必须发布到内部事件总线
   * - 事件必须转发到外部消息队列（如果配置）
   * - 事件发布失败时支持重试机制
   * - 事件发布失败时支持降级处理
   * - 消息队列不可用时仅记录日志而不阻塞主流程
   *
   * @param events - 事件列表
   * @returns Promise<void>
   * @throws {EventPublisherException} 当事件发布失败且无法降级时
   *
   * @example
   * ```typescript
   * const events: StoredEvent[] = [
   *   {
   *     eventId: 'event-1',
   *     aggregateId: 'aggregate-1',
   *     tenantId: 'tenant-1',
   *     version: 1,
   *     payload: { type: 'UserCreated', name: 'John' },
   *     occurredAt: new Date(),
   *     metadata: { userId: 'user-1' },
   *   },
   * ];
   * await eventPublisher.publish(events);
   * ```
   */
  publish(events: StoredEvent[]): Promise<void>;
}

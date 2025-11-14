/**
 * @fileoverview 消息队列适配器接口
 * @description 定义消息队列适配器的接口规范，支持将事件转发到外部消息队列
 *
 * ## 业务规则
 *
 * ### 消息队列适配器规则
 * - 支持 Kafka、RabbitMQ、RocketMQ 等消息队列
 * - 消息队列不可用时支持降级处理
 * - 消息队列不可用时仅记录日志而不阻塞主流程
 * - 支持消息队列连接池管理
 * - 支持消息队列重试机制
 *
 * ### 消息格式规则
 * - 消息必须包含事件 ID、聚合 ID、租户 ID 等元数据
 * - 消息必须包含事件负载
 * - 消息必须包含事件发生时间
 * - 消息必须包含事件版本号
 */

import type { StoredEvent } from "../../event-sourcing/event-store.interface.js";

/**
 * @description 消息队列适配器接口
 * @remarks 定义消息队列适配器的核心操作，包括事件转发到外部消息队列
 *
 * @example
 * ```typescript
 * // 注入消息队列适配器
 * constructor(private readonly messageBroker: MessageBrokerAdapter) {}
 *
 * // 转发事件
 * const event: StoredEvent = {
 *   eventId: 'event-1',
 *   aggregateId: 'aggregate-1',
 *   tenantId: 'tenant-1',
 *   version: 1,
 *   payload: { type: 'UserCreated', name: 'John' },
 *   occurredAt: new Date(),
 *   metadata: { userId: 'user-1' },
 * };
 * await messageBroker.forward(event);
 * ```
 */
export interface MessageBrokerAdapter {
  /**
   * @description 转发事件到外部消息队列
   * @remarks 将事件转发到外部消息队列，支持异步处理
   *
   * ## 业务规则
   * - 消息队列不可用时支持降级处理
   * - 消息队列不可用时仅记录日志而不阻塞主流程
   * - 支持消息队列连接池管理
   * - 支持消息队列重试机制
   *
   * @param event - 要转发的事件
   * @returns Promise<void>
   * @throws {MessageBrokerException} 当消息队列不可用且无法降级时（通常不会抛出，而是记录日志）
   *
   * @example
   * ```typescript
   * const event: StoredEvent = {
   *   eventId: 'event-1',
   *   aggregateId: 'aggregate-1',
   *   tenantId: 'tenant-1',
   *   version: 1,
   *   payload: { type: 'UserCreated', name: 'John' },
   *   occurredAt: new Date(),
   *   metadata: { userId: 'user-1' },
   * };
   * await messageBroker.forward(event);
   * ```
   */
  forward(event: StoredEvent): Promise<void>;

  /**
   * @description 批量转发事件到外部消息队列
   * @remarks 将多个事件批量转发到外部消息队列，支持异步处理
   *
   * ## 业务规则
   * - 消息队列不可用时支持降级处理
   * - 消息队列不可用时仅记录日志而不阻塞主流程
   * - 支持消息队列连接池管理
   * - 支持消息队列重试机制
   *
   * @param events - 要转发的事件列表
   * @returns Promise<void>
   * @throws {MessageBrokerException} 当消息队列不可用且无法降级时（通常不会抛出，而是记录日志）
   *
   * @example
   * ```typescript
   * const events: StoredEvent[] = [
   *   // ... 事件列表
   * ];
   * await messageBroker.forwardBatch(events);
   * ```
   */
  forwardBatch(events: StoredEvent[]): Promise<void>;
}

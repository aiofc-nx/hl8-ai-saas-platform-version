/**
 * @fileoverview 内存消息队列适配器（测试替身）
 * @description 实现内存消息队列适配器，供单元测试使用
 *
 * ## 业务规则
 *
 * ### 测试替身规则
 * - 使用内存存储事件，不持久化到消息队列
 * - 支持所有 MessageBrokerAdapter 接口方法
 * - 支持多租户隔离
 * - 支持事件查询和重放
 */

import { Inject, Injectable, Optional } from "@nestjs/common";
import { Logger } from "@hl8/logger";
import { MessageBrokerException } from "../../exceptions/infrastructure-exception.js";
import type { MessageBrokerAdapter } from "./message-broker.adapter.interface.js";
import type { StoredEvent } from "../../event-sourcing/event-store.interface.js";

type LoggerService = InstanceType<typeof Logger>;

/**
 * @description 内存消息队列适配器（测试替身）
 * @remarks 实现内存消息队列适配器，供单元测试使用
 *
 * @example
 * ```typescript
 * // 创建内存消息队列适配器
 * const messageBroker = new MemoryMessageBrokerAdapter();
 *
 * // 转发事件
 * await messageBroker.forward(event);
 * ```
 */
@Injectable()
export class MemoryMessageBrokerAdapter implements MessageBrokerAdapter {
  /**
   * @description 事件存储
   * @remarks 使用 Map 存储事件，键为 topic，值为事件列表
   */
  private readonly events = new Map<string, StoredEvent[]>();

  /**
   * @description 构造函数
   * @param logger - 日志服务（可选）
   */
  constructor(
    @Optional() @Inject(Logger) private readonly logger?: LoggerService,
  ) {}

  /**
   * @description 转发事件到外部消息队列
   * @remarks 将事件转发到内存存储，支持异步处理
   *
   * @param event - 要转发的事件
   * @returns Promise<void>
   */
  async forward(event: StoredEvent): Promise<void> {
    try {
      // 获取主题（使用租户 ID 作为主题）
      const topic = `tenant:${event.tenantId}`;

      // 获取现有事件列表
      const existingEvents = this.events.get(topic) ?? [];

      // 追加事件
      this.events.set(topic, [...existingEvents, event]);

      // 记录日志
      this.logger?.debug("事件已转发到内存消息队列", {
        topic,
        eventId: event.eventId,
        aggregateId: event.aggregateId,
        tenantId: event.tenantId,
      });
    } catch (error) {
      // 记录错误日志
      this.logger?.error(error as Error, {
        eventId: event.eventId,
      });

      // 抛出异常
      throw new MessageBrokerException(
        "消息队列",
        `事件转发到内存消息队列失败: ${(error as Error).message}`,
        "MESSAGE_BROKER_ERROR",
        error,
      );
    }
  }

  /**
   * @description 批量转发事件到外部消息队列
   * @remarks 将多个事件批量转发到内存存储，支持异步处理
   *
   * @param events - 要转发的事件列表
   * @returns Promise<void>
   */
  async forwardBatch(events: StoredEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    try {
      // 按主题分组事件
      const eventsByTopic = new Map<string, StoredEvent[]>();

      for (const event of events) {
        const topic = `tenant:${event.tenantId}`;
        const existingEvents = eventsByTopic.get(topic) ?? [];
        eventsByTopic.set(topic, [...existingEvents, event]);
      }

      // 批量追加事件
      for (const [topic, topicEvents] of eventsByTopic) {
        const existingEvents = this.events.get(topic) ?? [];
        this.events.set(topic, [...existingEvents, ...topicEvents]);
      }

      // 记录日志
      this.logger?.debug("事件已批量转发到内存消息队列", {
        eventCount: events.length,
        topicCount: eventsByTopic.size,
      });
    } catch (error) {
      // 记录错误日志
      this.logger?.error(error as Error, {
        eventCount: events.length,
      });

      // 抛出异常
      throw new MessageBrokerException(
        "消息队列",
        `事件批量转发到内存消息队列失败: ${(error as Error).message}`,
        "MESSAGE_BROKER_ERROR",
        error,
      );
    }
  }

  /**
   * @description 清空事件存储
   * @remarks 清空所有事件，用于测试
   */
  clear(): void {
    this.events.clear();
  }

  /**
   * @description 获取事件数量
   * @remarks 获取指定主题的事件数量
   *
   * @param topic - 主题
   * @returns 事件数量
   */
  getEventCount(topic: string): number {
    return this.events.get(topic)?.length ?? 0;
  }

  /**
   * @description 获取事件列表
   * @remarks 获取指定主题的事件列表
   *
   * @param topic - 主题
   * @returns 事件列表
   */
  getEvents(topic: string): StoredEvent[] {
    return this.events.get(topic) ?? [];
  }
}

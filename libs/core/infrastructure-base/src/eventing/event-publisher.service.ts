/**
 * @fileoverview 事件发布服务
 * @description 实现事件发布服务，支持发布事件到内部事件总线和外部消息队列
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

import { Inject, Injectable, Optional } from "@nestjs/common";
import { EventBus, IEvent } from "@nestjs/cqrs";
import { Logger } from "@hl8/logger";
import {
  EventPublisherException,
  MessageBrokerException,
} from "../exceptions/infrastructure-exception.js";
import { EventPublisherConfig } from "../configuration/schemas/infrastructure-config.schema.js";
import type { EventPublisher } from "./event-publisher.interface.js";
import type { StoredEvent } from "../event-sourcing/event-store.interface.js";
import type { MessageBrokerAdapter } from "./message-broker/message-broker.adapter.interface.js";

type LoggerService = InstanceType<typeof Logger>;

/**
 * @description 领域事件接口
 * @remarks 扩展 IEvent 接口，包含事件的基本信息
 */
export interface DomainEvent extends IEvent {
  /**
   * @description 事件 ID
   * @remarks 事件的唯一标识
   */
  readonly eventId: string;

  /**
   * @description 聚合 ID
   * @remarks 事件所属的聚合标识
   */
  readonly aggregateId: string;

  /**
   * @description 租户 ID
   * @remarks 事件所属的租户标识
   */
  readonly tenantId: string;

  /**
   * @description 事件版本号
   * @remarks 事件在聚合中的版本号
   */
  readonly version: number;

  /**
   * @description 事件发生时间
   * @remarks 事件发生的时间戳
   */
  readonly occurredAt: Date;

  /**
   * @description 事件元数据
   * @remarks 事件的附加信息
   */
  readonly metadata?: Record<string, unknown>;
}

/**
 * @description 事件发布服务实现
 * @remarks 实现事件发布服务，支持发布事件到内部事件总线和外部消息队列
 *
 * @example
 * ```typescript
 * // 注入事件发布服务
 * constructor(private readonly eventPublisher: EventPublisherService) {}
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
@Injectable()
export class EventPublisherService implements EventPublisher {
  /**
   * @description 构造函数
   * @param eventBus - @nestjs/cqrs EventBus
   * @param messageBroker - 消息队列适配器（可选）
   * @param logger - 日志服务（可选）
   * @param config - 事件发布配置（可选）
   */
  constructor(
    private readonly eventBus: EventBus,
    @Optional()
    @Inject("MessageBrokerAdapter")
    private readonly messageBroker?: MessageBrokerAdapter,
    @Optional() @Inject(Logger) private readonly logger?: LoggerService,
    @Optional()
    @Inject(EventPublisherConfig)
    private readonly config?: EventPublisherConfig,
  ) {}

  /**
   * @description 发布事件到内部事件总线和外部消息队列
   * @remarks 将事件发布到内部事件总线和外部消息队列，支持批量发布
   *
   * @param events - 事件列表
   * @returns Promise<void>
   * @throws {EventPublisherException} 当事件发布失败且无法降级时
   */
  async publish(events: StoredEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    try {
      // 发布到内部事件总线
      await this.publishToEventBus(events);

      // 转发到外部消息队列（如果配置）
      if (this.messageBroker) {
        await this.forwardToMessageBroker(events);
      }
    } catch (error) {
      // 记录错误日志
      this.logger?.error(error as Error, {
        eventCount: events.length,
      });

      // 检查是否需要降级处理
      if (this.shouldDegrade(error as Error)) {
        // 降级处理：仅记录日志
        this.logger?.warn("事件发布失败，已降级处理", {
          eventCount: events.length,
          error: (error as Error).message,
        });
        return;
      }

      // 无法处理的错误，抛出异常
      throw new EventPublisherException(
        `事件发布失败: ${(error as Error).message}`,
        "EVENT_PUBLISHER_ERROR",
        {
          eventCount: events.length,
        },
        error,
      );
    }
  }

  /**
   * @description 发布事件到内部事件总线
   * @remarks 将事件发布到 @nestjs/cqrs EventBus
   *
   * @param events - 事件列表
   * @returns Promise<void>
   */
  private async publishToEventBus(events: StoredEvent[]): Promise<void> {
    try {
      // 转换为领域事件
      const domainEvents = events.map((event) => this.toDomainEvent(event));

      // 发布到事件总线
      this.eventBus.publishAll(domainEvents);

      // 记录日志
      this.logger?.debug("事件已发布到内部事件总线", {
        eventCount: events.length,
      });
    } catch (error) {
      // 记录错误日志
      this.logger?.error(error as Error, {
        eventCount: events.length,
      });

      // 抛出异常
      throw new EventPublisherException(
        `事件发布到内部事件总线失败: ${(error as Error).message}`,
        "EVENT_BUS_ERROR",
        {
          eventCount: events.length,
        },
        error,
      );
    }
  }

  /**
   * @description 转发事件到外部消息队列
   * @remarks 将事件转发到外部消息队列，支持降级处理
   *
   * @param events - 事件列表
   * @returns Promise<void>
   */
  private async forwardToMessageBroker(events: StoredEvent[]): Promise<void> {
    if (!this.messageBroker) {
      return;
    }

    try {
      // 转发到消息队列
      if (events.length === 1) {
        await this.messageBroker.forward(events[0]);
      } else {
        await this.messageBroker.forwardBatch(events);
      }

      // 记录日志
      this.logger?.debug("事件已转发到外部消息队列", {
        eventCount: events.length,
      });
    } catch (error) {
      // 记录错误日志
      this.logger?.error(error as Error, {
        eventCount: events.length,
      });

      // 检查是否需要降级处理
      if (this.config?.enableMessageBrokerDegradation !== false) {
        // 降级处理：仅记录日志
        this.logger?.warn("事件转发到外部消息队列失败，已降级处理", {
          eventCount: events.length,
          error: (error as Error).message,
        });
        return;
      }

      // 无法降级，抛出异常
      throw new MessageBrokerException(
        "消息队列",
        `事件转发到外部消息队列失败: ${(error as Error).message}`,
        "MESSAGE_BROKER_ERROR",
        error,
      );
    }
  }

  /**
   * @description 转换为领域事件
   * @remarks 将 StoredEvent 转换为 DomainEvent
   *
   * @param event - 存储的事件
   * @returns 领域事件
   */
  private toDomainEvent(event: StoredEvent): DomainEvent {
    return {
      eventId: event.eventId,
      aggregateId: event.aggregateId,
      tenantId: event.tenantId,
      version: event.version,
      occurredAt: event.occurredAt,
      metadata: event.metadata,
      // 将 payload 作为事件数据
      ...(event.payload as Record<string, unknown>),
    } as DomainEvent;
  }

  /**
   * @description 判断是否需要降级处理
   * @remarks 判断错误是否需要降级处理
   *
   * @param _error - 错误对象（当前未使用，保留用于未来扩展）
   * @returns 是否需要降级处理
   */
  private shouldDegrade(_error: Error): boolean {
    // 当前实现：基于配置决定是否降级
    // 未来可扩展：基于错误类型判断（网络错误、超时等）
    return this.config?.enableMessageBrokerDegradation === true;
  }
}

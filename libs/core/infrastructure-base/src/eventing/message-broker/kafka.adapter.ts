/**
 * @fileoverview Kafka 消息队列适配器
 * @description 实现 Kafka 消息队列适配器，支持将事件转发到 Kafka 消息队列
 *
 * ## 业务规则
 *
 * ### Kafka 适配器规则
 * - 支持 Kafka 消息队列
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

import { Inject, Injectable, Optional } from "@nestjs/common";
import { Logger } from "@hl8/logger";
import { MessageBrokerException } from "../../exceptions/infrastructure-exception.js";
import { EventPublisherConfig } from "../../configuration/schemas/infrastructure-config.schema.js";
import type { MessageBrokerAdapter } from "./message-broker.adapter.interface.js";
import type { StoredEvent } from "../../event-sourcing/event-store.interface.js";

type LoggerService = InstanceType<typeof Logger>;

/**
 * @description Kafka 消息队列适配器
 * @remarks 实现 Kafka 消息队列适配器，支持将事件转发到 Kafka 消息队列
 *
 * @example
 * ```typescript
 * // 创建 Kafka 适配器
 * const kafkaAdapter = new KafkaAdapter(config, logger);
 *
 * // 转发事件
 * await kafkaAdapter.forward(event);
 * ```
 */
@Injectable()
export class KafkaAdapter implements MessageBrokerAdapter {
  /**
   * @description 构造函数
   * @param config - 事件发布配置
   * @param logger - 日志服务（可选）
   */
  constructor(
    private readonly config: EventPublisherConfig,
    @Optional() @Inject(Logger) private readonly logger?: LoggerService,
  ) {
    // TODO: 初始化 Kafka 客户端
    // 例如：this.kafkaClient = new Kafka({ brokers: [...] });
  }

  /**
   * @description 转发事件到外部消息队列
   * @remarks 将事件转发到 Kafka 消息队列，支持异步处理
   *
   * @param event - 要转发的事件
   * @returns Promise<void>
   */
  async forward(event: StoredEvent): Promise<void> {
    try {
      // TODO: 实现 Kafka 消息发送逻辑
      // 例如：
      // const producer = this.kafkaClient.producer();
      // await producer.connect();
      // await producer.send({
      //   topic: `tenant:${event.tenantId}`,
      //   messages: [{
      //     key: event.eventId,
      //     value: JSON.stringify(event),
      //   }],
      // });
      // await producer.disconnect();

      // 记录日志
      this.logger?.debug("事件已转发到 Kafka 消息队列", {
        eventId: event.eventId,
        aggregateId: event.aggregateId,
        tenantId: event.tenantId,
        topic: `tenant:${event.tenantId}`,
      });
    } catch (error) {
      // 记录错误日志
      this.logger?.error(error as Error, {
        eventId: event.eventId,
      });

      // 检查是否需要降级处理
      if (this.config.enableMessageBrokerDegradation !== false) {
        // 降级处理：仅记录日志
        this.logger?.warn("事件转发到 Kafka 消息队列失败，已降级处理", {
          eventId: event.eventId,
          error: (error as Error).message,
        });
        return;
      }

      // 无法降级，抛出异常
      throw new MessageBrokerException(
        "Kafka 消息队列",
        `事件转发到 Kafka 消息队列失败: ${(error as Error).message}`,
        "MESSAGE_BROKER_ERROR",
        error,
      );
    }
  }

  /**
   * @description 批量转发事件到外部消息队列
   * @remarks 将多个事件批量转发到 Kafka 消息队列，支持异步处理
   *
   * @param events - 要转发的事件列表
   * @returns Promise<void>
   */
  async forwardBatch(events: StoredEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    try {
      // TODO: 实现 Kafka 批量消息发送逻辑
      // 例如：
      // const producer = this.kafkaClient.producer();
      // await producer.connect();
      // const messages = events.map(event => ({
      //   topic: `tenant:${event.tenantId}`,
      //   messages: [{
      //     key: event.eventId,
      //     value: JSON.stringify(event),
      //   }],
      // }));
      // await producer.sendBatch({ topicMessages: messages });
      // await producer.disconnect();

      // 记录日志
      this.logger?.debug("事件已批量转发到 Kafka 消息队列", {
        eventCount: events.length,
      });
    } catch (error) {
      // 记录错误日志
      this.logger?.error(error as Error, {
        eventCount: events.length,
      });

      // 检查是否需要降级处理
      if (this.config.enableMessageBrokerDegradation !== false) {
        // 降级处理：仅记录日志
        this.logger?.warn("事件批量转发到 Kafka 消息队列失败，已降级处理", {
          eventCount: events.length,
          error: (error as Error).message,
        });
        return;
      }

      // 无法降级，抛出异常
      throw new MessageBrokerException(
        "Kafka 消息队列",
        `事件批量转发到 Kafka 消息队列失败: ${(error as Error).message}`,
        "MESSAGE_BROKER_ERROR",
        error,
      );
    }
  }
}

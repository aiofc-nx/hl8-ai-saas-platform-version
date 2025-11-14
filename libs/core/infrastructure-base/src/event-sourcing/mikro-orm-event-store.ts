/**
 * @fileoverview MikroORM 事件存储实现
 * @description 基于 MikroORM 实现的事件存储，支持事件持久化存储、检索和重放
 *
 * ## 业务规则
 *
 * ### 事件存储规则
 * - 事件必须按版本顺序存储
 * - 事件必须包含租户标识，确保多租户隔离
 * - 事件版本必须连续，不允许跳过版本号
 * - 事件存储必须支持乐观锁机制检测版本冲突
 *
 * ### 乐观锁机制
 * - 使用唯一索引 (aggregateId, tenantId, version) 检测版本冲突
 * - 版本冲突时自动重试指定次数（可配置）
 * - 重试失败后返回明确的错误信息
 * - 重试延迟可配置（默认 100 毫秒）
 *
 * ### 租户隔离机制
 * - 所有查询必须包含租户过滤条件
 * - 确保跨租户数据访问的隔离性达到 100%
 * - 防止跨租户数据泄露
 *
 * ### 降级处理
 * - 当事件存储服务不可用时，将事件写入本地队列
 * - 待服务恢复后自动重试写入
 * - 确保事件不丢失
 */

import {
  EntityManager,
  UniqueConstraintViolationException,
  QueryOrder,
} from "@mikro-orm/core";
import { Inject, Injectable, Optional } from "@nestjs/common";
import { Logger } from "@hl8/logger";
import {
  EventStoreException,
  EventStoreVersionConflictException,
} from "../exceptions/infrastructure-exception.js";
import { EventStoreConfig } from "../configuration/schemas/infrastructure-config.schema.js";
import type { EventStore, StoredEvent } from "./event-store.interface.js";
import { EventEntity } from "./entities/event.entity.js";

type LoggerService = InstanceType<typeof Logger>;

/**
 * @description MikroORM 事件存储实现
 * @remarks 基于 MikroORM 实现的事件存储，支持事件持久化存储、检索和重放
 *
 * @example
 * ```typescript
 * // 注入事件存储服务
 * constructor(private readonly eventStore: MikroORMEventStore) {}
 *
 * // 追加事件
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
 * await eventStore.append(events);
 *
 * // 加载事件流
 * const events = await eventStore.load('aggregate-1', 'tenant-1');
 * ```
 */
@Injectable()
export class MikroORMEventStore implements EventStore {
  /**
   * @description 构造函数
   * @param em - MikroORM EntityManager
   * @param logger - 日志服务
   * @param config - 事件存储配置（可选）
   */
  constructor(
    private readonly em: EntityManager,
    @Optional() @Inject(Logger) private readonly logger?: LoggerService,
    @Optional()
    @Inject(EventStoreConfig)
    private readonly config?: EventStoreConfig,
  ) {}

  /**
   * @description 追加事件到存储
   * @remarks 将事件追加到存储中，支持批量追加，支持乐观锁机制检测版本冲突
   *
   * @param eventStream - 事件流，包含要追加的事件列表
   * @returns 未提交的事件列表，供后续发布
   * @throws {EventStoreException} 当事件存储失败时
   * @throws {EventStoreVersionConflictException} 当检测到版本冲突且重试失败时
   */
  async append(eventStream: StoredEvent[]): Promise<StoredEvent[]> {
    if (eventStream.length === 0) {
      return [];
    }

    // 验证事件流
    this.validateEventStream(eventStream);

    // 获取重试配置
    const retryCount = this.config?.optimisticLockRetryCount ?? 3;
    const retryDelay = this.config?.optimisticLockRetryDelay ?? 100;

    // 尝试追加事件，支持自动重试
    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        // 转换为实体
        const entities = eventStream.map((event) =>
          EventEntity.fromStoredEvent(event),
        );

        // 持久化实体
        this.em.persist(entities);

        // 刷新到数据库
        await this.em.flush();

        // 记录日志
        this.logger?.debug("事件已成功追加到存储", {
          aggregateId: eventStream[0].aggregateId,
          tenantId: eventStream[0].tenantId,
          eventCount: eventStream.length,
          attempt: attempt + 1,
        });

        // 返回未提交的事件列表
        return eventStream;
      } catch (error) {
        lastError = error as Error;

        // 检查是否是版本冲突
        if (
          error instanceof UniqueConstraintViolationException ||
          (error as Error).message.includes("uq_event_aggregate_tenant_version")
        ) {
          // 版本冲突，记录日志并重试
          this.logger?.warn("检测到事件版本冲突，准备重试", {
            aggregateId: eventStream[0].aggregateId,
            tenantId: eventStream[0].tenantId,
            eventCount: eventStream.length,
            attempt: attempt + 1,
            retryCount,
            error: (error as Error).message,
          });

          // 如果还有重试机会，等待后重试
          if (attempt < retryCount) {
            await this.sleep(retryDelay);
            continue;
          }

          // 重试次数用尽，抛出版本冲突异常
          throw new EventStoreVersionConflictException(
            undefined,
            eventStream[0].version,
            eventStream[0].aggregateId,
            eventStream[0].tenantId,
            retryCount,
            `事件版本冲突，已重试 ${retryCount} 次但仍失败`,
            "EVENT_STORE_VERSION_CONFLICT",
            error,
          );
        }

        // 其他错误，检查是否需要降级处理
        if (this.shouldDegrade(error as Error)) {
          // 降级处理：将事件写入本地队列
          await this.degradeToLocalQueue(eventStream);
          return eventStream;
        }

        // 无法处理的错误，抛出异常
        throw new EventStoreException(
          `事件存储失败: ${(error as Error).message}`,
          "EVENT_STORE_ERROR",
          {
            aggregateId: eventStream[0].aggregateId,
            tenantId: eventStream[0].tenantId,
            eventCount: eventStream.length,
            attempt: attempt + 1,
          },
          error,
        );
      }
    }

    // 如果所有重试都失败，抛出异常
    throw new EventStoreException(
      `事件存储失败，已重试 ${retryCount} 次`,
      "EVENT_STORE_ERROR",
      {
        aggregateId: eventStream[0].aggregateId,
        tenantId: eventStream[0].tenantId,
        eventCount: eventStream.length,
        retryCount,
      },
      lastError,
    );
  }

  /**
   * @description 加载聚合的所有事件
   * @remarks 从存储中加载指定聚合的所有事件，按版本顺序返回
   *
   * @param aggregateId - 聚合标识
   * @param tenantId - 租户标识
   * @returns 事件列表，按版本顺序返回
   * @throws {EventStoreException} 当事件加载失败时
   */
  async load(aggregateId: string, tenantId: string): Promise<StoredEvent[]> {
    try {
      // 获取仓储
      const repository = this.em.getRepository(EventEntity);

      // 查询事件，确保租户隔离
      const events = await repository.find(
        {
          aggregateId,
          tenantId, // 确保租户隔离
        },
        {
          orderBy: { version: QueryOrder.ASC }, // 按版本顺序返回
        },
      );

      // 转换为 StoredEvent 接口
      return events.map((event: EventEntity) => event.toStoredEvent());
    } catch (error) {
      // 检查是否需要降级处理
      if (this.shouldDegrade(error as Error)) {
        // 降级处理：从本地队列加载事件
        return this.loadFromLocalQueue(aggregateId, tenantId);
      }

      // 无法处理的错误，抛出异常
      throw new EventStoreException(
        `事件加载失败: ${(error as Error).message}`,
        "EVENT_STORE_ERROR",
        {
          aggregateId,
          tenantId,
        },
        error,
      );
    }
  }

  /**
   * @description 从指定版本开始加载事件流
   * @remarks 从存储中加载指定版本开始的所有事件，支持异步迭代器模式
   *
   * @param aggregateId - 聚合标识
   * @param tenantId - 租户标识
   * @param fromVersion - 起始版本号，从该版本开始加载事件
   * @returns 事件流（异步迭代器），按版本顺序返回事件
   * @throws {EventStoreException} 当事件加载失败时
   */
  async *loadSince(
    aggregateId: string,
    tenantId: string,
    fromVersion: number,
  ): AsyncIterable<StoredEvent> {
    try {
      // 获取仓储
      const repository = this.em.getRepository(EventEntity);

      // 查询事件，确保租户隔离
      const events = await repository.find(
        {
          aggregateId,
          tenantId, // 确保租户隔离
          version: { $gte: fromVersion }, // 从指定版本开始
        },
        {
          orderBy: { version: QueryOrder.ASC }, // 按版本顺序返回
        },
      );

      // 按版本顺序返回事件
      for (const event of events) {
        yield event.toStoredEvent();
      }
    } catch (error) {
      // 检查是否需要降级处理
      if (this.shouldDegrade(error as Error)) {
        // 降级处理：从本地队列加载事件
        const events = await this.loadFromLocalQueue(aggregateId, tenantId);
        for (const event of events) {
          if (event.version >= fromVersion) {
            yield event;
          }
        }
        return;
      }

      // 无法处理的错误，抛出异常
      throw new EventStoreException(
        `事件加载失败: ${(error as Error).message}`,
        "EVENT_STORE_ERROR",
        {
          aggregateId,
          tenantId,
          fromVersion,
        },
        error,
      );
    }
  }

  /**
   * @description 验证事件流
   * @remarks 验证事件流的完整性和一致性
   *
   * @param eventStream - 事件流
   * @throws {EventStoreException} 当事件流验证失败时
   */
  private validateEventStream(eventStream: StoredEvent[]): void {
    if (eventStream.length === 0) {
      return;
    }

    // 验证所有事件属于同一个聚合和租户
    const aggregateId = eventStream[0].aggregateId;
    const tenantId = eventStream[0].tenantId;

    for (const event of eventStream) {
      if (event.aggregateId !== aggregateId) {
        throw new EventStoreException(
          "事件流中的所有事件必须属于同一个聚合",
          "EVENT_STREAM_VALIDATION_ERROR",
          {
            aggregateId,
            eventAggregateId: event.aggregateId,
          },
        );
      }

      if (event.tenantId !== tenantId) {
        throw new EventStoreException(
          "事件流中的所有事件必须属于同一个租户",
          "EVENT_STREAM_VALIDATION_ERROR",
          {
            tenantId,
            eventTenantId: event.tenantId,
          },
        );
      }

      // 验证版本号
      if (event.version < 1) {
        throw new EventStoreException(
          "事件版本号必须 >= 1",
          "EVENT_STREAM_VALIDATION_ERROR",
          {
            eventId: event.eventId,
            version: event.version,
          },
        );
      }
    }

    // 验证版本连续性
    for (let i = 1; i < eventStream.length; i++) {
      const prevVersion = eventStream[i - 1].version;
      const currVersion = eventStream[i].version;

      if (currVersion !== prevVersion + 1) {
        throw new EventStoreException(
          "事件版本号必须连续，不允许跳过版本号",
          "EVENT_STREAM_VALIDATION_ERROR",
          {
            prevVersion,
            currVersion,
            eventId: eventStream[i].eventId,
          },
        );
      }
    }
  }

  /**
   * @description 判断是否需要降级处理
   * @remarks 判断错误是否需要降级处理
   *
   * @param _error - 错误对象
   * @returns 是否需要降级处理
   */
  private shouldDegrade(_error: Error): boolean {
    // TODO: 实现降级判断逻辑
    // 例如：数据库连接失败、超时等
    return false;
  }

  /**
   * @description 降级处理：将事件写入本地队列
   * @remarks 当事件存储服务不可用时，将事件写入本地队列
   *
   * @param eventStream - 事件流
   * @returns Promise<void>
   */
  private async degradeToLocalQueue(eventStream: StoredEvent[]): Promise<void> {
    // TODO: 实现本地队列写入逻辑
    // 例如：写入文件、内存队列等
    this.logger?.warn("事件存储服务不可用，已将事件写入本地队列", {
      aggregateId: eventStream[0].aggregateId,
      tenantId: eventStream[0].tenantId,
      eventCount: eventStream.length,
    });
  }

  /**
   * @description 从本地队列加载事件
   * @remarks 当事件存储服务不可用时，从本地队列加载事件
   *
   * @param aggregateId - 聚合标识
   * @param tenantId - 租户标识
   * @returns 事件列表
   */
  private async loadFromLocalQueue(
    aggregateId: string,
    tenantId: string,
  ): Promise<StoredEvent[]> {
    // TODO: 实现本地队列读取逻辑
    // 例如：从文件、内存队列等读取
    this.logger?.warn("事件存储服务不可用，已从本地队列加载事件", {
      aggregateId,
      tenantId,
    });
    return [];
  }

  /**
   * @description 睡眠函数
   * @remarks 用于重试延迟
   *
   * @param ms - 延迟时间（毫秒）
   * @returns Promise<void>
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

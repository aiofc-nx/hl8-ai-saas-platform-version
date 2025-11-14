/**
 * @fileoverview 内存事件存储（测试替身）
 * @description 实现内存事件存储，供单元测试使用
 *
 * ## 业务规则
 *
 * ### 测试替身规则
 * - 使用内存存储事件，不持久化到数据库
 * - 支持所有 EventStore 接口方法
 * - 支持多租户隔离
 * - 支持事件版本冲突检测
 *
 * ### 内存存储规则
 * - 事件存储在内存 Map 中
 * - 事件按聚合标识和租户标识组织
 * - 事件按版本顺序存储
 * - 支持事件查询和重放
 */

import type { EventStore, StoredEvent } from "./event-store.interface.js";
import { EventStoreException } from "../exceptions/infrastructure-exception.js";

/**
 * @description 内存事件存储（测试替身）
 * @remarks 实现内存事件存储，供单元测试使用
 *
 * @example
 * ```typescript
 * // 创建内存事件存储
 * const eventStore = new InMemoryEventStore();
 *
 * // 追加事件
 * await eventStore.append(events);
 *
 * // 加载事件流
 * const events = await eventStore.load('aggregate-1', 'tenant-1');
 * ```
 */
export class InMemoryEventStore implements EventStore {
  /**
   * @description 事件存储
   * @remarks 使用 Map 存储事件，键为 aggregateId:tenantId，值为事件列表
   */
  private readonly events = new Map<string, StoredEvent[]>();

  /**
   * @description 追加事件到存储
   * @remarks 将事件追加到内存存储中，支持批量追加
   *
   * @param eventStream - 事件流，包含要追加的事件列表
   * @returns 未提交的事件列表，供后续发布
   * @throws {EventStoreException} 当事件存储失败时
   */
  async append(eventStream: StoredEvent[]): Promise<StoredEvent[]> {
    if (eventStream.length === 0) {
      return [];
    }

    // 验证事件流
    this.validateEventStream(eventStream);

    // 获取聚合标识和租户标识
    const aggregateId = eventStream[0].aggregateId;
    const tenantId = eventStream[0].tenantId;
    const key = `${aggregateId}:${tenantId}`;

    // 获取现有事件列表
    const existingEvents = this.events.get(key) ?? [];

    // 检查版本冲突
    if (existingEvents.length > 0) {
      const lastVersion = existingEvents[existingEvents.length - 1].version;
      const firstNewVersion = eventStream[0].version;

      if (firstNewVersion !== lastVersion + 1) {
        throw new EventStoreException(
          `事件版本冲突：期望版本 ${lastVersion + 1}，实际版本 ${firstNewVersion}`,
          "EVENT_STORE_VERSION_CONFLICT",
          {
            aggregateId,
            tenantId,
            expectedVersion: lastVersion + 1,
            actualVersion: firstNewVersion,
          },
        );
      }
    }

    // 追加事件
    this.events.set(key, [...existingEvents, ...eventStream]);

    // 返回未提交的事件列表
    return eventStream;
  }

  /**
   * @description 加载聚合的所有事件
   * @remarks 从内存存储中加载指定聚合的所有事件，按版本顺序返回
   *
   * @param aggregateId - 聚合标识
   * @param tenantId - 租户标识
   * @returns 事件列表，按版本顺序返回
   * @throws {EventStoreException} 当事件加载失败时
   */
  async load(aggregateId: string, tenantId: string): Promise<StoredEvent[]> {
    const key = `${aggregateId}:${tenantId}`;
    const events = this.events.get(key) ?? [];

    // 按版本顺序返回事件
    return events.sort((a, b) => a.version - b.version);
  }

  /**
   * @description 从指定版本开始加载事件流
   * @remarks 从内存存储中加载指定版本开始的所有事件，支持异步迭代器模式
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
    const key = `${aggregateId}:${tenantId}`;
    const events = this.events.get(key) ?? [];

    // 过滤并排序事件
    const filteredEvents = events
      .filter((event) => event.version >= fromVersion)
      .sort((a, b) => a.version - b.version);

    // 按版本顺序返回事件
    for (const event of filteredEvents) {
      yield event;
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
   * @description 清空事件存储
   * @remarks 清空所有事件，用于测试
   */
  clear(): void {
    this.events.clear();
  }

  /**
   * @description 获取事件数量
   * @remarks 获取指定聚合和租户的事件数量
   *
   * @param aggregateId - 聚合标识
   * @param tenantId - 租户标识
   * @returns 事件数量
   */
  getEventCount(aggregateId: string, tenantId: string): number {
    const key = `${aggregateId}:${tenantId}`;
    return this.events.get(key)?.length ?? 0;
  }
}

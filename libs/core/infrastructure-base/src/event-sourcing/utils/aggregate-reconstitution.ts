/**
 * @fileoverview 聚合重建工具
 * @description 实现从事件流重建聚合状态，按正确的顺序重放事件
 *
 * ## 业务规则
 *
 * ### 聚合重建规则
 * - 必须从事件流重建聚合状态
 * - 必须按正确的顺序重放事件
 * - 必须支持从快照开始重建
 * - 必须支持从指定版本开始重建
 *
 * ### 事件重放规则
 * - 事件必须按版本顺序重放
 * - 事件重放必须支持异步迭代器模式
 * - 事件重放必须支持错误处理
 *
 * ### 快照使用规则
 * - 如果存在快照，从快照版本开始重放事件
 * - 如果不存在快照，从版本 1 开始重放事件
 * - 快照用于减少事件重放次数
 */

import type { EventStore } from "../event-store.interface.js";
import type { StoredEvent } from "../event-store.interface.js";
import type { SnapshotService } from "../snapshots/snapshot.service.js";

/**
 * @description 聚合重建选项
 * @remarks 定义聚合重建的选项
 */
export interface AggregateReconstitutionOptions {
  /**
   * @description 是否使用快照
   * @remarks 如果为 true，则从快照开始重建；如果为 false，则从版本 1 开始重建
   */
  useSnapshot?: boolean;

  /**
   * @description 起始版本号
   * @remarks 从该版本开始重建，如果指定了快照，则从快照版本开始重建
   */
  fromVersion?: number;
}

/**
 * @description 聚合重建结果
 * @remarks 表示聚合重建的结果
 */
export interface AggregateReconstitutionResult<T = unknown> {
  /**
   * @description 聚合状态
   * @remarks 重建后的聚合状态
   */
  readonly state: T;

  /**
   * @description 最后处理的版本号
   * @remarks 最后处理的事件的版本号
   */
  readonly lastVersion: number;

  /**
   * @description 处理的事件数量
   * @remarks 重放的事件数量
   */
  readonly eventCount: number;
}

/**
 * @description 事件处理器
 * @remarks 处理单个事件的函数
 *
 * @template T - 聚合状态类型
 * @param state - 当前聚合状态
 * @param event - 要处理的事件
 * @returns 更新后的聚合状态
 */
export type EventHandler<T = unknown> = (
  state: T,
  event: StoredEvent,
) => T | Promise<T>;

/**
 * @description 聚合重建工具
 * @remarks 实现从事件流重建聚合状态，按正确的顺序重放事件
 *
 * @example
 * ```typescript
 * // 定义事件处理器
 * const eventHandler: EventHandler<UserState> = (state, event) => {
 *   switch (event.payload.type) {
 *     case 'UserCreated':
 *       return { ...state, name: event.payload.name };
 *     case 'UserUpdated':
 *       return { ...state, ...event.payload };
 *     default:
 *       return state;
 *   }
 * };
 *
 * // 重建聚合状态
 * const result = await AggregateReconstitution.reconstitute(
 *   eventStore,
 *   snapshotService,
 *   'aggregate-1',
 *   'tenant-1',
 *   eventHandler,
 *   { useSnapshot: true },
 * );
 * ```
 */
export class AggregateReconstitution {
  /**
   * @description 重建聚合状态
   * @remarks 从事件流重建聚合状态，按正确的顺序重放事件
   *
   * @template T - 聚合状态类型
   * @param eventStore - 事件存储
   * @param snapshotService - 快照服务
   * @param aggregateId - 聚合标识
   * @param tenantId - 租户标识
   * @param eventHandler - 事件处理器
   * @param initialState - 初始状态
   * @param options - 重建选项
   * @returns 聚合重建结果
   * @throws {Error} 当聚合重建失败时
   */
  static async reconstitute<T = unknown>(
    eventStore: EventStore,
    snapshotService: SnapshotService,
    aggregateId: string,
    tenantId: string,
    eventHandler: EventHandler<T>,
    initialState: T,
    options: AggregateReconstitutionOptions = {},
  ): Promise<AggregateReconstitutionResult<T>> {
    const { useSnapshot = true, fromVersion } = options;

    // 如果使用快照，尝试加载快照
    let state: T = initialState;
    let startVersion = fromVersion ?? 1;

    if (useSnapshot) {
      const snapshot = await snapshotService.loadSnapshot(
        aggregateId,
        tenantId,
        fromVersion,
      );

      if (snapshot) {
        // 从快照开始重建
        state = snapshot.payload as T;
        startVersion = snapshot.version + 1;
      }
    }

    // 从起始版本开始加载事件流
    const events: StoredEvent[] = [];
    for await (const event of eventStore.loadSince(
      aggregateId,
      tenantId,
      startVersion,
    )) {
      events.push(event);
    }

    // 按版本顺序重放事件
    let lastVersion = startVersion - 1;
    for (const event of events) {
      // 处理事件
      state = await eventHandler(state, event);
      lastVersion = event.version;
    }

    // 返回重建结果
    return {
      state,
      lastVersion,
      eventCount: events.length,
    };
  }

  /**
   * @description 从事件列表重建聚合状态
   * @remarks 从事件列表重建聚合状态，按正确的顺序重放事件
   *
   * @template T - 聚合状态类型
   * @param events - 事件列表
   * @param eventHandler - 事件处理器
   * @param initialState - 初始状态
   * @returns 聚合重建结果
   * @throws {Error} 当聚合重建失败时
   */
  static async reconstituteFromEvents<T = unknown>(
    events: StoredEvent[],
    eventHandler: EventHandler<T>,
    initialState: T,
  ): Promise<AggregateReconstitutionResult<T>> {
    // 按版本顺序排序事件
    const sortedEvents = [...events].sort((a, b) => a.version - b.version);

    // 重放事件
    let state: T = initialState;
    let lastVersion = 0;

    for (const event of sortedEvents) {
      // 处理事件
      state = await eventHandler(state, event);
      lastVersion = event.version;
    }

    // 返回重建结果
    return {
      state,
      lastVersion,
      eventCount: sortedEvents.length,
    };
  }
}

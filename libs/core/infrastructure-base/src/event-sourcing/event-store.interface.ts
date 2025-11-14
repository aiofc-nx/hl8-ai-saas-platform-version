/**
 * @fileoverview 事件存储接口
 * @description 定义事件存储的接口规范，支持事件持久化存储、检索和重放
 *
 * ## 业务规则
 *
 * ### 事件存储规则
 * - 事件必须按版本顺序存储
 * - 事件必须包含租户标识，确保多租户隔离
 * - 事件版本必须连续，不允许跳过版本号
 * - 事件存储必须支持乐观锁机制检测版本冲突
 *
 * ### 事件检索规则
 * - 必须支持按聚合标识和租户标识检索事件流
 * - 必须支持从指定版本开始加载事件流
 * - 必须确保租户隔离，防止跨租户数据访问
 * - 必须按版本顺序返回事件
 *
 * ### 事件重放规则
 * - 必须支持从指定版本开始重放事件
 * - 必须按正确的顺序重放事件
 * - 必须支持异步迭代器模式，支持流式处理
 */

/**
 * @description 存储的事件
 * @remarks 表示已存储的事件数据，包含完整的事件信息和元数据
 */
export interface StoredEvent {
  /**
   * @description 事件唯一标识
   * @remarks 使用 UUID 保证全局唯一
   */
  readonly eventId: string;

  /**
   * @description 聚合标识
   * @remarks 标识事件所属的聚合根
   */
  readonly aggregateId: string;

  /**
   * @description 租户标识
   * @remarks 标识事件所属的租户，确保多租户隔离
   */
  readonly tenantId: string;

  /**
   * @description 事件版本号
   * @remarks 事件在聚合中的版本号，必须 >= 1，且连续递增
   */
  readonly version: number;

  /**
   * @description 事件内容
   * @remarks 事件的业务数据，可以是任意类型
   */
  readonly payload: unknown;

  /**
   * @description 事件发生时间
   * @remarks 事件发生的时间戳
   */
  readonly occurredAt: Date;

  /**
   * @description 事件元数据
   * @remarks 事件的附加信息，如用户 ID、请求 ID 等
   */
  readonly metadata: Record<string, unknown>;
}

/**
 * @description 事件存储接口
 * @remarks 定义事件存储的核心操作，包括事件追加、检索和重放
 *
 * @example
 * ```typescript
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
 *
 * // 从指定版本开始加载事件流
 * for await (const event of eventStore.loadSince(1, 'tenant-1')) {
 *   console.log(event);
 * }
 * ```
 */
export interface EventStore {
  /**
   * @description 追加事件到存储
   * @remarks 将事件追加到存储中，支持批量追加
   *
   * ## 业务规则
   * - 事件版本必须连续，不允许跳过版本号
   * - 事件版本必须大于当前最大版本号
   * - 必须支持乐观锁机制检测版本冲突
   * - 版本冲突时自动重试指定次数
   * - 必须确保租户隔离，防止跨租户数据访问
   *
   * @param eventStream - 事件流，包含要追加的事件列表
   * @returns 未提交的事件列表，供后续发布
   * @throws {EventStoreException} 当事件存储失败时
   * @throws {EventStoreVersionConflictException} 当检测到版本冲突且重试失败时
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
   * const uncommittedEvents = await eventStore.append(events);
   * ```
   */
  append(eventStream: StoredEvent[]): Promise<StoredEvent[]>;

  /**
   * @description 加载聚合的所有事件
   * @remarks 从存储中加载指定聚合的所有事件，按版本顺序返回
   *
   * ## 业务规则
   * - 必须按版本顺序返回事件
   * - 必须确保租户隔离，只返回指定租户的事件
   * - 必须支持多租户隔离，防止跨租户数据访问
   * - 如果聚合不存在，返回空数组
   *
   * @param aggregateId - 聚合标识
   * @param tenantId - 租户标识
   * @returns 事件列表，按版本顺序返回
   * @throws {EventStoreException} 当事件加载失败时
   *
   * @example
   * ```typescript
   * const events = await eventStore.load('aggregate-1', 'tenant-1');
   * events.forEach(event => {
   *   console.log(`Event ${event.version}: ${event.payload}`);
   * });
   * ```
   */
  load(aggregateId: string, tenantId: string): Promise<StoredEvent[]>;

  /**
   * @description 从指定版本开始加载事件流
   * @remarks 从存储中加载指定版本开始的所有事件，支持异步迭代器模式
   *
   * ## 业务规则
   * - 必须按版本顺序返回事件
   * - 必须确保租户隔离，只返回指定租户的事件
   * - 必须支持流式处理，使用异步迭代器模式
   * - 如果指定版本不存在，从下一个可用版本开始返回
   *
   * @param aggregateId - 聚合标识
   * @param tenantId - 租户标识
   * @param fromVersion - 起始版本号，从该版本开始加载事件
   * @returns 事件流（异步迭代器），按版本顺序返回事件
   * @throws {EventStoreException} 当事件加载失败时
   *
   * @example
   * ```typescript
   * for await (const event of eventStore.loadSince('aggregate-1', 'tenant-1', 1)) {
   *   console.log(`Event ${event.version}: ${event.payload}`);
   * }
   * ```
   */
  loadSince(
    aggregateId: string,
    tenantId: string,
    fromVersion: number,
  ): AsyncIterable<StoredEvent>;
}

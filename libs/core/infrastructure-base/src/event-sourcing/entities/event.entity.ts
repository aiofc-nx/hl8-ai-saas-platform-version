/**
 * @fileoverview 事件实体
 * @description 定义事件存储的数据库实体，使用 MikroORM 装饰器
 *
 * ## 业务规则
 *
 * ### 事件存储规则
 * - 事件必须按版本顺序存储
 * - 事件必须包含租户标识，确保多租户隔离
 * - 事件版本必须连续，不允许跳过版本号
 * - 事件存储必须支持乐观锁机制检测版本冲突
 *
 * ### 数据完整性规则
 * - eventId 必须唯一
 * - version 必须 >= 1
 * - aggregateId 和 tenantId 组合必须唯一
 * - occurredAt 必须 <= 当前时间
 *
 * ### 索引规则
 * - 主键：eventId
 * - 唯一索引：(aggregateId, tenantId, version)
 * - 索引：tenantId、aggregateId、version、occurredAt
 */

import { Entity, Index, PrimaryKey, Property, Unique } from "@mikro-orm/core";
import { randomUUID } from "node:crypto";
import type { StoredEvent } from "../event-store.interface.js";

/**
 * @description 事件实体
 * @remarks 表示业务操作产生的领域事件，包含事件标识、聚合标识、租户标识、版本号、事件内容、发生时间和元数据
 *
 * @example
 * ```typescript
 * const event = new EventEntity();
 * event.eventId = randomUUID();
 * event.aggregateId = 'aggregate-1';
 * event.tenantId = 'tenant-1';
 * event.version = 1;
 * event.payload = { type: 'UserCreated', name: 'John' };
 * event.occurredAt = new Date();
 * event.metadata = { userId: 'user-1' };
 * ```
 */
@Entity({ tableName: "events" })
@Unique({
  name: "uq_event_aggregate_tenant_version",
  properties: ["aggregateId", "tenantId", "version"],
})
@Index({ name: "idx_event_tenant_id", properties: ["tenantId"] })
@Index({ name: "idx_event_aggregate_id", properties: ["aggregateId"] })
@Index({ name: "idx_event_version", properties: ["version"] })
@Index({ name: "idx_event_occurred_at", properties: ["occurredAt"] })
@Index({
  name: "idx_event_aggregate_tenant",
  properties: ["aggregateId", "tenantId"],
})
export class EventEntity {
  /**
   * @description 事件唯一标识
   * @remarks 使用 UUID 保证全局唯一，作为主键
   */
  @PrimaryKey({ columnType: "uuid" })
  public readonly eventId: string = randomUUID();

  /**
   * @description 聚合标识
   * @remarks 标识事件所属的聚合根，用于检索事件流
   */
  @Property({ columnType: "uuid", index: true })
  public aggregateId!: string;

  /**
   * @description 租户标识
   * @remarks 标识事件所属的租户，确保多租户隔离
   */
  @Property({ columnType: "uuid", index: true })
  public tenantId!: string;

  /**
   * @description 事件版本号
   * @remarks 事件在聚合中的版本号，必须 >= 1，且连续递增
   */
  @Property({ columnType: "integer", index: true })
  public version!: number;

  /**
   * @description 事件内容
   * @remarks 事件的业务数据，使用 JSON 类型存储
   */
  @Property({ columnType: "jsonb" })
  public payload!: unknown;

  /**
   * @description 事件发生时间
   * @remarks 事件发生的时间戳，使用 timestamptz 类型
   */
  @Property({
    columnType: "timestamptz",
    index: true,
    defaultRaw: "now()",
  })
  public occurredAt: Date = new Date();

  /**
   * @description 事件元数据
   * @remarks 事件的附加信息，如用户 ID、请求 ID 等，使用 JSON 类型存储
   */
  @Property({ columnType: "jsonb", nullable: true })
  public metadata?: Record<string, unknown>;

  /**
   * @description 转换为 StoredEvent 接口
   * @remarks 将实体转换为接口类型，供业务层使用
   * @returns StoredEvent 接口实例
   */
  toStoredEvent(): StoredEvent {
    return {
      eventId: this.eventId,
      aggregateId: this.aggregateId,
      tenantId: this.tenantId,
      version: this.version,
      payload: this.payload,
      occurredAt: this.occurredAt,
      metadata: this.metadata ?? {},
    };
  }

  /**
   * @description 从 StoredEvent 接口创建实体
   * @remarks 从接口类型创建实体，供存储层使用
   * @param storedEvent - StoredEvent 接口实例
   * @returns EventEntity 实体实例
   */
  static fromStoredEvent(storedEvent: StoredEvent): EventEntity {
    const entity = new EventEntity();
    // 如果 eventId 已存在，使用现有的 eventId
    if (storedEvent.eventId) {
      (entity as { eventId: string }).eventId = storedEvent.eventId;
    }
    entity.aggregateId = storedEvent.aggregateId;
    entity.tenantId = storedEvent.tenantId;
    entity.version = storedEvent.version;
    entity.payload = storedEvent.payload;
    entity.occurredAt = storedEvent.occurredAt;
    entity.metadata = storedEvent.metadata;
    return entity;
  }
}

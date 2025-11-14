/**
 * @fileoverview 事件快照实体
 * @description 定义事件快照的数据库实体，使用 MikroORM 装饰器
 *
 * ## 业务规则
 *
 * ### 快照存储规则
 * - 快照必须包含聚合在某个版本的状态
 * - 快照必须包含租户标识，确保多租户隔离
 * - 快照版本必须 >= 1
 * - 快照用于减少聚合重建时的事件重放次数
 *
 * ### 数据完整性规则
 * - snapshotId 必须唯一
 * - version 必须 >= 1
 * - aggregateId 和 tenantId 组合必须唯一
 *
 * ### 索引规则
 * - 主键：snapshotId
 * - 唯一索引：(aggregateId, tenantId, version)
 * - 索引：tenantId、aggregateId、version
 */

import { Entity, Index, PrimaryKey, Property, Unique } from "@mikro-orm/core";
import { randomUUID } from "node:crypto";

/**
 * @description 事件快照实体
 * @remarks 表示聚合在某个版本的状态快照，用于减少事件重放次数
 *
 * @example
 * ```typescript
 * const snapshot = new EventSnapshotEntity();
 * snapshot.snapshotId = randomUUID();
 * snapshot.aggregateId = 'aggregate-1';
 * snapshot.tenantId = 'tenant-1';
 * snapshot.version = 10;
 * snapshot.payload = { state: { name: 'John', age: 30 } };
 * snapshot.createdAt = new Date();
 * ```
 */
@Entity({ tableName: "event_snapshots" })
@Unique({
  name: "uq_snapshot_aggregate_tenant_version",
  properties: ["aggregateId", "tenantId", "version"],
})
@Index({ name: "idx_snapshot_tenant_id", properties: ["tenantId"] })
@Index({ name: "idx_snapshot_aggregate_id", properties: ["aggregateId"] })
@Index({ name: "idx_snapshot_version", properties: ["version"] })
@Index({
  name: "idx_snapshot_aggregate_tenant",
  properties: ["aggregateId", "tenantId"],
})
export class EventSnapshotEntity {
  /**
   * @description 快照唯一标识
   * @remarks 使用 UUID 保证全局唯一，作为主键
   */
  @PrimaryKey({ columnType: "uuid" })
  public readonly snapshotId: string = randomUUID();

  /**
   * @description 聚合标识
   * @remarks 标识快照所属的聚合根
   */
  @Property({ columnType: "uuid", index: true })
  public aggregateId!: string;

  /**
   * @description 租户标识
   * @remarks 标识快照所属的租户，确保多租户隔离
   */
  @Property({ columnType: "uuid", index: true })
  public tenantId!: string;

  /**
   * @description 快照版本号
   * @remarks 快照对应的聚合版本号，必须 >= 1
   */
  @Property({ columnType: "integer", index: true })
  public version!: number;

  /**
   * @description 快照内容
   * @remarks 聚合在某个版本的状态，使用 JSON 类型存储
   */
  @Property({ columnType: "jsonb" })
  public payload!: unknown;

  /**
   * @description 快照创建时间
   * @remarks 快照创建的时间戳，使用 timestamptz 类型
   */
  @Property({
    columnType: "timestamptz",
    defaultRaw: "now()",
  })
  public createdAt: Date = new Date();
}

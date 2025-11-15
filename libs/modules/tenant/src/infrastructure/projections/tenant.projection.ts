/**
 * @fileoverview 租户读模型投影实体
 * @description 租户聚合的读模型，用于支持复杂查询和关联查询
 *
 * ## 业务规则
 *
 * ### 读模型更新规则
 * - 读模型通过事件处理器更新
 * - 读模型与写模型（事件流）最终一致
 * - 读模型支持软删除过滤
 *
 * ### 索引规则
 * - 主键索引：tenantId
 * - 唯一索引：tenantName（用于唯一性校验）
 * - 状态索引：status（用于状态过滤）
 * - 创建时间索引：createdAt（用于排序）
 *
 * ## 使用示例
 *
 * ```typescript
 * const projection = await em.findOne(TenantProjection, { tenantId });
 * ```
 */

import { Entity, Index, PrimaryKey, Property, Unique } from "@mikro-orm/core";

/**
 * 租户读模型投影实体
 *
 * @description 存储租户的读模型，用于快速查询
 */
@Entity({ tableName: "tenant_projections" })
@Unique({ name: "uq_tenant_projection_name", properties: ["tenantName"] })
@Index({ name: "idx_tenant_projection_status", properties: ["status"] })
@Index({ name: "idx_tenant_projection_created_at", properties: ["createdAt"] })
@Index({ name: "idx_tenant_projection_is_deleted", properties: ["isDeleted"] })
export class TenantProjection {
  /**
   * 租户ID（主键）
   */
  @PrimaryKey({ columnType: "uuid" })
  public tenantId!: string;

  /**
   * 租户名称（唯一）
   */
  @Property({ columnType: "varchar", length: 100 })
  public tenantName!: string;

  /**
   * 租户状态
   */
  @Property({ columnType: "varchar", length: 20 })
  public status!: string;

  /**
   * 负责人姓名
   */
  @Property({ columnType: "varchar", length: 100, nullable: true })
  public contactName?: string | null;

  /**
   * 邮箱
   */
  @Property({ columnType: "varchar", length: 255 })
  public email!: string;

  /**
   * 电话
   */
  @Property({ columnType: "varchar", length: 50, nullable: true })
  public phone?: string | null;

  /**
   * 默认组织ID
   */
  @Property({ columnType: "uuid" })
  public defaultOrganizationId!: string;

  /**
   * 默认时区
   */
  @Property({ columnType: "varchar", length: 50 })
  public defaultTimezone!: string;

  /**
   * 货币
   */
  @Property({ columnType: "varchar", length: 3, nullable: true })
  public currency?: string | null;

  /**
   * 法定名称
   */
  @Property({ columnType: "varchar", length: 200, nullable: true })
  public legalName?: string | null;

  /**
   * 注册代码
   */
  @Property({ columnType: "varchar", length: 100, nullable: true })
  public registrationCode?: string | null;

  /**
   * 行业分类
   */
  @Property({ columnType: "varchar", length: 100, nullable: true })
  public industry?: string | null;

  /**
   * 创建时间
   */
  @Property({
    columnType: "timestamptz",
    defaultRaw: "now()",
  })
  public createdAt: Date = new Date();

  /**
   * 更新时间
   */
  @Property({
    columnType: "timestamptz",
    defaultRaw: "now()",
    onUpdate: () => new Date(),
  })
  public updatedAt: Date = new Date();

  /**
   * 是否已删除（软删除标记）
   */
  @Property({ columnType: "boolean", default: false })
  public isDeleted: boolean = false;
}

import { randomUUID } from "node:crypto";
import { Entity, PrimaryKey, Property } from "@mikro-orm/core";

/**
 * @description 租户实体模型，承载多租户维度的基础信息
 * @remarks
 * - 仅作为示例实体，后续可扩展额外业务字段
 * - 支持 MikroORM 自动迁移与仓储注入
 */
@Entity({ tableName: "tenants" })
export class TenantEntity {
  /**
   * @description 租户主键，使用 UUID 保证全局唯一
   */
  @PrimaryKey({ columnType: "uuid" })
  public readonly id: string = randomUUID();

  /**
   * @description 租户名称
   */
  @Property({ columnType: "varchar(255)" })
  public name!: string;

  /**
   * @description 创建时间
   */
  @Property({ columnType: "timestamptz", defaultRaw: "now()" })
  public readonly createdAt: Date = new Date();

  /**
   * @description 最近更新时间
   */
  @Property({ columnType: "timestamptz", onUpdate: () => new Date() })
  public updatedAt: Date = new Date();
}

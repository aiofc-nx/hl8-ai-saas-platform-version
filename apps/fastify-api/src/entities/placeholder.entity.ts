import { Entity, PrimaryKey, Property } from "@mikro-orm/core";

/**
 * @description 占位实体，用于确保 MikroORM 能够正确初始化
 * @remarks 这是一个临时实体，后续应替换为实际的业务实体
 */
@Entity({ tableName: "_placeholder" })
export class PlaceholderEntity {
  /**
   * @description 主键 ID
   */
  @PrimaryKey()
  id!: number;

  /**
   * @description 创建时间
   */
  @Property()
  createdAt: Date = new Date();

  /**
   * @description 更新时间
   */
  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}

import { Injectable } from "@nestjs/common";
import { TenantAggregate } from "../../domain/iam/tenant.aggregate.js";

/**
 * @zh
 * @description 租户聚合持久化适配器，占位实现对接 MikroORM 与事件存储。
 */
@Injectable()
export class TenantRepository {
  /**
   * @zh
   * @description 依据标识查询租户聚合，占位返回 `null`。
   * @param tenantId 租户标识
   */
  public async findById(tenantId: string): Promise<TenantAggregate | null> {
    void tenantId;
    // TODO: 调用 MikroORM 实体管理器加载租户聚合
    return null;
  }

  /**
   * @zh
   * @description 保存租户聚合占位方法。
   * @param aggregate 聚合实例
   */
  public async save(aggregate: TenantAggregate): Promise<void> {
    void aggregate;
    // TODO: 持久化租户聚合并同步事件存储
  }
}


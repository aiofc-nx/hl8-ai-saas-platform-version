/**
 * @fileoverview 租户仓储接口
 * @description 定义租户聚合根的持久化契约，继承平台 Repository 接口并扩展租户特定查询方法
 *
 * ## 业务规则
 *
 * ### 基础仓储能力
 * - 继承平台 Repository 接口，提供标准的 CRUD 操作
 * - 支持多租户数据隔离
 * - 支持软删除过滤
 *
 * ### 租户特定查询
 * - `findByName`: 根据租户名称查询（用于唯一性校验）
 * - 所有查询方法自动添加租户隔离过滤
 *
 * ## 使用示例
 *
 * ```typescript
 * const repository: TenantRepository = ...;
 * const tenant = await repository.findById(tenantId);
 * const existing = await repository.findByName(tenantName);
 * ```
 */

import type { AggregateId, Repository } from "@hl8/domain-base";
import type { TenantAggregate } from "../aggregates/tenant.aggregate.js";
import { TenantName } from "../value-objects/tenant-name.vo.js";

/**
 * 租户仓储接口
 *
 * @description 定义租户聚合根的持久化契约
 */
export interface TenantRepository
  extends Repository<TenantAggregate, AggregateId> {
  /**
   * 根据租户名称查询租户
   *
   * @description 用于校验租户名称唯一性，查询时需要考虑租户隔离
   *
   * @param name - 租户名称值对象
   * @param tenantId - 租户ID（用于多租户隔离，但租户名称应在平台级别唯一）
   * @returns 如果找到返回租户聚合根，否则返回 null
   *
   * @example
   * ```typescript
   * const existing = await repository.findByName(tenantName, tenantId);
   * if (existing) {
   *   throw new Error("租户名称已存在");
   * }
   * ```
   */
  findByName(
    name: TenantName,
    tenantId: AggregateId,
  ): Promise<TenantAggregate | null>;
}

/**
 * @fileoverview 根据ID查询租户查询
 * @description 用于根据ID查询单个租户详情的查询对象
 *
 * ## 业务规则
 *
 * ### 权限要求
 * - 需要 "read" "Tenant" 权限
 * - 只有超级管理员或平台管理员可以查询租户详情
 *
 * ### 查询数据
 * - 租户ID（必填）
 *
 * ## 使用示例
 *
 * ```typescript
 * const query = new GetTenantByIdQuery(
 *   securityContext,
 *   { tenantId: "tenant-123" }
 * );
 * ```
 */

import type { AbilityDescriptor } from "@hl8/application-base";
import { CaslQueryBase } from "@hl8/application-base";
import type { SecurityContext } from "@hl8/application-base";
import { TenantReadModel } from "../../infrastructure/dto/tenant-read-model.js";

/**
 * 根据ID查询租户查询的数据
 */
export interface GetTenantByIdQueryData {
  readonly tenantId: string;
}

/**
 * 根据ID查询租户查询
 *
 * @description 用于根据ID查询单个租户详情
 */
export class GetTenantByIdQuery extends CaslQueryBase<TenantReadModel | null> {
  /**
   * 租户ID
   */
  public readonly tenantId: string;

  /**
   * 构造函数
   *
   * @param context - 安全上下文
   * @param data - 查询数据
   */
  public constructor(context: SecurityContext, data: GetTenantByIdQueryData) {
    super(context);
    this.tenantId = data.tenantId;
  }

  /**
   * 返回执行当前查询所需的权限描述
   *
   * @returns 权限描述
   */
  public abilityDescriptor(): AbilityDescriptor {
    return {
      action: "read",
      subject: "Tenant",
    };
  }

  /**
   * 返回审计所需的查询参数
   *
   * @returns 审计载荷
   */
  public auditPayload(): Record<string, unknown> {
    return {
      tenantId: this.tenantId,
    };
  }
}

/**
 * @fileoverview 获取租户上下文查询
 * @description 用于查询租户上下文信息的查询对象
 *
 * ## 业务规则
 *
 * ### 权限要求
 * - 需要 "read" "Tenant" 权限
 * - 可以跨租户查询（供 IAM 系统使用）
 *
 * ### 查询数据
 * - 租户ID（必填）
 *
 * ## 使用示例
 *
 * ```typescript
 * const query = new GetTenantContextQuery(
 *   securityContext,
 *   { tenantId: "tenant-123" }
 * );
 * ```
 */

import type { AbilityDescriptor } from "@hl8/application-base";
import { CaslQueryBase } from "@hl8/application-base";
import type { SecurityContext } from "@hl8/application-base";

/**
 * 租户上下文响应数据
 */
export interface TenantContextResponse {
  readonly tenantId: string;
  readonly tenantName: string;
  readonly defaultOrganizationId: string;
  readonly defaultTimezone: string;
  readonly currency?: string | null;
}

/**
 * 获取租户上下文查询的数据
 */
export interface GetTenantContextQueryData {
  readonly tenantId: string;
}

/**
 * 获取租户上下文查询
 *
 * @description 用于查询租户上下文信息
 */
export class GetTenantContextQuery extends CaslQueryBase<TenantContextResponse> {
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
  public constructor(
    context: SecurityContext,
    data: GetTenantContextQueryData,
  ) {
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
}

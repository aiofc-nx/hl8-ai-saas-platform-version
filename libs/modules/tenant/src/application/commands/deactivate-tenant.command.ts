/**
 * @fileoverview 停用租户命令
 * @description 用于停用租户的命令对象
 *
 * ## 业务规则
 *
 * ### 权限要求
 * - 只有超级管理员或平台管理员可以停用租户
 * - 需要 "manage" "Tenant" 权限
 *
 * ### 命令数据
 * - 租户ID（必填）
 *
 * ## 使用示例
 *
 * ```typescript
 * const command = new DeactivateTenantCommand(
 *   securityContext,
 *   { tenantId: "tenant-123" }
 * );
 * ```
 */

import type { AbilityDescriptor } from "@hl8/application-base";
import { CaslCommandBase } from "@hl8/application-base";
import type { SecurityContext } from "@hl8/application-base";

/**
 * 停用租户命令的数据
 */
export interface DeactivateTenantCommandData {
  readonly tenantId: string;
}

/**
 * 停用租户命令
 *
 * @description 用于停用租户的命令
 */
export class DeactivateTenantCommand extends CaslCommandBase<void> {
  /**
   * 租户ID
   */
  public readonly tenantId: string;

  /**
   * 构造函数
   *
   * @param context - 安全上下文
   * @param data - 停用租户的数据
   */
  public constructor(
    context: SecurityContext,
    data: DeactivateTenantCommandData,
  ) {
    super(context);
    this.tenantId = data.tenantId;
  }

  /**
   * 返回执行当前命令所需的权限描述
   *
   * @returns 权限描述
   */
  public abilityDescriptor(): AbilityDescriptor {
    return {
      action: "manage",
      subject: "Tenant",
    };
  }

  /**
   * 返回审计所需的载荷
   *
   * @returns 审计载荷
   */
  public auditPayload(): Record<string, unknown> {
    return {
      tenantId: this.tenantId,
    };
  }
}

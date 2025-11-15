/**
 * @fileoverview 更新租户档案命令
 * @description 用于更新租户档案的命令对象
 *
 * ## 业务规则
 *
 * ### 权限要求
 * - 只有超级管理员或平台管理员可以更新租户档案
 * - 需要 "manage" "Tenant" 权限
 *
 * ### 命令数据
 * - 租户ID（必填）
 * - 档案信息（可选，只更新提供的字段）
 *
 * ## 使用示例
 *
 * ```typescript
 * const command = new UpdateTenantProfileCommand(
 *   securityContext,
 *   {
 *     tenantId: "tenant-123",
 *     profile: {
 *       legalName: "ABC有限公司",
 *       industry: "IT"
 *     }
 *   }
 * );
 * ```
 */

import type { AbilityDescriptor } from "@hl8/application-base";
import { CaslCommandBase } from "@hl8/application-base";
import type { SecurityContext } from "@hl8/application-base";
import type { TenantProfile } from "../../domains/tenant/entities/tenant-profile.entity.js";

/**
 * 更新租户档案命令的数据
 */
export interface UpdateTenantProfileCommandData {
  readonly tenantId: string;
  readonly profile: Partial<{
    legalName: string;
    registrationCode: string;
    industry: string;
  }>;
}

/**
 * 更新租户档案命令
 *
 * @description 用于更新租户档案
 */
export class UpdateTenantProfileCommand extends CaslCommandBase<void> {
  /**
   * 租户ID
   */
  public readonly tenantId: string;

  /**
   * 档案信息
   */
  public readonly profile: Partial<{
    legalName: string;
    registrationCode: string;
    industry: string;
  }>;

  /**
   * 构造函数
   *
   * @param context - 安全上下文
   * @param data - 更新租户档案的数据
   */
  public constructor(
    context: SecurityContext,
    data: UpdateTenantProfileCommandData,
  ) {
    super(context);
    this.tenantId = data.tenantId;
    this.profile = data.profile;
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
      profile: this.profile,
    };
  }
}

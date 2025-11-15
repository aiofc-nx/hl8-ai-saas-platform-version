/**
 * @fileoverview 创建租户命令
 * @description 用于创建新租户的命令对象
 *
 * ## 业务规则
 *
 * ### 权限要求
 * - 只有超级管理员或平台管理员可以创建租户
 * - 需要 "manage" "Tenant" 权限
 *
 * ### 命令数据
 * - 租户名称、联系人信息、组织上下文、档案信息
 *
 * ## 使用示例
 *
 * ```typescript
 * const command = new CreateTenantCommand(
 *   securityContext,
 *   {
 *     tenantName: "ABC公司",
 *     contactInfo: { ... },
 *     context: { ... },
 *     profile: { ... }
 *   }
 * );
 * ```
 */

import type { AbilityDescriptor } from "@hl8/application-base";
import { CaslCommandBase } from "@hl8/application-base";
import type { SecurityContext } from "@hl8/application-base";
import { OrganizationId } from "@hl8/domain-base";
import { TenantContactInfo } from "../../domains/tenant/value-objects/tenant-contact-info.vo.js";
import { TenantContext } from "../../domains/tenant/value-objects/tenant-context.vo.js";
import { TenantName } from "../../domains/tenant/value-objects/tenant-name.vo.js";
import type { TenantProfile } from "../../domains/tenant/entities/tenant-profile.entity.js";

/**
 * 创建租户命令的数据
 */
export interface CreateTenantCommandData {
  readonly tenantName: string;
  readonly contactInfo: {
    readonly contactName: string;
    readonly email: string;
    readonly phone?: string | null;
  };
  readonly context: {
    readonly defaultOrganizationId: string;
    readonly defaultTimezone: string;
    readonly currency?: string | null;
  };
  readonly profile?: {
    readonly legalName?: string | null;
    readonly registrationCode?: string | null;
    readonly industry?: string | null;
  };
}

/**
 * 创建租户命令
 *
 * @description 用于创建新租户的命令
 */
export class CreateTenantCommand extends CaslCommandBase<{ tenantId: string }> {
  /**
   * 租户名称
   */
  public readonly tenantName: TenantName;

  /**
   * 联系人信息
   */
  public readonly contactInfo: TenantContactInfo;

  /**
   * 组织上下文
   */
  public readonly context: TenantContext;

  /**
   * 租户档案（可选）
   */
  public readonly profile?: TenantProfile;

  /**
   * 构造函数
   *
   * @param context - 安全上下文
   * @param data - 创建租户的数据
   */
  public constructor(context: SecurityContext, data: CreateTenantCommandData) {
    super(context);

    // 创建值对象
    this.tenantName = TenantName.create(data.tenantName);
    this.contactInfo = TenantContactInfo.create(data.contactInfo);
    this.context = TenantContext.create({
      defaultOrganizationId: OrganizationId.create(
        data.context.defaultOrganizationId,
      ),
      defaultTimezone: data.context.defaultTimezone,
      currency: data.context.currency,
    });
    this.profile = data.profile
      ? TenantProfile.create(data.profile)
      : undefined;
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
      tenantName: this.tenantName.value,
      email: this.contactInfo.email,
      defaultOrganizationId: this.context.defaultOrganizationId.toString(),
    };
  }
}

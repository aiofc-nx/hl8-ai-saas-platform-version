/**
 * @fileoverview 租户创建事件
 * @description 当租户创建成功时触发，包含租户的完整信息
 *
 * ## 业务规则
 *
 * ### 触发时机
 * - 租户聚合根创建成功时
 * - 租户状态为"已初始化"
 *
 * ### 事件载荷
 * - 租户ID、名称、状态
 * - 联系人信息、组织上下文
 * - 审计元数据和软删除状态
 *
 * ## 使用示例
 *
 * ```typescript
 * const event = new TenantCreatedEvent({
 *   ...baseProps,
 *   tenantName: tenantName.value,
 *   status: status,
 *   contactInfo: contactInfo,
 *   context: context
 * });
 * ```
 */

import { DomainEventBase, type DomainEventProps } from "@hl8/domain-base";
import { TenantContactInfo } from "../value-objects/tenant-contact-info.vo.js";
import { TenantContext } from "../value-objects/tenant-context.vo.js";
import { TenantStatus } from "../value-objects/tenant-status.vo.js";
import type { TenantProfile } from "../entities/tenant-profile.entity.js";

/**
 * 租户创建事件的扩展载荷
 */
export interface TenantCreatedEventPayload {
  readonly tenantName: string;
  readonly status: TenantStatus;
  readonly contactInfo: TenantContactInfo;
  readonly context: TenantContext;
  readonly profile?: TenantProfile;
}

/**
 * 租户创建事件
 *
 * @description 当租户创建成功时触发
 */
export class TenantCreatedEvent extends DomainEventBase {
  private readonly payload: TenantCreatedEventPayload;

  /**
   * 创建租户创建事件
   *
   * @param props - 领域事件基础属性
   * @param payload - 租户创建事件载荷
   */
  public constructor(
    props: DomainEventProps,
    payload: TenantCreatedEventPayload,
  ) {
    super(props);
    this.payload = payload;
  }

  /**
   * 获取事件名称
   *
   * @returns 事件名称
   */
  public eventName(): string {
    return "TenantCreatedEvent";
  }

  /**
   * 获取租户名称
   *
   * @returns 租户名称
   */
  public get tenantName(): string {
    return this.payload.tenantName;
  }

  /**
   * 获取租户状态
   *
   * @returns 租户状态
   */
  public get status(): TenantStatus {
    return this.payload.status;
  }

  /**
   * 获取联系人信息
   *
   * @returns 联系人信息
   */
  public get contactInfo(): TenantContactInfo {
    return this.payload.contactInfo;
  }

  /**
   * 获取组织上下文
   *
   * @returns 组织上下文
   */
  public get context(): TenantContext {
    return this.payload.context;
  }

  /**
   * 获取租户档案
   *
   * @returns 租户档案（可选）
   */
  public get profile(): TenantProfile | undefined {
    return this.payload.profile;
  }
}

/**
 * @fileoverview 租户档案更新事件
 * @description 当租户档案信息被更新时触发
 *
 * ## 业务规则
 *
 * ### 触发时机
 * - 租户档案信息（法定名称、注册代码、行业分类）被更新时
 *
 * ### 事件载荷
 * - 租户ID
 * - 更新后的租户档案
 * - 审计元数据
 *
 * ## 使用示例
 *
 * ```typescript
 * const event = new TenantProfileUpdatedEvent({
 *   ...baseProps,
 *   profile: updatedProfile
 * });
 * ```
 */

import { DomainEventBase, type DomainEventProps } from "@hl8/domain-base";
import { TenantProfile } from "../entities/tenant-profile.entity.js";

/**
 * 租户档案更新事件的扩展载荷
 */
export interface TenantProfileUpdatedEventPayload {
  readonly profile: TenantProfile;
}

/**
 * 租户档案更新事件
 *
 * @description 当租户档案信息被更新时触发
 */
export class TenantProfileUpdatedEvent extends DomainEventBase {
  private readonly payload: TenantProfileUpdatedEventPayload;

  /**
   * 创建租户档案更新事件
   *
   * @param props - 领域事件基础属性
   * @param payload - 租户档案更新事件载荷
   */
  public constructor(
    props: DomainEventProps,
    payload: TenantProfileUpdatedEventPayload,
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
    return "TenantProfileUpdatedEvent";
  }

  /**
   * 获取更新后的租户档案
   *
   * @returns 租户档案
   */
  public get profile(): TenantProfile {
    return this.payload.profile;
  }
}

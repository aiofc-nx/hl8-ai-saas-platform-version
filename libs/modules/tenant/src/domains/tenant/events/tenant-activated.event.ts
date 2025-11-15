/**
 * @fileoverview 租户激活事件
 * @description 当租户被激活时触发，记录状态变更信息
 *
 * ## 业务规则
 *
 * ### 触发时机
 * - 租户状态从"已初始化"或"已暂停"转换为"已激活"时
 *
 * ### 事件载荷
 * - 租户ID、名称
 * - 前一个状态和当前状态
 * - 审计元数据
 *
 * ## 使用示例
 *
 * ```typescript
 * const event = new TenantActivatedEvent({
 *   ...baseProps,
 *   tenantName: tenantName.value,
 *   previousStatus: previousStatus,
 *   currentStatus: TenantStatus.Active
 * });
 * ```
 */

import { DomainEventBase, type DomainEventProps } from "@hl8/domain-base";
import { TenantStatus } from "../value-objects/tenant-status.vo.js";

/**
 * 租户激活事件的扩展载荷
 */
export interface TenantActivatedEventPayload {
  readonly tenantName: string;
  readonly previousStatus: TenantStatus;
  readonly currentStatus: TenantStatus;
}

/**
 * 租户激活事件
 *
 * @description 当租户被激活时触发
 */
export class TenantActivatedEvent extends DomainEventBase {
  private readonly payload: TenantActivatedEventPayload;

  /**
   * 创建租户激活事件
   *
   * @param props - 领域事件基础属性
   * @param payload - 租户激活事件载荷
   */
  public constructor(
    props: DomainEventProps,
    payload: TenantActivatedEventPayload,
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
    return "TenantActivatedEvent";
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
   * 获取前一个状态
   *
   * @returns 前一个状态
   */
  public get previousStatus(): TenantStatus {
    return this.payload.previousStatus;
  }

  /**
   * 获取当前状态
   *
   * @returns 当前状态（应为 Active）
   */
  public get currentStatus(): TenantStatus {
    return this.payload.currentStatus;
  }
}

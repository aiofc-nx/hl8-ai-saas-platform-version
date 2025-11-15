/**
 * @fileoverview 租户停用事件
 * @description 当租户被停用时触发，记录状态变更信息
 *
 * ## 业务规则
 *
 * ### 触发时机
 * - 租户状态从"已激活"转换为"已暂停"时
 *
 * ### 事件载荷
 * - 租户ID、名称
 * - 前一个状态（Active）和当前状态（Suspended）
 * - 审计元数据
 *
 * ## 使用示例
 *
 * ```typescript
 * const event = new TenantSuspendedEvent({
 *   ...baseProps,
 *   tenantName: tenantName.value,
 *   previousStatus: TenantStatus.Active,
 *   currentStatus: TenantStatus.Suspended
 * });
 * ```
 */

import { DomainEventBase, type DomainEventProps } from "@hl8/domain-base";
import { TenantStatus } from "../value-objects/tenant-status.vo.js";

/**
 * 租户停用事件的扩展载荷
 */
export interface TenantSuspendedEventPayload {
  readonly tenantName: string;
  readonly previousStatus: TenantStatus;
  readonly currentStatus: TenantStatus;
}

/**
 * 租户停用事件
 *
 * @description 当租户被停用时触发
 */
export class TenantSuspendedEvent extends DomainEventBase {
  private readonly payload: TenantSuspendedEventPayload;

  /**
   * 创建租户停用事件
   *
   * @param props - 领域事件基础属性
   * @param payload - 租户停用事件载荷
   */
  public constructor(
    props: DomainEventProps,
    payload: TenantSuspendedEventPayload,
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
    return "TenantSuspendedEvent";
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
   * @returns 前一个状态（应为 Active）
   */
  public get previousStatus(): TenantStatus {
    return this.payload.previousStatus;
  }

  /**
   * 获取当前状态
   *
   * @returns 当前状态（应为 Suspended）
   */
  public get currentStatus(): TenantStatus {
    return this.payload.currentStatus;
  }
}

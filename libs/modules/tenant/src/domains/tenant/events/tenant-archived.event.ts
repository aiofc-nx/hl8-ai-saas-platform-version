/**
 * @fileoverview 租户归档事件
 * @description 当租户被归档（软删除）时触发，记录归档信息
 *
 * ## 业务规则
 *
 * ### 触发时机
 * - 租户被归档（软删除）时
 * - 可以从任意状态归档
 *
 * ### 事件载荷
 * - 租户ID、名称
 * - 前一个状态
 * - 软删除状态
 * - 审计元数据
 *
 * ## 使用示例
 *
 * ```typescript
 * const event = new TenantArchivedEvent({
 *   ...baseProps,
 *   tenantName: tenantName.value,
 *   previousStatus: previousStatus
 * });
 * ```
 */

import { DomainEventBase, type DomainEventProps } from "@hl8/domain-base";
import { TenantStatus } from "../value-objects/tenant-status.vo.js";

/**
 * 租户归档事件的扩展载荷
 */
export interface TenantArchivedEventPayload {
  readonly tenantName: string;
  readonly previousStatus: TenantStatus;
}

/**
 * 租户归档事件
 *
 * @description 当租户被归档时触发
 */
export class TenantArchivedEvent extends DomainEventBase {
  private readonly payload: TenantArchivedEventPayload;

  /**
   * 创建租户归档事件
   *
   * @param props - 领域事件基础属性（包含 softDeleteStatus）
   * @param payload - 租户归档事件载荷
   */
  public constructor(
    props: DomainEventProps,
    payload: TenantArchivedEventPayload,
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
    return "TenantArchivedEvent";
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
}

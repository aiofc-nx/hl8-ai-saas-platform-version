/**
 * @zh
 * @description 租户开户事件占位定义，后续将作为事件溯源与异步流程的核心消息。
 */
export class TenantProvisionedEvent {
  /**
   * @zh
   * @param tenantId 触发开户的租户标识
   * @param occurredAt 事件发生时间戳
   */
  public constructor(
    public readonly tenantId: string,
    public readonly occurredAt: Date = new Date(),
  ) {}
}


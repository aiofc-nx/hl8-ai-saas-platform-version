/**
 * @fileoverview 租户上下文响应 DTO
 * @description 用于返回租户上下文信息的响应对象
 *
 * ## 业务规则
 *
 * ### 响应字段
 * - 租户ID、名称
 * - 默认组织ID、默认时区、货币
 *
 * ## 使用示例
 *
 * ```typescript
 * const dto = new TenantContextResponseDto();
 * dto.tenantId = "tenant-123";
 * // ... 设置其他字段
 * ```
 */

/**
 * 租户上下文响应 DTO
 *
 * @description 用于返回租户上下文信息
 */
export class TenantContextResponseDto {
  /**
   * 租户ID
   */
  public readonly tenantId: string;

  /**
   * 租户名称
   */
  public readonly tenantName: string;

  /**
   * 默认组织ID
   */
  public readonly defaultOrganizationId: string;

  /**
   * 默认时区
   */
  public readonly defaultTimezone: string;

  /**
   * 货币（可选）
   */
  public readonly currency?: string | null;

  /**
   * 构造函数
   *
   * @param data - 响应数据
   */
  public constructor(data: {
    tenantId: string;
    tenantName: string;
    defaultOrganizationId: string;
    defaultTimezone: string;
    currency?: string | null;
  }) {
    this.tenantId = data.tenantId;
    this.tenantName = data.tenantName;
    this.defaultOrganizationId = data.defaultOrganizationId;
    this.defaultTimezone = data.defaultTimezone;
    this.currency = data.currency ?? null;
  }
}

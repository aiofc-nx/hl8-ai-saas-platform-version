/**
 * @fileoverview 租户列表项 DTO
 * @description 用于返回租户列表中的单个租户项
 *
 * ## 业务规则
 *
 * ### 响应字段
 * - 租户ID、名称、状态
 * - 联系人信息
 * - 创建和更新时间
 *
 * ## 使用示例
 *
 * ```typescript
 * const dto = new TenantListItemDto({
 *   tenantId: "tenant-123",
 *   tenantName: "ABC公司",
 *   status: "Active",
 *   ...
 * });
 * ```
 */

/**
 * 租户列表项 DTO
 *
 * @description 用于返回租户列表中的单个租户项
 */
export class TenantListItemDto {
  /**
   * 租户ID
   */
  public readonly tenantId: string;

  /**
   * 租户名称
   */
  public readonly tenantName: string;

  /**
   * 状态
   */
  public readonly status: string;

  /**
   * 负责人姓名
   */
  public readonly contactName: string;

  /**
   * 邮箱
   */
  public readonly email: string;

  /**
   * 电话（可选）
   */
  public readonly phone?: string | null;

  /**
   * 创建时间
   */
  public readonly createdAt: Date;

  /**
   * 更新时间
   */
  public readonly updatedAt: Date;

  /**
   * 构造函数
   *
   * @param data - 响应数据
   */
  public constructor(data: {
    tenantId: string;
    tenantName: string;
    status: string;
    contactName: string;
    email: string;
    phone?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    this.tenantId = data.tenantId;
    this.tenantName = data.tenantName;
    this.status = data.status;
    this.contactName = data.contactName;
    this.email = data.email;
    this.phone = data.phone ?? null;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }
}

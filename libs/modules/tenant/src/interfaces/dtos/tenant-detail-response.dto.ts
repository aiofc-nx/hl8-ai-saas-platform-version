/**
 * @fileoverview 租户详情响应 DTO
 * @description 用于返回租户详情的响应对象
 *
 * ## 业务规则
 *
 * ### 响应字段
 * - 租户基本信息（ID、名称、状态）
 * - 联系人信息
 * - 组织上下文
 * - 租户档案
 * - 时间戳和软删除状态
 *
 * ## 使用示例
 *
 * ```typescript
 * const dto = new TenantDetailResponseDto({
 *   tenantId: "tenant-123",
 *   tenantName: "ABC公司",
 *   ...
 * });
 * ```
 */

/**
 * 租户详情响应 DTO
 *
 * @description 用于返回租户详情
 */
export class TenantDetailResponseDto {
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
   * 法定名称（可选）
   */
  public readonly legalName?: string | null;

  /**
   * 注册代码（可选）
   */
  public readonly registrationCode?: string | null;

  /**
   * 行业分类（可选）
   */
  public readonly industry?: string | null;

  /**
   * 创建时间
   */
  public readonly createdAt: Date;

  /**
   * 更新时间
   */
  public readonly updatedAt: Date;

  /**
   * 是否已删除
   */
  public readonly isDeleted: boolean;

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
    defaultOrganizationId: string;
    defaultTimezone: string;
    currency?: string | null;
    legalName?: string | null;
    registrationCode?: string | null;
    industry?: string | null;
    createdAt: Date;
    updatedAt: Date;
    isDeleted: boolean;
  }) {
    this.tenantId = data.tenantId;
    this.tenantName = data.tenantName;
    this.status = data.status;
    this.contactName = data.contactName;
    this.email = data.email;
    this.phone = data.phone ?? null;
    this.defaultOrganizationId = data.defaultOrganizationId;
    this.defaultTimezone = data.defaultTimezone;
    this.currency = data.currency ?? null;
    this.legalName = data.legalName ?? null;
    this.registrationCode = data.registrationCode ?? null;
    this.industry = data.industry ?? null;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
    this.isDeleted = data.isDeleted;
  }
}

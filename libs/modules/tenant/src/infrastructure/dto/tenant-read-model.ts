/**
 * @fileoverview 租户读模型 DTO
 * @description 用于查询响应的数据传输对象，从读模型投影转换而来
 *
 * ## 业务规则
 *
 * ### 数据转换规则
 * - 从 TenantProjection 实体转换为 DTO
 * - 包含租户的完整信息
 * - 支持序列化和反序列化
 *
 * ## 使用示例
 *
 * ```typescript
 * const projection = await em.findOne(TenantProjection, { tenantId });
 * const dto = TenantReadModel.fromProjection(projection);
 * ```
 */

/**
 * 租户读模型 DTO
 *
 * @description 用于查询响应的数据传输对象
 */
export class TenantReadModel {
  /**
   * 租户ID
   */
  public readonly tenantId: string;

  /**
   * 租户名称
   */
  public readonly tenantName: string;

  /**
   * 租户状态
   */
  public readonly status: string;

  /**
   * 负责人姓名
   */
  public readonly contactName?: string | null;

  /**
   * 邮箱
   */
  public readonly email: string;

  /**
   * 电话
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
   * 货币
   */
  public readonly currency?: string | null;

  /**
   * 法定名称
   */
  public readonly legalName?: string | null;

  /**
   * 注册代码
   */
  public readonly registrationCode?: string | null;

  /**
   * 行业分类
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
   * 私有构造函数
   *
   * @param data - DTO 数据
   */
  private constructor(data: {
    tenantId: string;
    tenantName: string;
    status: string;
    contactName?: string | null;
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
    this.phone = data.phone;
    this.defaultOrganizationId = data.defaultOrganizationId;
    this.defaultTimezone = data.defaultTimezone;
    this.currency = data.currency;
    this.legalName = data.legalName;
    this.registrationCode = data.registrationCode;
    this.industry = data.industry;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
    this.isDeleted = data.isDeleted;
  }

  /**
   * 从读模型投影创建 DTO
   *
   * @param projection - 读模型投影实体
   * @returns 读模型 DTO
   */
  public static fromProjection(projection: {
    tenantId: string;
    tenantName: string;
    status: string;
    contactName?: string | null;
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
  }): TenantReadModel {
    return new TenantReadModel({
      tenantId: projection.tenantId,
      tenantName: projection.tenantName,
      status: projection.status,
      contactName: projection.contactName,
      email: projection.email,
      phone: projection.phone,
      defaultOrganizationId: projection.defaultOrganizationId,
      defaultTimezone: projection.defaultTimezone,
      currency: projection.currency,
      legalName: projection.legalName,
      registrationCode: projection.registrationCode,
      industry: projection.industry,
      createdAt: projection.createdAt,
      updatedAt: projection.updatedAt,
      isDeleted: projection.isDeleted,
    });
  }
}

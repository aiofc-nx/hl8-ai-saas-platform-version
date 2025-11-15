/**
 * @fileoverview 租户档案实体
 * @description 存储租户的扩展信息，作为租户聚合的一部分
 *
 * ## 业务规则
 *
 * ### 字段说明
 * - 法定名称：租户的法定注册名称（可选）
 * - 注册代码：租户的工商注册代码或统一社会信用代码（可选）
 * - 行业分类：租户所属的行业分类（可选）
 *
 * ### 实体特性
 * - 作为租户聚合的内部实体，可映射为数据库子表
 * - 所有字段均为可选，支持渐进式信息完善
 * - 实体不可变，更新时需创建新实例
 *
 * ## 使用示例
 *
 * ```typescript
 * const profile = TenantProfile.create({
 *   legalName: "ABC科技有限公司",
 *   registrationCode: "91110000MA01234567",
 *   industry: "信息技术"
 * });
 * ```
 */

import { ValueObjectBase } from "@hl8/domain-base";

/**
 * 租户档案实体的内部属性结构
 */
interface TenantProfileProps {
  readonly legalName: string | null;
  readonly registrationCode: string | null;
  readonly industry: string | null;
}

/**
 * 租户档案实体
 *
 * @description 存储租户的扩展信息，作为租户聚合的一部分
 * 注意：虽然名为"实体"，但实际实现为值对象，因为不需要独立标识
 */
export class TenantProfile extends ValueObjectBase<TenantProfileProps> {
  /**
   * 私有构造函数，确保只能通过工厂方法创建
   *
   * @param props - 档案属性
   */
  private constructor(props: TenantProfileProps) {
    super(props);
  }

  /**
   * 创建租户档案实体
   *
   * @description 创建新的租户档案实例，所有字段均为可选
   *
   * @param data - 档案数据
   * @param data.legalName - 法定名称（可选）
   * @param data.registrationCode - 注册代码（可选）
   * @param data.industry - 行业分类（可选）
   * @returns 租户档案实体实例
   *
   * @example
   * ```typescript
   * const profile = TenantProfile.create({
   *   legalName: "ABC科技有限公司",
   *   registrationCode: "91110000MA01234567"
   * });
   * ```
   */
  public static create(data?: {
    legalName?: string | null;
    registrationCode?: string | null;
    industry?: string | null;
  }): TenantProfile {
    const legalName = data?.legalName?.trim() || null;
    const registrationCode = data?.registrationCode?.trim() || null;
    const industry = data?.industry?.trim() || null;

    return new TenantProfile({
      legalName: legalName && legalName.length > 0 ? legalName : null,
      registrationCode:
        registrationCode && registrationCode.length > 0
          ? registrationCode
          : null,
      industry: industry && industry.length > 0 ? industry : null,
    });
  }

  /**
   * 获取法定名称
   *
   * @returns 法定名称（可能为 null）
   */
  public get legalName(): string | null {
    return this.props.legalName;
  }

  /**
   * 获取注册代码
   *
   * @returns 注册代码（可能为 null）
   */
  public get registrationCode(): string | null {
    return this.props.registrationCode;
  }

  /**
   * 获取行业分类
   *
   * @returns 行业分类（可能为 null）
   */
  public get industry(): string | null {
    return this.props.industry;
  }

  /**
   * 判断是否有法定名称
   *
   * @returns 如果有法定名称返回 `true`
   */
  public hasLegalName(): boolean {
    return this.props.legalName !== null && this.props.legalName.length > 0;
  }

  /**
   * 判断是否有注册代码
   *
   * @returns 如果有注册代码返回 `true`
   */
  public hasRegistrationCode(): boolean {
    return (
      this.props.registrationCode !== null &&
      this.props.registrationCode.length > 0
    );
  }

  /**
   * 判断是否有行业分类
   *
   * @returns 如果有行业分类返回 `true`
   */
  public hasIndustry(): boolean {
    return this.props.industry !== null && this.props.industry.length > 0;
  }

  /**
   * 更新租户档案
   *
   * @description 创建新的租户档案实例，更新指定字段
   *
   * @param updates - 要更新的字段
   * @returns 新的租户档案实例
   *
   * @example
   * ```typescript
   * const updated = profile.update({ industry: "金融服务" });
   * ```
   */
  public update(updates: {
    legalName?: string | null;
    registrationCode?: string | null;
    industry?: string | null;
  }): TenantProfile {
    return TenantProfile.create({
      legalName:
        updates.legalName !== undefined ? updates.legalName : this.legalName,
      registrationCode:
        updates.registrationCode !== undefined
          ? updates.registrationCode
          : this.registrationCode,
      industry:
        updates.industry !== undefined ? updates.industry : this.industry,
    });
  }
}

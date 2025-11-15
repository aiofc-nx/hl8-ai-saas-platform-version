/**
 * @fileoverview 租户联系人信息值对象
 * @description 封装租户的联系人信息，包括负责人姓名、邮箱和电话
 *
 * ## 业务规则
 *
 * ### 邮箱规则
 * - 邮箱为必填字段
 * - 必须符合标准邮箱格式（RFC 5322）
 * - 邮箱格式验证使用正则表达式
 *
 * ### 电话规则
 * - 电话为可选字段
 * - 如提供电话，需符合国际格式（+国家代码）
 * - 国际格式示例：+86-13800138000、+1-555-123-4567
 *
 * ## 使用示例
 *
 * ```typescript
 * const contactInfo = TenantContactInfo.create({
 *   contactName: "张三",
 *   email: "zhangsan@example.com",
 *   phone: "+86-13800138000"
 * });
 * ```
 */

import { DomainException, ValueObjectBase } from "@hl8/domain-base";
import { assertNonEmptyString } from "@hl8/domain-base/utils/domain-guards.js";

/**
 * 租户联系人信息值对象的内部属性结构
 */
interface TenantContactInfoProps {
  readonly contactName: string;
  readonly email: string;
  readonly phone: string | null;
}

/**
 * 标准邮箱格式正则表达式（RFC 5322 简化版）
 */
const EMAIL_PATTERN =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/**
 * 国际电话格式正则表达式
 * 格式：+国家代码-电话号码
 * 示例：+86-13800138000、+1-555-123-4567
 */
const INTERNATIONAL_PHONE_PATTERN = /^\+\d{1,4}-\d{1,14}$/;

/**
 * 租户联系人信息值对象
 *
 * @description 封装租户联系人信息，提供格式校验和不可变性保证
 */
export class TenantContactInfo extends ValueObjectBase<TenantContactInfoProps> {
  /**
   * 私有构造函数，确保只能通过工厂方法创建
   *
   * @param props - 联系人信息属性
   */
  private constructor(props: TenantContactInfoProps) {
    super(props);
  }

  /**
   * 创建租户联系人信息值对象
   *
   * @description 校验联系人信息格式，符合规范后创建值对象
   *
   * @param data - 联系人信息数据
   * @param data.contactName - 负责人姓名
   * @param data.email - 邮箱（必填）
   * @param data.phone - 电话（可选）
   * @returns 租户联系人信息值对象实例
   *
   * @throws {DomainException} 当邮箱为空、格式不正确或电话格式不正确时抛出
   *
   * @example
   * ```typescript
   * const contactInfo = TenantContactInfo.create({
   *   contactName: "张三",
   *   email: "zhangsan@example.com",
   *   phone: "+86-13800138000"
   * });
   * ```
   */
  public static create(data: {
    contactName: string;
    email: string;
    phone?: string | null;
  }): TenantContactInfo {
    // 校验负责人姓名
    assertNonEmptyString(data.contactName, "负责人姓名不能为空");
    const contactName = data.contactName.trim();

    // 校验邮箱（必填）
    assertNonEmptyString(data.email, "邮箱不能为空");
    const email = data.email.trim().toLowerCase();

    // 校验邮箱格式
    if (!EMAIL_PATTERN.test(email)) {
      throw new DomainException("邮箱格式不正确，必须符合标准邮箱格式");
    }

    // 校验电话（可选）
    let phone: string | null = null;
    if (data.phone !== undefined && data.phone !== null) {
      const trimmedPhone = data.phone.trim();
      if (trimmedPhone.length > 0) {
        // 校验国际电话格式
        if (!INTERNATIONAL_PHONE_PATTERN.test(trimmedPhone)) {
          throw new DomainException(
            "电话格式不正确，必须符合国际格式（+国家代码-电话号码）",
          );
        }
        phone = trimmedPhone;
      }
    }

    return new TenantContactInfo({
      contactName,
      email,
      phone,
    });
  }

  /**
   * 获取负责人姓名
   *
   * @returns 负责人姓名
   */
  public get contactName(): string {
    return this.props.contactName;
  }

  /**
   * 获取邮箱
   *
   * @returns 邮箱地址
   */
  public get email(): string {
    return this.props.email;
  }

  /**
   * 获取电话
   *
   * @returns 电话（可能为 null）
   */
  public get phone(): string | null {
    return this.props.phone;
  }

  /**
   * 判断是否有电话
   *
   * @returns 如果有电话返回 `true`
   */
  public hasPhone(): boolean {
    return this.props.phone !== null && this.props.phone.length > 0;
  }
}

/**
 * @fileoverview 租户上下文值对象
 * @description 封装租户的组织上下文信息，包括默认组织根节点、默认时区和货币
 *
 * ## 业务规则
 *
 * ### 必填字段
 * - 默认组织根节点：必填，用于标识租户的默认组织
 * - 默认时区：必填，用于租户的时间相关操作
 *
 * ### 可选字段
 * - 货币：可选，用于租户的财务相关操作
 *
 * ## 使用示例
 *
 * ```typescript
 * const context = TenantContext.create({
 *   defaultOrganizationId: OrganizationId.create("org-123"),
 *   defaultTimezone: "Asia/Shanghai",
 *   currency: "CNY"
 * });
 * ```
 */

import {
  DomainException,
  OrganizationId,
  ValueObjectBase,
} from "@hl8/domain-base";
import { assertNonEmptyString } from "@hl8/domain-base/utils/domain-guards.js";

/**
 * 租户上下文值对象的内部属性结构
 */
interface TenantContextProps {
  readonly defaultOrganizationId: OrganizationId;
  readonly defaultTimezone: string;
  readonly currency: string | null;
}

/**
 * 租户上下文值对象
 *
 * @description 封装租户的组织上下文信息，提供格式校验和不可变性保证
 */
export class TenantContext extends ValueObjectBase<TenantContextProps> {
  /**
   * 私有构造函数，确保只能通过工厂方法创建
   *
   * @param props - 上下文属性
   */
  private constructor(props: TenantContextProps) {
    super(props);
  }

  /**
   * 创建租户上下文值对象
   *
   * @description 校验上下文信息格式，符合规范后创建值对象
   *
   * @param data - 上下文数据
   * @param data.defaultOrganizationId - 默认组织根节点（必填）
   * @param data.defaultTimezone - 默认时区（必填）
   * @param data.currency - 货币（可选）
   * @returns 租户上下文值对象实例
   *
   * @throws {DomainException} 当时区为空或格式不正确时抛出
   *
   * @example
   * ```typescript
   * const context = TenantContext.create({
   *   defaultOrganizationId: OrganizationId.create("org-123"),
   *   defaultTimezone: "Asia/Shanghai",
   *   currency: "CNY"
   * });
   * ```
   */
  public static create(data: {
    defaultOrganizationId: OrganizationId;
    defaultTimezone: string;
    currency?: string | null;
  }): TenantContext {
    // 校验默认组织根节点（必填）
    if (!data.defaultOrganizationId) {
      throw new DomainException("默认组织根节点不能为空");
    }

    // 校验默认时区（必填）
    assertNonEmptyString(data.defaultTimezone, "默认时区不能为空");
    const defaultTimezone = data.defaultTimezone.trim();

    // 校验时区格式（基本格式：Area/Location，如 Asia/Shanghai）
    const timezonePattern = /^[A-Za-z_]+\/[A-Za-z_]+$/;
    if (!timezonePattern.test(defaultTimezone)) {
      throw new DomainException(
        "时区格式不正确，必须符合 IANA 时区格式（如 Asia/Shanghai）",
      );
    }

    // 处理货币（可选）
    let currency: string | null = null;
    if (data.currency !== undefined && data.currency !== null) {
      const trimmedCurrency = data.currency.trim();
      if (trimmedCurrency.length > 0) {
        // 校验货币代码格式（3位大写字母，如 CNY、USD）
        const currencyPattern = /^[A-Z]{3}$/;
        if (!currencyPattern.test(trimmedCurrency)) {
          throw new DomainException(
            "货币代码格式不正确，必须为3位大写字母（如 CNY、USD）",
          );
        }
        currency = trimmedCurrency;
      }
    }

    return new TenantContext({
      defaultOrganizationId: data.defaultOrganizationId,
      defaultTimezone,
      currency,
    });
  }

  /**
   * 获取默认组织根节点
   *
   * @returns 默认组织根节点
   */
  public get defaultOrganizationId(): OrganizationId {
    return this.props.defaultOrganizationId;
  }

  /**
   * 获取默认时区
   *
   * @returns 默认时区
   */
  public get defaultTimezone(): string {
    return this.props.defaultTimezone;
  }

  /**
   * 获取货币
   *
   * @returns 货币代码（可能为 null）
   */
  public get currency(): string | null {
    return this.props.currency;
  }

  /**
   * 判断是否有货币
   *
   * @returns 如果有货币返回 `true`
   */
  public hasCurrency(): boolean {
    return this.props.currency !== null && this.props.currency.length > 0;
  }
}

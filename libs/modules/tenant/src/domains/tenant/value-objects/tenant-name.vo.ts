/**
 * @fileoverview 租户名称值对象
 * @description 封装租户名称及其校验规则，确保租户名称符合业务规范
 *
 * ## 业务规则
 *
 * ### 名称长度规则
 * - 租户名称长度必须在 1-100 字符之间
 * - 空字符串或仅包含空白字符的名称不被允许
 *
 * ### 字符集规则
 * - 允许字符：中文、英文、数字、连字符（-）、下划线（_）
 * - 不允许：特殊符号、控制字符、表情符号等
 *
 * ### 唯一性规则
 * - 租户名称在同一平台内必须唯一（由应用层保证）
 * - 值对象仅负责格式校验，不负责唯一性校验
 *
 * ## 使用示例
 *
 * ```typescript
 * const tenantName = TenantName.create("ABC公司");
 * console.log(tenantName.value); // "ABC公司"
 * ```
 */

import { DomainException, ValueObjectBase } from "@hl8/domain-base";
import { assertNonEmptyString } from "@hl8/domain-base";

/**
 * 租户名称值对象的内部属性结构
 */
interface TenantNameProps {
  readonly value: string;
}

/**
 * 租户名称允许的字符集正则表达式
 * - 中文：\u4e00-\u9fa5
 * - 英文：a-zA-Z
 * - 数字：0-9
 * - 连字符：-
 * - 下划线：_
 */
const TENANT_NAME_PATTERN = /^[\u4e00-\u9fa5a-zA-Z0-9_-]+$/u;

/**
 * 租户名称最小长度
 */
const MIN_LENGTH = 1;

/**
 * 租户名称最大长度
 */
const MAX_LENGTH = 100;

/**
 * 租户名称值对象
 *
 * @description 封装租户名称，提供格式校验和不可变性保证
 */
export class TenantName extends ValueObjectBase<TenantNameProps> {
  /**
   * 私有构造函数，确保只能通过工厂方法创建
   *
   * @param value - 租户名称值
   */
  private constructor(value: string) {
    super({ value });
  }

  /**
   * 创建租户名称值对象
   *
   * @description 校验租户名称格式，符合规范后创建值对象
   *
   * @param value - 租户名称字符串
   * @returns 租户名称值对象实例
   *
   * @throws {DomainException} 当租户名称为空、长度不符合要求或包含非法字符时抛出
   *
   * @example
   * ```typescript
   * const name = TenantName.create("ABC公司");
   * ```
   */
  public static create(value: string): TenantName {
    // 校验非空
    assertNonEmptyString(value, "租户名称不能为空");

    // 去除首尾空白字符
    const trimmedValue = value.trim();

    // 校验长度
    if (trimmedValue.length < MIN_LENGTH) {
      throw new DomainException(`租户名称长度不能少于 ${MIN_LENGTH} 个字符`);
    }

    if (trimmedValue.length > MAX_LENGTH) {
      throw new DomainException(`租户名称长度不能超过 ${MAX_LENGTH} 个字符`);
    }

    // 校验字符集
    if (!TENANT_NAME_PATTERN.test(trimmedValue)) {
      throw new DomainException(
        "租户名称只能包含中文、英文、数字、连字符（-）和下划线（_）",
      );
    }

    return new TenantName(trimmedValue);
  }

  /**
   * 获取租户名称值
   *
   * @returns 租户名称字符串
   */
  public get value(): string {
    return this.props.value;
  }

  /**
   * 转换为字符串
   *
   * @returns 租户名称字符串
   */
  public toString(): string {
    return this.value;
  }
}

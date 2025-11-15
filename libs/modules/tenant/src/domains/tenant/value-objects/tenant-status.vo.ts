/**
 * @fileoverview 租户状态值对象
 * @description 封装租户状态枚举和状态转移矩阵，确保状态转换符合业务规则
 *
 * ## 业务规则
 *
 * ### 状态枚举
 * - `Initialized` - 已初始化：租户已创建但尚未激活
 * - `Active` - 已激活：租户可以正常使用平台服务
 * - `Suspended` - 已暂停：租户被临时停用，无法使用服务
 * - `Archived` - 已归档：租户被软删除，不再活跃
 *
 * ### 状态转移规则
 * - `Initialized` → `Active`（通过激活操作）
 * - `Active` → `Suspended`（通过停用操作）
 * - `Suspended` → `Active`（通过激活操作）
 * - 任意状态 → `Archived`（通过归档操作）
 *
 * ### 状态转移限制
 * - 已归档的租户不能执行激活、停用操作
 * - 只有 `Initialized` 或 `Suspended` 状态的租户可以激活
 * - 只有 `Active` 状态的租户可以停用
 *
 * ## 使用示例
 *
 * ```typescript
 * const status = TenantStatus.Initialized;
 * const canActivate = status.canTransitionTo(TenantStatus.Active); // true
 * ```
 */

import { DomainException, ValueObjectBase } from "@hl8/domain-base";

/**
 * 租户状态枚举值
 */
export enum TenantStatusEnum {
  /**
   * 已初始化：租户已创建但尚未激活
   */
  Initialized = "Initialized",

  /**
   * 已激活：租户可以正常使用平台服务
   */
  Active = "Active",

  /**
   * 已暂停：租户被临时停用，无法使用服务
   */
  Suspended = "Suspended",

  /**
   * 已归档：租户被软删除，不再活跃
   */
  Archived = "Archived",
}

/**
 * 租户状态值对象的内部属性结构
 */
interface TenantStatusProps {
  readonly value: TenantStatusEnum;
}

/**
 * 状态转移矩阵
 * 键：当前状态，值：允许转移到的目标状态数组
 */
const STATE_TRANSITION_MATRIX: Record<
  TenantStatusEnum,
  readonly TenantStatusEnum[]
> = {
  [TenantStatusEnum.Initialized]: [
    TenantStatusEnum.Active,
    TenantStatusEnum.Archived,
  ],
  [TenantStatusEnum.Active]: [
    TenantStatusEnum.Suspended,
    TenantStatusEnum.Archived,
  ],
  [TenantStatusEnum.Suspended]: [
    TenantStatusEnum.Active,
    TenantStatusEnum.Archived,
  ],
  [TenantStatusEnum.Archived]: [], // 已归档状态不能转移到其他状态
} as const;

/**
 * 租户状态值对象
 *
 * @description 封装租户状态，提供状态转移验证能力
 */
export class TenantStatus extends ValueObjectBase<TenantStatusProps> {
  /**
   * 已初始化状态
   */
  public static readonly Initialized = new TenantStatus(
    TenantStatusEnum.Initialized,
  );

  /**
   * 已激活状态
   */
  public static readonly Active = new TenantStatus(TenantStatusEnum.Active);

  /**
   * 已暂停状态
   */
  public static readonly Suspended = new TenantStatus(
    TenantStatusEnum.Suspended,
  );

  /**
   * 已归档状态
   */
  public static readonly Archived = new TenantStatus(TenantStatusEnum.Archived);

  /**
   * 私有构造函数，确保只能通过静态工厂方法创建
   *
   * @param value - 租户状态枚举值
   */
  private constructor(value: TenantStatusEnum) {
    super({ value });
  }

  /**
   * 从枚举值创建租户状态值对象
   *
   * @param value - 租户状态枚举值
   * @returns 租户状态值对象实例
   *
   * @throws {Error} 当传入无效的状态枚举值时抛出
   *
   * @example
   * ```typescript
   * const status = TenantStatus.fromEnum(TenantStatusEnum.Active);
   * ```
   */
  public static fromEnum(value: TenantStatusEnum): TenantStatus {
    switch (value) {
      case TenantStatusEnum.Initialized:
        return TenantStatus.Initialized;
      case TenantStatusEnum.Active:
        return TenantStatus.Active;
      case TenantStatusEnum.Suspended:
        return TenantStatus.Suspended;
      case TenantStatusEnum.Archived:
        return TenantStatus.Archived;
      default:
        throw new DomainException(`无效的租户状态: ${value}`);
    }
  }

  /**
   * 从字符串创建租户状态值对象
   *
   * @param value - 租户状态字符串
   * @returns 租户状态值对象实例
   *
   * @throws {Error} 当传入无效的状态字符串时抛出
   *
   * @example
   * ```typescript
   * const status = TenantStatus.fromString("Active");
   * ```
   */
  public static fromString(value: string): TenantStatus {
    const enumValue = value as TenantStatusEnum;
    if (!Object.values(TenantStatusEnum).includes(enumValue)) {
      throw new DomainException(`无效的租户状态字符串: ${value}`);
    }
    return TenantStatus.fromEnum(enumValue);
  }

  /**
   * 获取状态枚举值
   *
   * @returns 租户状态枚举值
   */
  public get value(): TenantStatusEnum {
    return this.props.value;
  }

  /**
   * 检查是否可以转移到目标状态
   *
   * @description 根据状态转移矩阵判断当前状态是否可以转移到目标状态
   *
   * @param target - 目标状态
   * @returns 如果可以转移返回 `true`，否则返回 `false`
   *
   * @example
   * ```typescript
   * const canActivate = status.canTransitionTo(TenantStatus.Active);
   * ```
   */
  public canTransitionTo(target: TenantStatus): boolean {
    const allowedTargets = STATE_TRANSITION_MATRIX[this.value];
    return allowedTargets.includes(target.value);
  }

  /**
   * 判断是否为已初始化状态
   *
   * @returns 如果是已初始化状态返回 `true`
   */
  public isInitialized(): boolean {
    return this.value === TenantStatusEnum.Initialized;
  }

  /**
   * 判断是否为已激活状态
   *
   * @returns 如果是已激活状态返回 `true`
   */
  public isActive(): boolean {
    return this.value === TenantStatusEnum.Active;
  }

  /**
   * 判断是否为已暂停状态
   *
   * @returns 如果是已暂停状态返回 `true`
   */
  public isSuspended(): boolean {
    return this.value === TenantStatusEnum.Suspended;
  }

  /**
   * 判断是否为已归档状态
   *
   * @returns 如果是已归档状态返回 `true`
   */
  public isArchived(): boolean {
    return this.value === TenantStatusEnum.Archived;
  }

  /**
   * 转换为字符串
   *
   * @returns 状态枚举值的字符串表示
   */
  public toString(): string {
    return this.value;
  }
}

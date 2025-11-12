import { ValueObjectBase } from "../value-objects/value-object.base.js";
import { DateTimeValueObject } from "../value-objects/date-time.value-object.js";
import { UserId } from "../value-objects/user-id.vo.js";

interface AuditTrailProps {
  readonly createdAt: DateTimeValueObject;
  readonly createdBy: UserId | null;
  readonly updatedAt: DateTimeValueObject;
  readonly updatedBy: UserId | null;
}

/**
 * @public
 * @description 审计轨迹值对象，记录创建与更新的时间与操作者。
 * @example
 * ```ts
 * const auditTrail = AuditTrail.create({ createdBy: null });
 * ```
 */
export class AuditTrail extends ValueObjectBase<AuditTrailProps> {
  private constructor(props: AuditTrailProps) {
    super(props);
  }

  /**
   * @description 根据初始信息创建审计轨迹。
   * @param initial - 包含 `createdBy` 与 `updatedBy` 的可选初始化参数。
   * @returns 新的 `AuditTrail` 实例。
   * @example
   * ```ts
   * const auditTrail = AuditTrail.create({ createdBy: userId });
   * ```
   */
  public static create(initial: {
    createdBy?: UserId | null;
    updatedBy?: UserId | null;
  }): AuditTrail {
    const now = DateTimeValueObject.now();
    const createdBy = initial.createdBy ?? null;
    const updatedBy = initial.updatedBy ?? initial.createdBy ?? null;

    return new AuditTrail({
      createdAt: now,
      createdBy,
      updatedAt: now,
      updatedBy,
    });
  }

  /**
   * @description 更新审计轨迹的更新时间与操作者。
   * @param change - 需要更新的操作者标识。
   * @returns 新的 `AuditTrail` 实例。
   * @example
   * ```ts
   * const updatedTrail = auditTrail.update({ updatedBy: userId });
   * ```
   */
  public update(change: { updatedBy?: UserId | null }): AuditTrail {
    return new AuditTrail({
      createdAt: this.createdAt,
      createdBy: this.createdBy,
      updatedAt: DateTimeValueObject.now(),
      updatedBy: change.updatedBy ?? this.updatedBy ?? null,
    });
  }

  /**
   * @description 获取创建时间。
   * @returns 创建时间值对象。
   * @example
   * ```ts
   * const createdAt = auditTrail.createdAt;
   * ```
   */
  public get createdAt(): DateTimeValueObject {
    return this.props.createdAt;
  }

  /**
   * @description 获取创建人标识。
   * @returns 创建人用户标识或 `null`。
   * @example
   * ```ts
   * const createdBy = auditTrail.createdBy;
   * ```
   */
  public get createdBy(): UserId | null {
    return this.props.createdBy;
  }

  /**
   * @description 获取更新时间。
   * @returns 更新时间值对象。
   * @example
   * ```ts
   * const updatedAt = auditTrail.updatedAt;
   * ```
   */
  public get updatedAt(): DateTimeValueObject {
    return this.props.updatedAt;
  }

  /**
   * @description 获取更新人标识。
   * @returns 更新人用户标识或 `null`。
   * @example
   * ```ts
   * const updatedBy = auditTrail.updatedBy;
   * ```
   */
  public get updatedBy(): UserId | null {
    return this.props.updatedBy;
  }
}

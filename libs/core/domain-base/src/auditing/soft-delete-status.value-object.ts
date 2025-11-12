import { ValueObjectBase } from "../value-objects/value-object.base.js";
import { DateTimeValueObject } from "../value-objects/date-time.value-object.js";
import { UserId } from "../value-objects/user-id.vo.js";

interface SoftDeleteProps {
  readonly isDeleted: boolean;
  readonly deletedAt: DateTimeValueObject | null;
  readonly deletedBy: UserId | null;
}

/**
 * @public
 * @description 软删除状态值对象，记录删除与恢复操作的完整上下文。
 * @example
 * ```ts
 * const status = SoftDeleteStatus.create();
 * ```
 */
export class SoftDeleteStatus extends ValueObjectBase<SoftDeleteProps> {
  private constructor(props: SoftDeleteProps) {
    super(props);
  }

  /**
   * @description 创建软删除状态值对象。
   * @param initial - 可选初始状态信息。
   * @returns 新的 `SoftDeleteStatus` 实例。
   * @example
   * ```ts
   * const status = SoftDeleteStatus.create({ isDeleted: true });
   * ```
   */
  public static create(initial?: {
    isDeleted?: boolean;
    deletedAt?: DateTimeValueObject | null;
    deletedBy?: UserId | null;
  }): SoftDeleteStatus {
    return new SoftDeleteStatus({
      isDeleted: initial?.isDeleted ?? false,
      deletedAt: initial?.deletedAt ?? null,
      deletedBy: initial?.deletedBy ?? null,
    });
  }

  /**
   * @description 将当前状态标记为已删除。
   * @param actor - 执行删除操作的用户，可为空。
   * @returns 新的 `SoftDeleteStatus` 实例。
   * @example
   * ```ts
   * const deleted = status.markDeleted(userId);
   * ```
   */
  public markDeleted(actor: UserId | null = null): SoftDeleteStatus {
    if (this.isDeleted) {
      return this;
    }

    return new SoftDeleteStatus({
      isDeleted: true,
      deletedAt: DateTimeValueObject.now(),
      deletedBy: actor ?? null,
    });
  }

  /**
   * @description 恢复软删除状态。
   * @param actor - 执行恢复操作的用户，可为空。
   * @returns 新的 `SoftDeleteStatus` 实例。
   * @example
   * ```ts
   * const restored = status.restore(userId);
   * ```
   */
  public restore(actor: UserId | null = null): SoftDeleteStatus {
    if (!this.isDeleted) {
      return this;
    }

    return new SoftDeleteStatus({
      isDeleted: false,
      deletedAt: null,
      deletedBy: actor ?? null,
    });
  }

  /**
   * @description 判断当前是否处于已删除状态。
   * @returns 若已删除则返回 `true`，否则返回 `false`。
   * @example
   * ```ts
   * const deleted = status.isDeleted;
   * ```
   */
  public get isDeleted(): boolean {
    return this.props.isDeleted;
  }

  /**
   * @description 获取删除时间。
   * @returns 删除时间值对象或 `null`。
   * @example
   * ```ts
   * const deletedAt = status.deletedAt;
   * ```
   */
  public get deletedAt(): DateTimeValueObject | null {
    return this.props.deletedAt;
  }

  /**
   * @description 获取删除操作者。
   * @returns 用户标识或 `null`。
   * @example
   * ```ts
   * const deletedBy = status.deletedBy;
   * ```
   */
  public get deletedBy(): UserId | null {
    return this.props.deletedBy;
  }
}

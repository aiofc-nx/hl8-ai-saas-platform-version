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
 * @remarks 软删除状态值对象，记录删除与恢复的完整上下文。
 */
export class SoftDeleteStatus extends ValueObjectBase<SoftDeleteProps> {
  private constructor(props: SoftDeleteProps) {
    super(props);
  }

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

  public get isDeleted(): boolean {
    return this.props.isDeleted;
  }

  public get deletedAt(): DateTimeValueObject | null {
    return this.props.deletedAt;
  }

  public get deletedBy(): UserId | null {
    return this.props.deletedBy;
  }
}

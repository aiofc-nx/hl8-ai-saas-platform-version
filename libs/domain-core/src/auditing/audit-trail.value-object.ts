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
 * @remarks 审计轨迹值对象，记录创建与更新信息。
 */
export class AuditTrail extends ValueObjectBase<AuditTrailProps> {
  private constructor(props: AuditTrailProps) {
    super(props);
  }

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

  public update(change: { updatedBy?: UserId | null }): AuditTrail {
    return new AuditTrail({
      createdAt: this.createdAt,
      createdBy: this.createdBy,
      updatedAt: DateTimeValueObject.now(),
      updatedBy: change.updatedBy ?? this.updatedBy ?? null,
    });
  }

  public get createdAt(): DateTimeValueObject {
    return this.props.createdAt;
  }

  public get createdBy(): UserId | null {
    return this.props.createdBy;
  }

  public get updatedAt(): DateTimeValueObject {
    return this.props.updatedAt;
  }

  public get updatedBy(): UserId | null {
    return this.props.updatedBy;
  }
}

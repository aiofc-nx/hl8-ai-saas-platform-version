import { assertNonEmptyString } from "../utils/domain-guards.js";
import { ValueObjectBase } from "./value-object.base.js";

interface IdentifierProps {
  readonly value: string;
}

/**
 * @public
 * @remarks 部门标识值对象。
 */
export class DepartmentId extends ValueObjectBase<IdentifierProps> {
  private constructor(value: string) {
    super({ value });
  }

  public static create(value: string): DepartmentId {
    assertNonEmptyString(value, "部门标识不能为空");
    return new DepartmentId(value.trim());
  }

  public get value(): string {
    return this.props.value;
  }

  public toString(): string {
    return this.value;
  }
}

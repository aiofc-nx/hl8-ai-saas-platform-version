import { assertNonEmptyString } from "../utils/domain-guards.js";
import { ValueObjectBase } from "./value-object.base.js";

interface IdentifierProps {
  readonly value: string;
}

/**
 * @public
 * @remarks 用户标识值对象。
 */
export class UserId extends ValueObjectBase<IdentifierProps> {
  private constructor(value: string) {
    super({ value });
  }

  public static create(value: string): UserId {
    assertNonEmptyString(value, "用户标识不能为空");
    return new UserId(value.trim());
  }

  public get value(): string {
    return this.props.value;
  }

  public toString(): string {
    return this.value;
  }
}

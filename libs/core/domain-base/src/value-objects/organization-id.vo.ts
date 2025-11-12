import { assertNonEmptyString } from "../utils/domain-guards.js";
import { ValueObjectBase } from "./value-object.base.js";

interface IdentifierProps {
  readonly value: string;
}

/**
 * @public
 * @remarks 组织标识值对象。
 */
export class OrganizationId extends ValueObjectBase<IdentifierProps> {
  private constructor(value: string) {
    super({ value });
  }

  public static create(value: string): OrganizationId {
    assertNonEmptyString(value, "组织标识不能为空");
    return new OrganizationId(value.trim());
  }

  public get value(): string {
    return this.props.value;
  }

  public toString(): string {
    return this.value;
  }
}

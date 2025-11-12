import { assertNonEmptyString } from "../utils/domain-guards.js";
import { ValueObjectBase } from "./value-object.base.js";

interface IdentifierProps {
  readonly value: string;
}

/**
 * @public
 * @remarks 租户标识值对象，确保跨模块使用一致的租户表达。
 */
export class TenantId extends ValueObjectBase<IdentifierProps> {
  private constructor(value: string) {
    super({ value });
  }

  public static create(value: string): TenantId {
    assertNonEmptyString(value, "租户标识不能为空");
    return new TenantId(value.trim());
  }

  public get value(): string {
    return this.props.value;
  }

  public toString(): string {
    return this.value;
  }
}

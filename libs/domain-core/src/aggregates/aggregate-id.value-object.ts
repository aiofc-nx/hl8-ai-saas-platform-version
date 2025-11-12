import { assertUuid } from "../utils/domain-guards.js";
import { UuidGenerator } from "../utils/uuid-generator.js";
import { ValueObjectBase } from "../value-objects/value-object.base.js";

interface AggregateIdProps {
  readonly value: string;
}

/**
 * @public
 * @remarks 聚合根唯一标识值对象。
 */
export class AggregateId extends ValueObjectBase<AggregateIdProps> {
  private constructor(value: string) {
    super({ value });
  }

  /**
   * 根据已有 UUID 创建标识。
   */
  public static fromString(value: string): AggregateId {
    assertUuid(value, "聚合标识必须为合法的 UUID");
    return new AggregateId(value);
  }

  /**
   * 生成新的聚合标识。
   */
  public static generate(): AggregateId {
    return AggregateId.fromString(UuidGenerator.generate());
  }

  /**
   * 获取字符串值。
   */
  public get value(): string {
    return this.props.value;
  }

  public toString(): string {
    return this.value;
  }
}

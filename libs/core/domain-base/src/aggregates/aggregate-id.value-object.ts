import { assertUuid } from "../utils/domain-guards.js";
import { UuidGenerator } from "../utils/uuid-generator.js";
import { ValueObjectBase } from "../value-objects/value-object.base.js";

interface AggregateIdProps {
  readonly value: string;
}

/**
 * @public
 * @description 聚合根唯一标识值对象，封装 UUID v4 字符串。
 * @example
 * ```ts
 * const aggregateId = AggregateId.generate();
 * ```
 */
export class AggregateId extends ValueObjectBase<AggregateIdProps> {
  private constructor(value: string) {
    super({ value });
  }

  /**
   * @description 根据已有 UUID 创建聚合标识。
   * @param value - 需要包装的 UUID 字符串。
   * @returns 新的 `AggregateId` 实例。
   * @throws {DomainException} 当传入字符串不是合法 UUID 时抛出。
   * @example
   * ```ts
   * const aggregateId = AggregateId.fromString("a3b1d8c0-...");
   * ```
   */
  public static fromString(value: string): AggregateId {
    assertUuid(value, "聚合标识必须为合法的 UUID");
    return new AggregateId(value);
  }

  /**
   * @description 生成新的聚合标识。
   * @returns 新的 `AggregateId` 实例。
   * @example
   * ```ts
   * const aggregateId = AggregateId.generate();
   * ```
   */
  public static generate(): AggregateId {
    return AggregateId.fromString(UuidGenerator.generate());
  }

  /**
   * @description 获取标识的字符串值。
   * @returns UUID 字符串。
   * @example
   * ```ts
   * const idValue = aggregateId.value;
   * ```
   */
  public get value(): string {
    return this.props.value;
  }

  /**
   * @description 获取标识的字符串表示。
   * @returns UUID 字符串。
   * @example
   * ```ts
   * const idString = aggregateId.toString();
   * ```
   */
  public toString(): string {
    return this.value;
  }
}

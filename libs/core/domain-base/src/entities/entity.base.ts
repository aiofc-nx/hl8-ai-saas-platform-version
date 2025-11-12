import { AggregateId } from "../aggregates/aggregate-id.value-object.js";
import { assertDefined } from "../utils/domain-guards.js";

/**
 * @public
 * @description 聚合内部实体基类，提供统一的标识管理与等值比较。
 * @typeParam TId - 实体标识类型，必须继承自 `AggregateId`。
 * @example
 * ```ts
 * class DepartmentEntity extends EntityBase<AggregateId> {
 *   public constructor(id: AggregateId) {
 *     super(id);
 *   }
 * }
 * ```
 */
export abstract class EntityBase<TId extends AggregateId> {
  protected readonly _id: TId;

  /**
   * @description 构造函数，要求传入合法的实体标识。
   * @param id - 实体标识，必须继承自 `AggregateId`。
   * @throws {DomainException} 当标识未定义时抛出。
   * @returns 返回 `EntityBase` 的实例。
   * @example
   * ```ts
   * super(AggregateId.generate());
   * ```
   */
  protected constructor(id: TId) {
    assertDefined(id, "实体标识不能为空");
    this._id = id;
  }

  /**
   * @description 获取实体标识。
   * @returns 实体标识实例。
   * @example
   * ```ts
   * const id = entity.id;
   * ```
   */
  public get id(): TId {
    return this._id;
  }

  /**
   * @description 判断两个实体是否等值。
   * @param entity - 用于比较的实体，可为空。
   * @returns 若两个实体标识一致则返回 `true`，否则返回 `false`。
   * @example
   * ```ts
   * const isSame = entity.equals(otherEntity);
   * ```
   */
  public equals(entity?: EntityBase<TId>): boolean {
    if (!entity) {
      return false;
    }
    if (this === entity) {
      return true;
    }
    return this._id.equals(entity._id);
  }
}

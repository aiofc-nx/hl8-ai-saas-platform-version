import { AggregateId } from "../aggregates/aggregate-id.value-object.js";
import { assertDefined } from "../utils/domain-guards.js";

/**
 * @public
 * @remarks 聚合内部实体基类，提供统一的标识与等值比较。
 */
export abstract class EntityBase<TId extends AggregateId> {
  protected readonly _id: TId;

  protected constructor(id: TId) {
    assertDefined(id, "实体标识不能为空");
    this._id = id;
  }

  public get id(): TId {
    return this._id;
  }

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

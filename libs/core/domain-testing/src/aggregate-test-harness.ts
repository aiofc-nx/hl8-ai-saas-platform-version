import type {
  AggregateId,
  AggregateRootBase,
} from "@hl8/domain-base";
import type { DomainEventBase } from "@hl8/domain-base";

/**
 * @public
 * @description 聚合根测试基座，封装常用操作与断言辅助方法。
 * @typeParam TId - 聚合标识类型，必须继承自 `AggregateId`。
 * @typeParam TAggregate - 聚合根类型，必须继承自 `AggregateRootBase<TId>`。
 * @example
 * ```ts
 * const harness = new AggregateTestHarness(aggregate);
 * harness.act((instance) => instance.restore(null));
 * ```
 */
export class AggregateTestHarness<
  TId extends AggregateId,
  TAggregate extends AggregateRootBase<TId>,
> {
  /**
   * @description 创建聚合测试基座。
   * @param aggregate - 需要包裹的聚合根实例。
   * @returns 新的 `AggregateTestHarness` 实例。
   * @example
   * ```ts
   * const harness = new AggregateTestHarness(aggregate);
   * ```
   */
  public constructor(private readonly aggregate: TAggregate) {}

  /**
   * @description 执行聚合操作并返回当前测试基座。
   * @param action - 操作聚合的回调函数。
   * @returns 当前 `AggregateTestHarness` 实例，便于链式调用。
   * @example
   * ```ts
   * harness.act((aggregate) => aggregate.restore(null));
   * ```
   */
  public act(action: (aggregate: TAggregate) => void): this {
    action(this.aggregate);
    return this;
  }

  /**
   * @description 拉取聚合累积的领域事件。
   * @returns 聚合待发布的领域事件数组。
   * @example
   * ```ts
   * const events = harness.pullDomainEvents();
   * ```
   */
  public pullDomainEvents(): DomainEventBase[] {
    return this.aggregate.pullDomainEvents();
  }

  /**
   * @description 获取被测试的聚合实例。
   * @returns 当前聚合实例。
   * @example
   * ```ts
   * const aggregate = harness.instance;
   * ```
   */
  public get instance(): TAggregate {
    return this.aggregate;
  }
}


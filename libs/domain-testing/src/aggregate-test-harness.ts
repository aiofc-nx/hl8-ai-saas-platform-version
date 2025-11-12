import type {
  AggregateId,
  AggregateRootBase,
} from "@hl8/domain-core";
import type { DomainEventBase } from "@hl8/domain-core";

/**
 * @public
 * @remarks 聚合根测试基座，封装常用的操作与断言辅助。
 */
export class AggregateTestHarness<
  TId extends AggregateId,
  TAggregate extends AggregateRootBase<TId>,
> {
  public constructor(private readonly aggregate: TAggregate) {}

  /**
   * 执行聚合操作并返回当前测试基座。
   */
  public act(action: (aggregate: TAggregate) => void): this {
    action(this.aggregate);
    return this;
  }

  /**
   * 拉取聚合累积的领域事件。
   */
  public pullDomainEvents(): DomainEventBase[] {
    return this.aggregate.pullDomainEvents();
  }

  /**
   * 暴露聚合实例以便断言。
   */
  public get instance(): TAggregate {
    return this.aggregate;
  }
}


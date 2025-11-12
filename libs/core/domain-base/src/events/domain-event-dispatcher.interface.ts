import type { DomainEventBase } from "./domain-event.base.js";

/**
 * @public
 * @remarks 领域事件调度器接口，由应用层或基础设施实现。
 */
export interface DomainEventDispatcher {
  dispatch(events: DomainEventBase[]): Promise<void>;
}

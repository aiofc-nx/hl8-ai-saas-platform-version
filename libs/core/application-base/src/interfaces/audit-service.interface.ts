import type { Observable } from "rxjs";
import type { SecurityContext } from "./security-context.js";

/**
 * @public
 * @description 审计记录结构，描述命令或查询的执行信息。
 */
export interface AuditRecord<TResult = unknown> {
  /**
   * @description 租户标识。
   */
  readonly tenantId: string;
  /**
   * @description 执行人用户标识。
   */
  readonly userId: string;
  /**
   * @description 记录的动作名称，通常为命令或查询名称。
   */
  readonly action: string;
  /**
   * @description 输入载荷或上下文信息。
   */
  readonly payload?: Record<string, unknown>;
  /**
   * @description 执行结果快照，可用于追踪。
   */
  readonly result?: TResult;
  /**
   * @description 额外元数据，如请求 ID、客户端信息等。
   */
  readonly metadata?: Record<string, unknown>;
}

/**
 * @public
 * @description 审计服务接口，由基础设施层实现。
 */
export interface AuditService {
  /**
   * @description 追加一条审计记录。
   * @param context - 当前安全上下文。
   * @param record - 审计记录内容。
   */
  append<TResult = unknown>(
    context: SecurityContext,
    record: AuditRecord<TResult>,
  ): Promise<void> | Observable<void>;
}

import type { ClsStore } from "nestjs-cls";

/**
 * @description CLS 中用于存储租户上下文的标准结构
 */
export interface TenantClsStore extends ClsStore {
  /**
   * @description 当前请求所属租户标识
   */
  tenantId?: string;
  /**
   * @description 当前请求用户标识，便于日志审计
   */
  userId?: string;
  /**
   * @description 可选的租户快照信息，用于审计或策略判断
   */
  tenantSnapshot?: unknown;
}

/**
 * @fileoverview 空审计服务（测试替身）
 * @description 提供一个空的审计服务实现，主要用于单元测试和开发环境
 *
 * ## 业务规则
 *
 * ### 测试替身规则
 * - 不进行实际的审计记录写入
 * - 支持审计记录的记录和查询操作
 * - 查询操作返回空列表
 * - 支持多租户隔离
 *
 * ### 适用场景
 * - 单元测试：提供快速、隔离的审计服务环境
 * - 开发环境：简化本地开发设置，无需数据库
 */

import { Injectable } from "@nestjs/common";
import type {
  AuditService,
  AuditRecord,
  AuditQuery,
} from "./audit.interface.js";

/**
 * @description 空审计服务（测试替身）
 * @remarks 用于单元测试和开发环境的审计服务实现
 *
 * @example
 * ```typescript
 * // 创建空审计服务
 * const auditService = new NullAuditService();
 *
 * // 记录审计记录（不会实际写入）
 * await auditService.append(record);
 *
 * // 查询审计记录（返回空列表）
 * const records = await auditService.query(query);
 * ```
 */
@Injectable()
export class NullAuditService implements AuditService {
  /**
   * @description 追加审计记录
   * @remarks 不进行实际的审计记录写入，仅用于测试
   *
   * @param _record - 审计记录
   * @returns Promise<void>
   */
  async append(_record: AuditRecord): Promise<void> {
    // 不进行实际的审计记录写入
    return Promise.resolve();
  }

  /**
   * @description 查询审计记录
   * @remarks 返回空列表，仅用于测试
   *
   * @param _query - 查询条件
   * @returns Promise<AuditRecord[]> - 空列表
   */
  async query(_query: AuditQuery): Promise<AuditRecord[]> {
    // 返回空列表
    return Promise.resolve([]);
  }
}

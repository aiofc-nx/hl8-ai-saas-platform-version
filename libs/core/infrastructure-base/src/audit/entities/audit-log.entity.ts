/**
 * @fileoverview 审计日志实体定义
 * @description 定义审计日志的实体，用于持久化审计记录
 *
 * ## 业务规则
 *
 * ### 实体字段规则
 * - `auditId` 必须是 UUID，作为主键
 * - `tenantId` 必须是 UUID，用于多租户隔离
 * - `userId` 必须是 UUID，标识执行操作的用户
 * - `action` 必须是字符串，标识操作类型
 * - `payload` 存储操作的 JSON 内容
 * - `occurredAt` 记录操作发生的时间
 * - `metadata` 存储审计的额外元数据，如请求 ID、IP 地址等，可为空
 *
 * ### 索引规则
 * - `auditId` 作为主键
 * - `tenantId`、`userId`、`action`、`occurredAt` 分别作为普通索引，优化查询性能
 * - `payload` 支持全文索引（可选），用于全文搜索
 */

import { randomUUID } from "node:crypto";
import { Entity, PrimaryKey, Property, Index, type Opt } from "@mikro-orm/core";
import type { AuditRecord } from "../audit.interface.js";

/**
 * @description 审计日志实体
 * @remarks 表示业务操作产生的审计记录，用于合规要求、问题诊断和安全审计
 */
@Entity({ tableName: "audit_logs" })
@Index({ properties: ["tenantId"] })
@Index({ properties: ["userId"] })
@Index({ properties: ["action"] })
@Index({ properties: ["occurredAt"] })
export class AuditLogEntity {
  /**
   * @description 审计记录唯一标识
   * @remarks 使用 UUID 保证全局唯一
   */
  @PrimaryKey({ columnType: "uuid" })
  public auditId: string & Opt = randomUUID();

  /**
   * @description 租户标识
   * @remarks 审计记录所属的租户的唯一标识，用于多租户隔离
   */
  @Property({ columnType: "uuid" })
  public tenantId!: string;

  /**
   * @description 用户标识
   * @remarks 执行操作的用户唯一标识
   */
  @Property({ columnType: "uuid" })
  public userId!: string;

  /**
   * @description 操作类型
   * @remarks 操作的类型，如 create、update、delete 等
   */
  @Property({ columnType: "varchar", length: 100 })
  public action!: string;

  /**
   * @description 操作内容
   * @remarks 操作的详细信息，存储为 JSON 格式
   */
  @Property({ columnType: "jsonb" })
  public payload!: unknown;

  /**
   * @description 操作发生时间
   * @remarks 操作发生的时间戳
   */
  @Property({ columnType: "timestamptz" })
  public occurredAt: Date = new Date();

  /**
   * @description 审计元数据
   * @remarks 包含审计的额外信息，如请求 ID、IP 地址等，存储为 JSON 格式，可为空
   */
  @Property({ columnType: "jsonb", nullable: true })
  public metadata?: Record<string, unknown>;

  /**
   * @description 转换为 AuditRecord 接口
   * @remarks 将实体转换为公共接口，隐藏内部实现细节
   *
   * @returns AuditRecord - 审计记录接口
   */
  public toAuditRecord(): AuditRecord {
    return {
      auditId: this.auditId,
      tenantId: this.tenantId,
      userId: this.userId,
      action: this.action,
      payload: this.payload,
      occurredAt: this.occurredAt,
      metadata: this.metadata || {},
    };
  }
}

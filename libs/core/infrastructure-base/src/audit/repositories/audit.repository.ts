/**
 * @fileoverview 审计仓储实现
 * @description 基于 MikroORM 实现审计仓储，支持审计记录的插入和查询
 *
 * ## 业务规则
 *
 * ### 审计记录插入规则
 * - 必须包含租户标识、用户标识、操作类型、操作内容、时间戳
 * - 支持审计记录的批量插入
 * - 支持审计记录的异步插入
 *
 * ### 审计记录查询规则
 * - 支持按租户、用户、时间范围等条件查询
 * - 支持分页查询
 * - 支持全文搜索（payload）
 * - 必须包含租户标识，确保多租户隔离
 */

import { EntityManager, QueryOrder } from "@mikro-orm/core";
import { Inject, Injectable, Optional } from "@nestjs/common";
import { Logger } from "@hl8/logger";
import { AuditServiceException } from "../../exceptions/infrastructure-exception.js";
import type { AuditRecord, AuditQuery } from "../audit.interface.js";
import { AuditLogEntity } from "../entities/audit-log.entity.js";

type LoggerService = InstanceType<typeof Logger>;

/**
 * @description 审计仓储接口
 * @remarks 定义审计仓储的核心操作，包括审计记录的插入和查询
 */
export interface IAuditRepository {
  /**
   * @description 插入审计记录
   * @remarks 将审计记录插入到数据库
   *
   * @param record - 审计记录
   * @returns Promise<void>
   * @throws {AuditServiceException} 当审计记录插入失败时
   */
  insert(record: AuditRecord): Promise<void>;

  /**
   * @description 批量插入审计记录
   * @remarks 将多个审计记录批量插入到数据库
   *
   * @param records - 审计记录列表
   * @returns Promise<void>
   * @throws {AuditServiceException} 当审计记录插入失败时
   */
  insertBatch(records: AuditRecord[]): Promise<void>;

  /**
   * @description 查询审计记录
   * @remarks 根据查询条件查询审计记录
   *
   * @param query - 查询条件
   * @returns Promise<AuditRecord[]> - 审计记录列表
   * @throws {AuditServiceException} 当审计记录查询失败时
   */
  query(query: AuditQuery): Promise<AuditRecord[]>;
}

/**
 * @description 审计仓储实现
 * @remarks 基于 MikroORM 实现审计仓储，支持审计记录的插入和查询
 *
 * @example
 * ```typescript
 * // 注入审计仓储
 * constructor(private readonly auditRepository: AuditRepository) {}
 *
 * // 插入审计记录
 * await auditRepository.insert(record);
 *
 * // 查询审计记录
 * const records = await auditRepository.query(query);
 * ```
 */
@Injectable()
export class AuditRepository implements IAuditRepository {
  /**
   * @description 构造函数
   * @param em - MikroORM 实体管理器
   * @param logger - 日志服务（可选）
   */
  constructor(
    private readonly em: EntityManager,
    @Optional() @Inject(Logger) private readonly logger?: LoggerService,
  ) {}

  /**
   * @description 插入审计记录
   * @remarks 将审计记录插入到数据库
   *
   * @param record - 审计记录
   * @returns Promise<void>
   * @throws {AuditServiceException} 当审计记录插入失败时
   */
  async insert(record: AuditRecord): Promise<void> {
    try {
      // 转换为实体（使用 Object.assign 来设置只读属性）
      const entity = Object.assign(new AuditLogEntity(), {
        auditId: record.auditId,
        tenantId: record.tenantId,
        userId: record.userId,
        action: record.action,
        payload: record.payload,
        occurredAt: record.occurredAt,
        metadata: record.metadata,
      });

      // 持久化
      await this.em.persistAndFlush(entity);

      // 记录日志
      this.logger?.debug("审计记录已插入", {
        auditId: record.auditId,
        tenantId: record.tenantId,
        userId: record.userId,
        action: record.action,
      });
    } catch (error) {
      // 记录错误日志
      this.logger?.error(error as Error, {
        auditId: record.auditId,
        tenantId: record.tenantId,
        userId: record.userId,
        action: record.action,
      });

      // 抛出异常
      throw new AuditServiceException(
        `审计记录插入失败: ${(error as Error).message}`,
        "AUDIT_RECORD_INSERT_FAILED",
        {
          auditId: record.auditId,
          tenantId: record.tenantId,
          userId: record.userId,
          action: record.action,
        },
        error,
      );
    }
  }

  /**
   * @description 批量插入审计记录
   * @remarks 将多个审计记录批量插入到数据库
   *
   * @param records - 审计记录列表
   * @returns Promise<void>
   * @throws {AuditServiceException} 当审计记录插入失败时
   */
  async insertBatch(records: AuditRecord[]): Promise<void> {
    if (records.length === 0) {
      return;
    }

    try {
      // 转换为实体
      const entities = records.map((record) => {
        const entity = new AuditLogEntity();
        entity.auditId = record.auditId;
        entity.tenantId = record.tenantId;
        entity.userId = record.userId;
        entity.action = record.action;
        entity.payload = record.payload;
        entity.occurredAt = record.occurredAt;
        entity.metadata = record.metadata;
        return entity;
      });

      // 批量持久化
      await this.em.persistAndFlush(entities);

      // 记录日志
      this.logger?.debug("审计记录已批量插入", {
        recordCount: records.length,
      });
    } catch (error) {
      // 记录错误日志
      this.logger?.error(error as Error, {
        recordCount: records.length,
      });

      // 抛出异常
      throw new AuditServiceException(
        `审计记录批量插入失败: ${(error as Error).message}`,
        "AUDIT_RECORD_BATCH_INSERT_FAILED",
        {
          recordCount: records.length,
        },
        error,
      );
    }
  }

  /**
   * @description 查询审计记录
   * @remarks 根据查询条件查询审计记录
   *
   * @param query - 查询条件
   * @returns Promise<AuditRecord[]> - 审计记录列表
   * @throws {AuditServiceException} 当审计记录查询失败时
   */
  async query(query: AuditQuery): Promise<AuditRecord[]> {
    try {
      // 构建查询条件
      const where: {
        tenantId: string;
        userId?: string;
        action?: string;
        occurredAt?: object;
      } = {
        tenantId: query.tenantId, // 必须包含租户标识，确保多租户隔离
      };

      if (query.userId) {
        where.userId = query.userId;
      }

      if (query.action) {
        where.action = query.action;
      }

      if (query.startTime || query.endTime) {
        where.occurredAt = {};
        if (query.startTime) {
          where.occurredAt = { ...where.occurredAt, $gte: query.startTime };
        }
        if (query.endTime) {
          where.occurredAt = { ...where.occurredAt, $lte: query.endTime };
        }
      }

      // 获取仓储
      const repository = this.em.getRepository(AuditLogEntity);

      // 查询审计记录
      const entities = await repository.find(where, {
        orderBy: { occurredAt: QueryOrder.DESC }, // 按时间降序排列
        limit: query.limit ?? 100, // 默认限制 100 条
        offset: query.offset ?? 0, // 默认偏移 0
      });

      // 转换为 AuditRecord 接口
      return entities.map((entity) => entity.toAuditRecord());
    } catch (error) {
      // 记录错误日志
      this.logger?.error(error as Error, {
        tenantId: query.tenantId,
        userId: query.userId,
        action: query.action,
      });

      // 抛出异常
      throw new AuditServiceException(
        `审计记录查询失败: ${(error as Error).message}`,
        "AUDIT_RECORD_QUERY_FAILED",
        {
          tenantId: query.tenantId,
          userId: query.userId,
          action: query.action,
        },
        error,
      );
    }
  }
}

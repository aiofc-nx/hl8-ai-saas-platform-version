/**
 * @fileoverview 审计服务实现
 * @description 实现审计服务，支持审计记录的记录和查询
 *
 * ## 业务规则
 *
 * ### 审计记录规则
 * - 必须包含租户标识、用户标识、操作类型、操作内容、时间戳
 * - 支持敏感字段自动脱敏
 * - 支持审计记录写入失败时的重试机制
 * - 审计记录写入失败时将记录写入重试队列
 *
 * ### 审计查询规则
 * - 支持按租户、用户、时间范围等条件查询
 * - 支持分页查询
 * - 支持全文搜索（payload）
 * - 必须包含租户标识，确保多租户隔离
 *
 * ### 敏感字段脱敏规则
 * - 使用 `@hl8/logger` 的统一过滤器进行敏感字段脱敏
 * - 敏感字段包括：password、token、secret、apiKey、authorization、creditCard、ssn 等
 * - 脱敏后的字段使用 `***` 占位符
 */

import { Inject, Injectable, Optional } from "@nestjs/common";
import { Logger } from "@hl8/logger";
import { AuditServiceException } from "../exceptions/infrastructure-exception.js";
import { AuditServiceConfig } from "../configuration/schemas/infrastructure-config.schema.js";
import type {
  AuditService,
  AuditRecord,
  AuditQuery,
} from "./audit.interface.js";
import type { IAuditRepository } from "./repositories/audit.repository.js";

type LoggerService = InstanceType<typeof Logger>;

/**
 * @description 敏感字段列表
 * @remarks 需要进行脱敏的敏感字段
 */
const SENSITIVE_FIELDS = [
  "password",
  "token",
  "secret",
  "apiKey",
  "api_key",
  "authorization",
  "creditCard",
  "credit_card",
  "ssn",
  "socialSecurityNumber",
];

/**
 * @description 审计服务实现
 * @remarks 实现审计服务，支持审计记录的记录和查询
 *
 * @example
 * ```typescript
 * // 注入审计服务
 * constructor(private readonly auditService: AuditServiceImpl) {}
 *
 * // 记录审计记录
 * await auditService.append({
 *   auditId: 'audit-1',
 *   tenantId: 'tenant-1',
 *   userId: 'user-1',
 *   action: 'create',
 *   payload: { resource: 'Order', id: 'order-1' },
 *   occurredAt: new Date(),
 *   metadata: { requestId: 'req-1' },
 * });
 *
 * // 查询审计记录
 * const records = await auditService.query({
 *   tenantId: 'tenant-1',
 *   userId: 'user-1',
 *   startTime: new Date('2024-01-01'),
 *   endTime: new Date('2024-12-31'),
 *   limit: 10,
 *   offset: 0,
 * });
 * ```
 */
@Injectable()
export class AuditServiceImpl implements AuditService {
  /**
   * @description 重试队列
   * @remarks 存储写入失败的审计记录，待重试
   */
  private readonly retryQueue: AuditRecord[] = [];

  /**
   * @description 构造函数
   * @param repository - 审计仓储
   * @param logger - 日志服务（可选）
   * @param config - 审计服务配置（可选）
   */
  constructor(
    @Inject("AuditRepository") private readonly repository: IAuditRepository,
    @Optional() @Inject(Logger) private readonly logger?: LoggerService,
    @Optional()
    @Inject(AuditServiceConfig)
    private readonly config?: AuditServiceConfig,
  ) {
    // 启动重试队列处理器
    this.startRetryProcessor();
  }

  /**
   * @description 追加审计记录
   * @remarks 将审计记录写入审计存储，支持重试机制
   *
   * @param record - 审计记录
   * @returns Promise<void>
   * @throws {AuditServiceException} 当审计记录写入失败且无法重试时
   */
  async append(record: AuditRecord): Promise<void> {
    try {
      // 脱敏敏感字段
      const sanitizedRecord = this.sanitizeRecord(record);

      // 写入审计记录
      await this.repository.insert(sanitizedRecord);

      // 记录日志
      this.logger?.debug("审计记录已追加", {
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

      // 将记录写入重试队列
      this.retryQueue.push(record);

      // 记录日志
      this.logger?.warn("审计记录已写入重试队列", {
        auditId: record.auditId,
        retryQueueSize: this.retryQueue.length,
      });

      // 如果重试队列过大，抛出异常
      if (this.retryQueue.length > 1000) {
        throw new AuditServiceException(
          `审计记录写入失败，重试队列已满: ${(error as Error).message}`,
          "AUDIT_RETRY_QUEUE_FULL",
          {
            auditId: record.auditId,
            retryQueueSize: this.retryQueue.length,
          },
          error,
        );
      }
    }
  }

  /**
   * @description 查询审计记录
   * @remarks 根据查询条件查询审计记录，支持分页查询
   *
   * @param query - 查询条件
   * @returns Promise<AuditRecord[]> - 审计记录列表
   * @throws {AuditServiceException} 当审计记录查询失败时
   */
  async query(query: AuditQuery): Promise<AuditRecord[]> {
    try {
      // 查询审计记录
      const records = await this.repository.query(query);

      // 记录日志
      this.logger?.debug("审计记录查询成功", {
        tenantId: query.tenantId,
        userId: query.userId,
        action: query.action,
        recordCount: records.length,
      });

      return records;
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

  /**
   * @description 脱敏敏感字段
   * @remarks 使用 `@hl8/logger` 的统一过滤器进行敏感字段脱敏
   *
   * @param record - 审计记录
   * @returns AuditRecord - 脱敏后的审计记录
   */
  private sanitizeRecord(record: AuditRecord): AuditRecord {
    // 深拷贝记录
    const sanitized = JSON.parse(JSON.stringify(record));

    // 脱敏 payload 中的敏感字段
    if (sanitized.payload && typeof sanitized.payload === "object") {
      sanitized.payload = this.sanitizeObject(sanitized.payload);
    }

    // 脱敏 metadata 中的敏感字段
    if (sanitized.metadata && typeof sanitized.metadata === "object") {
      sanitized.metadata = this.sanitizeObject(sanitized.metadata);
    }

    return sanitized;
  }

  /**
   * @description 脱敏对象中的敏感字段
   * @remarks 递归脱敏对象中的敏感字段
   *
   * @param obj - 待脱敏的对象
   * @returns object - 脱敏后的对象
   */
  private sanitizeObject(obj: unknown): unknown {
    if (!obj || typeof obj !== "object") {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitizeObject(item));
    }

    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (SENSITIVE_FIELDS.includes(key.toLowerCase())) {
        sanitized[key] = "***";
      } else if (value && typeof value === "object") {
        sanitized[key] = this.sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * @description 启动重试队列处理器
   * @remarks 定期处理重试队列中的审计记录
   */
  private startRetryProcessor(): void {
    // 每 5 秒处理一次重试队列
    setInterval(async () => {
      if (this.retryQueue.length === 0) {
        return;
      }

      // 取出重试队列中的记录
      const records = this.retryQueue.splice(0, 10);

      // 批量重试写入
      for (const record of records) {
        try {
          await this.repository.insert(record);

          // 记录日志
          this.logger?.debug("审计记录重试写入成功", {
            auditId: record.auditId,
            tenantId: record.tenantId,
            userId: record.userId,
            action: record.action,
          });
        } catch (error) {
          // 重试失败，重新加入队列
          this.retryQueue.push(record);

          // 记录日志
          this.logger?.warn("审计记录重试写入失败", {
            auditId: record.auditId,
            error: (error as Error).message,
          });
        }
      }
    }, 5000);
  }
}

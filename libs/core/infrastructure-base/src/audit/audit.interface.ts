/**
 * @fileoverview 审计服务接口
 * @description 定义审计服务的接口规范，支持审计记录的记录和查询
 *
 * ## 业务规则
 *
 * ### 审计记录规则
 * - 必须包含租户标识、用户标识、操作类型、操作内容、时间戳
 * - 支持审计记录的查询和归档
 * - 支持敏感字段自动脱敏
 * - 支持审计记录写入失败时的重试机制
 *
 * ### 审计查询规则
 * - 支持按租户、用户、时间范围等条件查询
 * - 支持分页查询
 * - 支持全文搜索（payload）
 */

/**
 * @description 审计记录接口
 * @remarks 定义审计记录的数据结构
 */
export interface AuditRecord {
  /**
   * @description 审计记录唯一标识
   * @remarks 使用 UUID 确保全局唯一性
   */
  readonly auditId: string;

  /**
   * @description 租户标识
   * @remarks 审计记录所属的租户的唯一标识，用于多租户隔离
   */
  readonly tenantId: string;

  /**
   * @description 用户标识
   * @remarks 执行操作的用户唯一标识
   */
  readonly userId: string;

  /**
   * @description 操作类型
   * @remarks 操作的类型，如 create、update、delete 等
   */
  readonly action: string;

  /**
   * @description 操作内容
   * @remarks 操作的详细信息，可以是任何 JSON 兼容的结构
   */
  readonly payload: unknown;

  /**
   * @description 操作发生时间
   * @remarks 操作发生的时间戳
   */
  readonly occurredAt: Date;

  /**
   * @description 审计元数据
   * @remarks 包含审计的额外信息，如请求 ID、IP 地址等，可为空
   */
  readonly metadata?: Record<string, unknown>;
}

/**
 * @description 审计查询条件接口
 * @remarks 定义审计记录查询的条件
 */
export interface AuditQuery {
  /**
   * @description 租户标识
   * @remarks 必须提供，用于多租户隔离
   */
  readonly tenantId: string;

  /**
   * @description 用户标识
   * @remarks 可选，用于过滤特定用户的审计记录
   */
  readonly userId?: string;

  /**
   * @description 操作类型
   * @remarks 可选，用于过滤特定操作类型的审计记录
   */
  readonly action?: string;

  /**
   * @description 开始时间
   * @remarks 可选，用于过滤指定时间范围之后的审计记录
   */
  readonly startTime?: Date;

  /**
   * @description 结束时间
   * @remarks 可选，用于过滤指定时间范围之前的审计记录
   */
  readonly endTime?: Date;

  /**
   * @description 查询限制
   * @remarks 可选，用于限制返回的审计记录数量
   */
  readonly limit?: number;

  /**
   * @description 查询偏移
   * @remarks 可选，用于分页查询
   */
  readonly offset?: number;
}

/**
 * @description 审计服务接口
 * @remarks 定义审计服务的核心操作，包括审计记录的记录和查询
 *
 * @example
 * ```typescript
 * // 注入审计服务
 * constructor(private readonly auditService: AuditService) {}
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
export interface AuditService {
  /**
   * @description 追加审计记录
   * @remarks 将审计记录写入审计存储，支持重试机制
   *
   * ## 业务规则
   * - 审计记录必须包含租户标识、用户标识、操作类型、操作内容、时间戳
   * - 支持敏感字段自动脱敏
   * - 支持审计记录写入失败时的重试机制
   * - 审计记录写入失败时将记录写入重试队列
   *
   * @param record - 审计记录
   * @returns Promise<void>
   * @throws {AuditServiceException} 当审计记录写入失败且无法重试时
   *
   * @example
   * ```typescript
   * await auditService.append({
   *   auditId: 'audit-1',
   *   tenantId: 'tenant-1',
   *   userId: 'user-1',
   *   action: 'create',
   *   payload: { resource: 'Order', id: 'order-1' },
   *   occurredAt: new Date(),
   *   metadata: { requestId: 'req-1' },
   * });
   * ```
   */
  append(record: AuditRecord): Promise<void>;

  /**
   * @description 查询审计记录
   * @remarks 根据查询条件查询审计记录，支持分页查询
   *
   * ## 业务规则
   * - 支持按租户、用户、时间范围等条件查询
   * - 支持分页查询
   * - 支持全文搜索（payload）
   * - 必须包含租户标识，确保多租户隔离
   *
   * @param query - 查询条件
   * @returns Promise<AuditRecord[]> - 审计记录列表
   * @throws {AuditServiceException} 当审计记录查询失败时
   *
   * @example
   * ```typescript
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
  query(query: AuditQuery): Promise<AuditRecord[]>;
}

/**
 * @fileoverview 事件快照服务
 * @description 实现事件快照的创建和加载，减少聚合重建时的事件重放次数
 *
 * ## 业务规则
 *
 * ### 快照创建规则
 * - 快照必须包含聚合在某个版本的状态
 * - 快照必须包含租户标识，确保多租户隔离
 * - 快照版本必须 >= 1
 * - 快照用于减少聚合重建时的事件重放次数
 *
 * ### 快照加载规则
 * - 必须支持按聚合标识和租户标识加载快照
 * - 必须支持加载指定版本之前的最近快照
 * - 必须确保租户隔离，防止跨租户数据访问
 *
 * ### 快照使用规则
 * - 快照用于减少事件重放次数
 * - 如果存在快照，从快照版本开始重放事件
 * - 如果不存在快照，从版本 1 开始重放事件
 */

import { EntityManager, QueryOrder } from "@mikro-orm/core";
import { Inject, Injectable, Optional } from "@nestjs/common";
import { Logger } from "@hl8/logger";
import { EventSnapshotEntity } from "../entities/event-snapshot.entity.js";

type LoggerService = InstanceType<typeof Logger>;

/**
 * @description 快照信息
 * @remarks 表示快照的基本信息
 */
export interface SnapshotInfo {
  /**
   * @description 快照标识
   */
  readonly snapshotId: string;

  /**
   * @description 聚合标识
   */
  readonly aggregateId: string;

  /**
   * @description 租户标识
   */
  readonly tenantId: string;

  /**
   * @description 快照版本号
   */
  readonly version: number;

  /**
   * @description 快照内容
   */
  readonly payload: unknown;

  /**
   * @description 快照创建时间
   */
  readonly createdAt: Date;
}

/**
 * @description 事件快照服务
 * @remarks 实现事件快照的创建和加载，减少聚合重建时的事件重放次数
 *
 * @example
 * ```typescript
 * // 创建快照
 * await snapshotService.createSnapshot({
 *   aggregateId: 'aggregate-1',
 *   tenantId: 'tenant-1',
 *   version: 10,
 *   payload: { state: { name: 'John', age: 30 } },
 * });
 *
 * // 加载快照
 * const snapshot = await snapshotService.loadSnapshot(
 *   'aggregate-1',
 *   'tenant-1',
 *   10,
 * );
 * ```
 */
@Injectable()
export class SnapshotService {
  /**
   * @description 构造函数
   * @param em - MikroORM EntityManager
   * @param logger - 日志服务
   */
  constructor(
    private readonly em: EntityManager,
    @Optional() @Inject(Logger) private readonly logger?: LoggerService,
  ) {}

  /**
   * @description 创建快照
   * @remarks 创建聚合在某个版本的状态快照
   *
   * @param aggregateId - 聚合标识
   * @param tenantId - 租户标识
   * @param version - 快照版本号
   * @param payload - 快照内容
   * @returns 快照信息
   * @throws {Error} 当快照创建失败时
   */
  async createSnapshot(
    aggregateId: string,
    tenantId: string,
    version: number,
    payload: unknown,
  ): Promise<SnapshotInfo> {
    try {
      // 创建快照实体
      const snapshot = new EventSnapshotEntity();
      snapshot.aggregateId = aggregateId;
      snapshot.tenantId = tenantId;
      snapshot.version = version;
      snapshot.payload = payload;
      snapshot.createdAt = new Date();

      // 持久化快照
      this.em.persist(snapshot);
      await this.em.flush();

      // 记录日志
      this.logger?.debug("快照已创建", {
        snapshotId: snapshot.snapshotId,
        aggregateId,
        tenantId,
        version,
      });

      // 返回快照信息
      return {
        snapshotId: snapshot.snapshotId,
        aggregateId: snapshot.aggregateId,
        tenantId: snapshot.tenantId,
        version: snapshot.version,
        payload: snapshot.payload,
        createdAt: snapshot.createdAt,
      };
    } catch (error) {
      // 记录错误日志
      this.logger?.error(error as Error, {
        aggregateId,
        tenantId,
        version,
      });

      // 抛出异常
      throw new Error(`快照创建失败: ${(error as Error).message}`);
    }
  }

  /**
   * @description 加载快照
   * @remarks 加载指定聚合和租户的快照，支持加载指定版本之前的最近快照
   *
   * @param aggregateId - 聚合标识
   * @param tenantId - 租户标识
   * @param maxVersion - 最大版本号，加载该版本之前的最近快照（可选）
   * @returns 快照信息，如果不存在则返回 null
   * @throws {Error} 当快照加载失败时
   */
  async loadSnapshot(
    aggregateId: string,
    tenantId: string,
    maxVersion?: number,
  ): Promise<SnapshotInfo | null> {
    try {
      // 获取仓储
      const repository = this.em.getRepository(EventSnapshotEntity);

      // 构建查询条件
      const where: Record<string, unknown> = {
        aggregateId,
        tenantId, // 确保租户隔离
      };

      // 如果指定了最大版本号，加载该版本之前的最近快照
      if (maxVersion !== undefined) {
        where.version = { $lte: maxVersion };
      }

      // 查询快照，按版本降序排列，取第一个
      const snapshot = await repository.findOne(where, {
        orderBy: { version: QueryOrder.DESC },
      });

      // 如果不存在快照，返回 null
      if (!snapshot) {
        return null;
      }

      // 返回快照信息
      return {
        snapshotId: snapshot.snapshotId,
        aggregateId: snapshot.aggregateId,
        tenantId: snapshot.tenantId,
        version: snapshot.version,
        payload: snapshot.payload,
        createdAt: snapshot.createdAt,
      };
    } catch (error) {
      // 记录错误日志
      this.logger?.error(error as Error, {
        aggregateId,
        tenantId,
        maxVersion,
      });

      // 抛出异常
      throw new Error(`快照加载失败: ${(error as Error).message}`);
    }
  }

  /**
   * @description 删除快照
   * @remarks 删除指定聚合和租户的快照
   *
   * @param aggregateId - 聚合标识
   * @param tenantId - 租户标识
   * @param version - 快照版本号（可选）
   * @returns 删除的快照数量
   * @throws {Error} 当快照删除失败时
   */
  async deleteSnapshot(
    aggregateId: string,
    tenantId: string,
    version?: number,
  ): Promise<number> {
    try {
      // 获取仓储
      const repository = this.em.getRepository(EventSnapshotEntity);

      // 构建查询条件
      const where: Record<string, unknown> = {
        aggregateId,
        tenantId, // 确保租户隔离
      };

      // 如果指定了版本号，删除指定版本的快照
      if (version !== undefined) {
        where.version = version;
      }

      // 删除快照
      const deletedCount = await repository.nativeDelete(where);

      // 记录日志
      this.logger?.debug("快照已删除", {
        aggregateId,
        tenantId,
        version,
        deletedCount,
      });

      // 返回删除的快照数量
      return deletedCount;
    } catch (error) {
      // 记录错误日志
      this.logger?.error(error as Error, {
        aggregateId,
        tenantId,
        version,
      });

      // 抛出异常
      throw new Error(`快照删除失败: ${(error as Error).message}`);
    }
  }
}

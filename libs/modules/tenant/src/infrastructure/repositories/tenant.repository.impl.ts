/**
 * @fileoverview 租户仓储实现
 * @description 基于 EventStore 和 MikroORM 实现租户聚合根的持久化
 *
 * ## 业务规则
 *
 * ### 事件存储规则
 * - 使用 EventStore 保存聚合的事件流
 * - 将领域事件转换为 StoredEvent 格式
 * - 支持乐观锁机制检测版本冲突
 * - 确保多租户数据隔离
 *
 * ### 聚合重建规则
 * - 从事件流重建聚合状态
 * - 按版本顺序重放事件
 * - 支持从快照开始重建（可选）
 *
 * ### 查询规则
 * - 所有查询自动添加租户过滤条件
 * - 默认排除软删除的聚合
 * - 支持按名称查询（用于唯一性校验）
 *
 * ## 使用示例
 *
 * ```typescript
 * const repository = new TenantRepositoryImpl(eventStore, em, logger);
 * await repository.save(tenant);
 * const found = await repository.findById(tenantId);
 * ```
 */

import type { EntityManager } from "@mikro-orm/core";
import { Inject, Injectable } from "@nestjs/common";
import { getEntityManagerToken } from "@hl8/mikro-orm-nestjs";
import type { RepositoryFindByCriteria } from "@hl8/domain-base";
import {
  AggregateId,
  DomainException,
  OrganizationId,
  UserId,
} from "@hl8/domain-base";
import type {
  EventStore,
  StoredEvent,
  SnapshotService,
  EventPublisher,
} from "@hl8/infrastructure-base";
import { AggregateReconstitution } from "@hl8/infrastructure-base";
import { Logger } from "@hl8/logger";
import { TenantAggregate } from "../../domains/tenant/aggregates/tenant.aggregate.js";
import type { TenantRepository } from "../../domains/tenant/repositories/tenant.repository.js";
import { TenantName } from "../../domains/tenant/value-objects/tenant-name.vo.js";
import { TenantContactInfo } from "../../domains/tenant/value-objects/tenant-contact-info.vo.js";
import { TenantContext } from "../../domains/tenant/value-objects/tenant-context.vo.js";
import { TenantProfile } from "../../domains/tenant/entities/tenant-profile.entity.js";
import { TenantProjection } from "../projections/tenant.projection.js";

type LoggerService = InstanceType<typeof Logger>;

/**
 * 租户仓储实现
 *
 * @description 基于 EventStore 实现租户聚合根的持久化
 */
@Injectable()
export class TenantRepositoryImpl implements TenantRepository {
  /**
   * 构造函数
   *
   * @param eventStore - 事件存储服务
   * @param snapshotService - 快照服务（可选）
   * @param eventPublisher - 事件发布服务（用于发布领域事件到事件总线）
   * @param em - MikroORM EntityManager（用于查询读模型）
   * @param logger - 日志服务
   */
  constructor(
    @Inject("EventStore")
    private readonly eventStore: EventStore,
    @Inject("SnapshotService")
    private readonly snapshotService: SnapshotService | null,
    @Inject("EventPublisher")
    private readonly eventPublisher: EventPublisher,
    @Inject(getEntityManagerToken("postgres"))
    private readonly em: EntityManager,
    private readonly logger: LoggerService,
  ) {}

  /**
   * 根据ID查询租户
   *
   * @param id - 租户聚合ID
   * @returns 如果找到返回租户聚合根，否则返回 null
   */
  async findById(id: AggregateId): Promise<TenantAggregate | null> {
    try {
      // 1. 从 EventStore 加载事件流
      const events: StoredEvent[] = [];
      for await (const event of this.eventStore.loadSince(
        id.toString(),
        id.toString(), // 租户的 tenantId 等于其 id
        1,
      )) {
        events.push(event);
      }

      if (events.length === 0) {
        // 没有事件，聚合不存在
        return null;
      }

      // 2. 使用 AggregateReconstitution 从事件列表重建聚合
      // 注意：这里需要将 StoredEvent 转换为领域事件，然后应用到聚合
      // 由于 TenantAggregate 没有静态的 reconstitute 方法，我们需要手动重建
      const result = await AggregateReconstitution.reconstituteFromEvents(
        events,
        this.createEventHandler(),
        null as TenantAggregate | null,
      );

      // 3. 返回重建的聚合
      return result.state;
    } catch (error: unknown) {
      this.logger.error(
        error instanceof Error ? error : new Error(String(error)),
        {
          aggregateId: id.toString(),
        },
      );
      return null;
    }
  }

  /**
   * 创建事件处理器，用于从事件重建聚合状态
   *
   * @returns 事件处理器函数
   */
  private createEventHandler(): (
    state: TenantAggregate | null,
    event: StoredEvent,
  ) => TenantAggregate | Promise<TenantAggregate> {
    return (state: TenantAggregate | null, event: StoredEvent) => {
      // 从事件元数据获取事件类型
      const eventType = event.metadata?.eventName as string | undefined;
      if (!eventType) {
        throw new DomainException(
          `事件缺少 eventName 元数据: ${event.eventId}`,
        );
      }

      // 解析事件载荷
      const payload = event.payload as Record<string, unknown>;

      // 根据事件类型应用事件
      switch (eventType) {
        case "TenantCreatedEvent": {
          // 从 TenantCreatedEvent 创建聚合
          // 注意：事件载荷中存储的是序列化后的值对象和实体
          // 需要从序列化数据重建值对象
          const tenantName = payload.tenantName as string;
          const contactInfoData = payload.contactInfo as {
            contactName: string;
            email: string;
            phone?: string | null;
          };
          const contextData = payload.context as {
            defaultOrganizationId: string;
            defaultTimezone: string;
            currency?: string | null;
          };
          const profileData = payload.profile as
            | {
                legalName?: string | null;
                registrationCode?: string | null;
                industry?: string | null;
              }
            | undefined;

          const userId =
            event.metadata?.triggeredBy &&
            typeof event.metadata.triggeredBy === "string"
              ? UserId.create(event.metadata.triggeredBy)
              : null;

          return TenantAggregate.create({
            tenantName: TenantName.create(tenantName),
            contactInfo: TenantContactInfo.create(contactInfoData),
            context: TenantContext.create({
              defaultOrganizationId: OrganizationId.create(
                contextData.defaultOrganizationId,
              ),
              defaultTimezone: contextData.defaultTimezone,
              currency: contextData.currency,
            }),
            profile: profileData
              ? TenantProfile.create(profileData)
              : undefined,
            createdBy: userId,
          });
        }

        case "TenantActivatedEvent":
        case "TenantSuspendedEvent":
        case "TenantArchivedEvent":
        case "TenantProfileUpdatedEvent": {
          // 对于后续事件，需要应用到现有聚合
          if (!state) {
            throw new DomainException(
              `无法应用事件 ${eventType}：聚合状态为空`,
            );
          }

          // 根据事件类型调用聚合方法
          const userId =
            event.metadata?.triggeredBy &&
            typeof event.metadata.triggeredBy === "string"
              ? UserId.create(event.metadata.triggeredBy)
              : null;

          if (eventType === "TenantActivatedEvent") {
            state.activate(userId ?? UserId.create("system"));
          } else if (eventType === "TenantSuspendedEvent") {
            state.deactivate(userId ?? UserId.create("system"));
          } else if (eventType === "TenantArchivedEvent") {
            state.archive(userId ?? UserId.create("system"));
          } else if (eventType === "TenantProfileUpdatedEvent") {
            // 从事件载荷获取档案数据
            const profileData = payload.profile as {
              legalName?: string | null;
              registrationCode?: string | null;
              industry?: string | null;
            };
            state.updateProfile({
              legalName: profileData.legalName,
              registrationCode: profileData.registrationCode,
              industry: profileData.industry,
              updatedBy: userId,
            });
          }

          return state;
        }

        default:
          throw new DomainException(`未知的事件类型: ${eventType}`);
      }
    };
  }

  /**
   * 根据条件查询租户
   *
   * @description 根据指定的查询条件查找符合条件的租户聚合根
   * 实现策略：
   * 1. 从读模型（TenantProjection）查询符合条件的聚合ID
   * 2. 对每个ID调用 findById 重建聚合
   * 3. 返回聚合数组
   *
   * @param criteria - 查询条件
   * @returns 符合条件的租户聚合根数组
   *
   * @example
   * ```typescript
   * const tenants = await repository.findBy({
   *   tenantId: TenantId.create("tenant-1"),
   *   includeDeleted: false,
   * });
   * ```
   */
  async findBy(
    criteria: RepositoryFindByCriteria<AggregateId>,
  ): Promise<TenantAggregate[]> {
    try {
      // 1. 从读模型查询符合条件的聚合ID
      const where: Record<string, unknown> = {
        tenantId: criteria.tenantId.toString(),
      };

      // 软删除过滤
      if (!criteria.includeDeleted) {
        where.isDeleted = false;
      }

      // 组织过滤（如果指定）
      if (criteria.organizationId) {
        where.defaultOrganizationId = criteria.organizationId.toString();
      }

      // 部门过滤（租户聚合不直接包含部门ID，但可以通过组织ID间接过滤）
      // 注意：租户聚合本身不包含部门ID，所以部门过滤在这里不适用
      // 如果需要按部门过滤，应该在应用层通过组织查询实现

      // 查询读模型
      const projections = await this.em.find(TenantProjection, where);

      if (projections.length === 0) {
        this.logger.debug("未找到符合条件的租户", {
          criteria,
          count: 0,
        });
        return [];
      }

      this.logger.debug("从读模型查询到符合条件的租户", {
        criteria,
        count: projections.length,
      });

      // 2. 对每个ID调用 findById 重建聚合
      const aggregates: TenantAggregate[] = [];
      for (const projection of projections) {
        try {
          const aggregateId = AggregateId.fromString(projection.tenantId);
          const aggregate = await this.findById(aggregateId);

          if (aggregate) {
            aggregates.push(aggregate);
          } else {
            this.logger.warn("无法重建租户聚合", {
              tenantId: projection.tenantId,
              tenantName: projection.tenantName,
            });
          }
        } catch (error) {
          const errorObj =
            error instanceof Error ? error : new Error(String(error));
          this.logger.error(errorObj, {
            tenantId: projection.tenantId,
            tenantName: projection.tenantName,
          });
          // 继续处理下一个，不中断整个查询
        }
      }

      this.logger.debug("成功重建租户聚合", {
        criteria,
        foundCount: projections.length,
        rebuiltCount: aggregates.length,
      });

      // 3. 返回聚合数组
      return aggregates;
    } catch (error) {
      const errorObj =
        error instanceof Error ? error : new Error(String(error));
      this.logger.error(errorObj, {
        criteria,
      });
      throw new DomainException(`查询租户失败: ${errorObj.message}`);
    }
  }

  /**
   * 保存租户聚合
   *
   * @description 将租户聚合的领域事件保存到 EventStore，并发布到事件总线
   * 采用事件溯源模式，只保存事件流，不直接保存聚合状态
   * 事件发布失败不会影响聚合保存，采用最终一致性策略
   *
   * @param aggregate - 租户聚合根
   *
   * @throws {Error} 当事件存储失败时抛出（事件发布失败不会抛出异常，仅记录日志）
   *
   * @example
   * ```typescript
   * const tenant = TenantAggregate.create({ ... });
   * await repository.save(tenant);
   * ```
   */
  async save(aggregate: TenantAggregate): Promise<void> {
    // 获取未提交的领域事件
    const domainEvents = aggregate.pullDomainEvents();

    if (domainEvents.length === 0) {
      // 没有新事件，无需保存
      return;
    }

    // 将领域事件转换为 StoredEvent
    const storedEvents: StoredEvent[] = domainEvents.map((event, index) => {
      const currentVersion = aggregate.version + index + 1;

      return {
        eventId: event.eventId,
        aggregateId: aggregate.id.toString(),
        tenantId: aggregate.tenantId.toString(),
        version: currentVersion,
        payload: this.serializeEvent(event),
        occurredAt: event.occurredAt.toJSDate(),
        metadata: {
          eventName: event.eventName(),
          organizationId: aggregate.organizationId?.toString(),
          departmentId: aggregate.departmentId?.toString(),
          triggeredBy: event.triggeredBy?.toString(),
        },
      };
    });

    // 保存事件到 EventStore
    await this.eventStore.append(storedEvents);

    // 发布领域事件到事件总线（异步，失败不影响事务）
    // 注意：事件发布失败不会影响聚合保存，采用最终一致性策略
    try {
      await this.eventPublisher.publish(storedEvents);
      this.logger.debug("租户领域事件已发布", {
        aggregateId: aggregate.id.toString(),
        tenantId: aggregate.tenantId.toString(),
        eventCount: domainEvents.length,
      });
    } catch (error: unknown) {
      // 事件发布失败不影响聚合保存，记录错误并异步重试
      this.logger.error(
        error instanceof Error
          ? error
          : new Error("租户领域事件发布失败，将异步重试"),
        {
          aggregateId: aggregate.id.toString(),
          tenantId: aggregate.tenantId.toString(),
          eventCount: domainEvents.length,
        },
      );

      // TODO: 实现异步重试机制（如使用消息队列或后台任务）
      // 可以将失败的事件放入重试队列，由后台任务定期重试
      // 确保最终一致性
    }

    // 更新聚合版本号
    // 注意：这里需要在聚合根中添加更新版本的方法
    // aggregate.updateVersion(aggregate.version + domainEvents.length);

    this.logger.debug("租户聚合已保存", {
      aggregateId: aggregate.id.toString(),
      tenantId: aggregate.tenantId.toString(),
      eventCount: domainEvents.length,
    });
  }

  /**
   * 删除租户聚合
   *
   * @description 硬删除租户聚合（当前不支持）
   * 租户管理采用软删除策略，应使用归档（archive）操作而非硬删除
   *
   * @param _id - 租户聚合ID（当前未使用）
   *
   * @throws {DomainException} 始终抛出异常，提示应使用归档操作
   *
   * @example
   * ```typescript
   * // 错误用法（会抛出异常）
   * await repository.delete(tenantId);
   *
   * // 正确用法
   * await commandBus.execute(new ArchiveTenantCommand(...));
   * ```
   */
  async delete(_id: AggregateId): Promise<void> {
    // TODO: 实现硬删除（如果需要）
    // 注意：通常使用软删除（archive），而不是硬删除
    throw new DomainException(
      "租户聚合不支持硬删除，请使用归档（archive）操作",
    );
  }

  /**
   * 根据租户名称查询租户
   *
   * @description 通过租户名称查找对应的租户聚合根
   * 首先从读模型（TenantProjection）查询名称对应的聚合ID，然后重建聚合
   * 租户名称在平台级别应保持唯一
   *
   * @param name - 租户名称值对象
   * @param _tenantId - 租户ID（用于多租户隔离，但租户名称应在平台级别唯一，当前未使用）
   * @returns 如果找到返回租户聚合根，否则返回 null
   *
   * @example
   * ```typescript
   * const tenantName = TenantName.create("ABC公司");
   * const tenant = await repository.findByName(tenantName, tenantId);
   * ```
   */
  async findByName(
    name: TenantName,
    _tenantId: AggregateId,
  ): Promise<TenantAggregate | null> {
    // 1. 从读模型查询租户名称对应的聚合ID
    // 注意：租户名称应在平台级别唯一，但查询时仍需要考虑租户隔离
    const projection = await this.em.findOne(
      TenantProjection,
      {
        tenantName: name.value,
        isDeleted: false, // 排除已归档的租户
      },
      {
        // 注意：这里可能需要根据实际的多租户策略调整
        // 如果租户名称在平台级别唯一，则不需要 tenantId 过滤
        // 如果需要租户隔离，则添加 tenantId 过滤
      },
    );

    if (!projection) {
      return null;
    }

    // 2. 调用 findById 重建聚合
    const aggregateId = AggregateId.fromString(projection.tenantId);
    return this.findById(aggregateId);
  }

  /**
   * 序列化领域事件为可存储格式
   *
   * @description 将领域事件转换为可存储的 JSON 格式
   * 值对象和实体会被序列化为普通对象，包含其内部属性
   * 使用自定义序列化逻辑，提取值对象的 props 属性，确保序列化后的数据可以正确反序列化
   *
   * @param event - 领域事件对象，包含 payload 属性
   * @returns 序列化后的事件载荷（仅包含 payload 部分，值对象已提取 props）
   *
   * @example
   * ```typescript
   * const serialized = this.serializeEvent(domainEvent);
   * // 返回: { tenantName: "...", contactInfo: { contactName: "...", ... }, ... }
   * ```
   */
  private serializeEvent(event: unknown): unknown {
    // 事件对象包含 payload 属性，我们需要序列化 payload
    if (event && typeof event === "object" && "payload" in event) {
      const eventObj = event as { payload: unknown };
      const payload = eventObj.payload as Record<string, unknown>;

      // 创建新的载荷对象，提取值对象的 props
      const serializedPayload: Record<string, unknown> = {};

      // 处理 tenantName（字符串）
      if ("tenantName" in payload) {
        serializedPayload.tenantName = payload.tenantName;
      }

      // 处理 contactInfo 值对象
      if ("contactInfo" in payload && payload.contactInfo) {
        const contactInfo = payload.contactInfo as { props?: unknown };
        if (contactInfo.props) {
          serializedPayload.contactInfo = contactInfo.props;
        } else {
          // 如果没有 props，可能是已经序列化的对象
          serializedPayload.contactInfo = contactInfo;
        }
      }

      // 处理 context 值对象
      if ("context" in payload && payload.context) {
        const context = payload.context as { props?: unknown };
        if (context.props) {
          serializedPayload.context = context.props;
        } else {
          serializedPayload.context = context;
        }
      }

      // 处理 profile 实体
      if ("profile" in payload && payload.profile) {
        const profile = payload.profile as { props?: unknown };
        if (profile.props) {
          serializedPayload.profile = profile.props;
        } else {
          serializedPayload.profile = profile;
        }
      }

      // 处理 status 值对象
      if ("status" in payload && payload.status) {
        const status = payload.status as {
          props?: { value?: unknown };
          value?: unknown;
        };
        if (status.props?.value !== undefined) {
          serializedPayload.status = status.props.value;
        } else if (status.value !== undefined) {
          serializedPayload.status = status.value;
        } else {
          serializedPayload.status = status;
        }
      }

      // 处理其他属性（如 previousStatus, currentStatus 等）
      for (const [key, value] of Object.entries(payload)) {
        if (
          ![
            "tenantName",
            "contactInfo",
            "context",
            "profile",
            "status",
          ].includes(key)
        ) {
          // 如果是值对象，提取 props
          if (value && typeof value === "object" && "props" in value) {
            const vo = value as { props?: unknown };
            serializedPayload[key] = vo.props ?? value;
          } else {
            serializedPayload[key] = value;
          }
        }
      }

      return serializedPayload;
    }

    // 如果不是标准事件格式，使用 JSON 序列化
    return JSON.parse(JSON.stringify(event));
  }
}

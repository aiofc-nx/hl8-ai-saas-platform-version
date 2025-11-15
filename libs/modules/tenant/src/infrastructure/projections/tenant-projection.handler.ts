/**
 * @fileoverview 租户投影处理器
 * @description 监听租户领域事件，更新读模型投影
 *
 * ## 业务规则
 *
 * ### 事件处理规则
 * - 监听 TenantCreatedEvent，创建读模型投影
 * - 监听 TenantActivatedEvent，更新状态
 * - 监听 TenantSuspendedEvent，更新状态
 * - 监听 TenantArchivedEvent，标记软删除
 * - 监听 TenantProfileUpdatedEvent，更新档案信息
 *
 * ### 读模型更新规则
 * - 读模型与写模型（事件流）最终一致
 * - 读模型更新失败不影响事件流
 * - 支持幂等性处理
 *
 * ## 使用示例
 *
 * ```typescript
 * // 事件处理器会自动注册到 NestJS CQRS EventBus
 * // 当 TenantCreatedEvent 发布时，会自动调用 onTenantCreated 方法
 * ```
 */

import { EventsHandler, IEventHandler } from "@nestjs/cqrs";
import { Inject, Injectable } from "@nestjs/common";
import type { EntityManager } from "@mikro-orm/core";
import { Logger } from "@hl8/logger";
import { getEntityManagerToken } from "@hl8/mikro-orm-nestjs";
import {
  TenantActivatedEvent,
  TenantArchivedEvent,
  TenantCreatedEvent,
  TenantProfileUpdatedEvent,
  TenantSuspendedEvent,
} from "../../domains/tenant/events/index.js";
import { TenantProjection } from "./tenant.projection.js";

type LoggerService = InstanceType<typeof Logger>;

/**
 * 租户投影处理器
 *
 * @description 监听租户领域事件，更新读模型投影
 */
@EventsHandler(
  TenantCreatedEvent,
  TenantActivatedEvent,
  TenantSuspendedEvent,
  TenantArchivedEvent,
  TenantProfileUpdatedEvent,
)
export class TenantProjectionHandler
  implements
    IEventHandler<
      | TenantCreatedEvent
      | TenantActivatedEvent
      | TenantSuspendedEvent
      | TenantArchivedEvent
      | TenantProfileUpdatedEvent
    >
{
  /**
   * 构造函数
   *
   * @param em - MikroORM EntityManager
   * @param logger - 日志服务
   */
  constructor(
    @Inject(getEntityManagerToken("postgres"))
    private readonly em: EntityManager,
    private readonly logger: LoggerService,
  ) {}

  /**
   * 处理租户创建事件
   *
   * @param event - 租户创建事件
   */
  async handle(
    event:
      | TenantCreatedEvent
      | TenantActivatedEvent
      | TenantSuspendedEvent
      | TenantArchivedEvent
      | TenantProfileUpdatedEvent,
  ): Promise<void> {
    if (event instanceof TenantCreatedEvent) {
      await this.onTenantCreated(event);
    } else if (event instanceof TenantActivatedEvent) {
      await this.onTenantActivated(event);
    } else if (event instanceof TenantSuspendedEvent) {
      await this.onTenantSuspended(event);
    } else if (event instanceof TenantArchivedEvent) {
      await this.onTenantArchived(event);
    } else if (event instanceof TenantProfileUpdatedEvent) {
      await this.onTenantProfileUpdated(event);
    }
  }

  /**
   * 处理租户创建事件
   *
   * @param event - 租户创建事件
   */
  private async onTenantCreated(event: TenantCreatedEvent): Promise<void> {
    const projection = new TenantProjection();
    projection.tenantId = event.aggregateId;
    projection.tenantName = event.tenantName;
    projection.status = event.status.value;
    projection.contactName = event.contactInfo.contactName;
    projection.email = event.contactInfo.email;
    projection.phone = event.contactInfo.phone ?? null;
    projection.defaultOrganizationId =
      event.context.defaultOrganizationId.toString();
    projection.defaultTimezone = event.context.defaultTimezone;
    projection.currency = event.context.currency ?? null;
    projection.legalName = event.profile?.legalName ?? null;
    projection.registrationCode = event.profile?.registrationCode ?? null;
    projection.industry = event.profile?.industry ?? null;
    projection.createdAt = event.occurredAt.toJSDate();
    projection.updatedAt = event.occurredAt.toJSDate();
    projection.isDeleted = false;

    await this.em.persistAndFlush(projection);

    this.logger.log("租户读模型投影已创建", {
      tenantId: event.aggregateId,
      tenantName: event.tenantName,
    });
  }

  /**
   * 处理租户激活事件
   *
   * @param event - 租户激活事件
   */
  private async onTenantActivated(event: TenantActivatedEvent): Promise<void> {
    const projection = await this.em.findOne(TenantProjection, {
      tenantId: event.aggregateId,
    });

    if (!projection) {
      this.logger.warn("租户投影不存在，无法更新", {
        tenantId: event.aggregateId,
      });
      return;
    }

    projection.status = event.currentStatus.value;
    projection.updatedAt = event.occurredAt.toJSDate();

    await this.em.flush();

    this.logger.log("租户读模型投影已更新（激活）", {
      tenantId: event.aggregateId,
    });
  }

  /**
   * 处理租户停用事件
   *
   * @param event - 租户停用事件
   */
  private async onTenantSuspended(event: TenantSuspendedEvent): Promise<void> {
    const projection = await this.em.findOne(TenantProjection, {
      tenantId: event.aggregateId,
    });

    if (!projection) {
      this.logger.warn("租户投影不存在，无法更新", {
        tenantId: event.aggregateId,
      });
      return;
    }

    projection.status = event.currentStatus.value;
    projection.updatedAt = event.occurredAt.toJSDate();

    await this.em.flush();

    this.logger.log("租户读模型投影已更新（停用）", {
      tenantId: event.aggregateId,
    });
  }

  /**
   * 处理租户归档事件
   *
   * @param event - 租户归档事件
   */
  private async onTenantArchived(event: TenantArchivedEvent): Promise<void> {
    const projection = await this.em.findOne(TenantProjection, {
      tenantId: event.aggregateId,
    });

    if (!projection) {
      this.logger.warn("租户投影不存在，无法更新", {
        tenantId: event.aggregateId,
      });
      return;
    }

    projection.status = "Archived";
    projection.isDeleted = true;
    projection.updatedAt = event.occurredAt.toJSDate();

    await this.em.flush();

    this.logger.log("租户读模型投影已更新（归档）", {
      tenantId: event.aggregateId,
    });
  }

  /**
   * 处理租户档案更新事件
   *
   * @param event - 租户档案更新事件
   */
  private async onTenantProfileUpdated(
    event: TenantProfileUpdatedEvent,
  ): Promise<void> {
    const projection = await this.em.findOne(TenantProjection, {
      tenantId: event.aggregateId,
    });

    if (!projection) {
      this.logger.warn("租户投影不存在，无法更新", {
        tenantId: event.aggregateId,
      });
      return;
    }

    projection.legalName = event.profile.legalName ?? null;
    projection.registrationCode = event.profile.registrationCode ?? null;
    projection.industry = event.profile.industry ?? null;
    projection.updatedAt = event.occurredAt.toJSDate();

    await this.em.flush();

    this.logger.log("租户读模型投影已更新（档案）", {
      tenantId: event.aggregateId,
    });
  }
}

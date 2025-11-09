import type { EventArgs, EventSubscriber, EntityName } from "@mikro-orm/core";
import { EntityManager } from "@mikro-orm/core";
import { InjectEntityManager } from "@mikro-orm/nestjs";
import { Injectable } from "@nestjs/common";
import { Logger } from "@hl8/logger";
import {
  GeneralForbiddenException,
  GeneralUnauthorizedException,
} from "@hl8/exceptions";
import { TenantContextExecutor } from "../tenant-context.executor.js";

/**
 * @description MikroORM 订阅器：在实体持久化前自动写入租户信息
 */
@Injectable()
export class TenantAwareSubscriber
  implements
    EventSubscriber<{
      tenantId?: string;
    }>
{
  constructor(
    private readonly tenantExecutor: TenantContextExecutor,
    private readonly logger: Logger,
    @InjectEntityManager("postgres")
    entityManager: EntityManager,
  ) {
    entityManager.getEventManager().registerSubscriber(this);
  }

  public getSubscribedEntities(): EntityName<{ tenantId?: string }>[] {
    return [];
  }

  public async beforeCreate(
    args: EventArgs<{ tenantId?: string }>,
  ): Promise<void> {
    const tenantId = this.tenantExecutor.getTenantIdOrFail();
    if (!tenantId) {
      throw new GeneralUnauthorizedException("缺少租户上下文");
    }

    if (!args.entity.tenantId) {
      args.entity.tenantId = tenantId;
      this.logger.debug("自动写入租户 ID", {
        entity: args.entity.constructor.name,
        tenantId,
      });
      return;
    }

    if (args.entity.tenantId !== tenantId) {
      this.logger.error("实体租户 ID 与上下文不一致", undefined, {
        entity: args.entity.constructor.name,
        expectedTenantId: tenantId,
        incomingTenantId: args.entity.tenantId,
      });
      throw new GeneralForbiddenException("禁止跨租户写入");
    }
  }

  public async beforeUpdate(
    args: EventArgs<{ tenantId?: string }>,
  ): Promise<void> {
    const tenantId = this.tenantExecutor.getTenantIdOrFail();
    const updatingTenantId = args.entity.tenantId;

    if (!tenantId) {
      throw new GeneralUnauthorizedException("缺少租户上下文");
    }

    if (updatingTenantId && updatingTenantId !== tenantId) {
      this.logger.error("检测到跨租户更新尝试", undefined, {
        entity: args.entity.constructor.name,
        expectedTenantId: tenantId,
        incomingTenantId: updatingTenantId,
      });
      throw new GeneralForbiddenException("禁止跨租户访问");
    }
  }
}

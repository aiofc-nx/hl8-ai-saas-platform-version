import type {
  EntityData,
  EntityManager,
  EntityName,
  FilterQuery,
  FindOneOptions,
} from "@mikro-orm/core";
import { EntityRepository } from "@mikro-orm/core";
import { Logger } from "@hl8/logger";
import { GeneralForbiddenException } from "@hl8/exceptions";
import { TenantContextExecutor } from "../tenant-context.executor.js";

type LoggerService = InstanceType<typeof Logger>;

/**
 * @description 租户感知仓储基类，自动在查询条件中追加 `tenantId`
 */
export abstract class BaseTenantRepository<
  ENTITY extends { tenantId: string },
> {
  protected readonly repository: EntityRepository<ENTITY>;

  protected constructor(
    protected readonly em: EntityManager,
    entityName: EntityName<ENTITY>,
    protected readonly tenantContextExecutor: TenantContextExecutor,
    protected readonly logger: LoggerService,
  ) {
    this.repository = em.getRepository(entityName);
  }

  protected async findOne(
    where: FilterQuery<ENTITY>,
    options?: FindOneOptions<ENTITY>,
  ): Promise<ENTITY | null> {
    return this.repository.findOne(
      this.mergeTenantFilter(where),
      options,
    ) as Promise<ENTITY | null>;
  }

  protected async nativeUpdate(
    where: FilterQuery<ENTITY>,
    data: EntityData<ENTITY>,
  ): Promise<number> {
    return this.repository.nativeUpdate(this.mergeTenantFilter(where), data);
  }

  protected async nativeDelete(where: FilterQuery<ENTITY>): Promise<number> {
    return this.repository.nativeDelete(this.mergeTenantFilter(where));
  }

  protected getEntityManager(): EntityManager {
    return this.em;
  }

  protected getRepository(): EntityRepository<ENTITY> {
    return this.repository;
  }

  private mergeTenantFilter(where?: FilterQuery<ENTITY>): FilterQuery<ENTITY> {
    const tenantId = this.tenantContextExecutor.getTenantIdOrFail();
    if (where) {
      const candidate = (where as Record<string, unknown>).tenantId;
      if (
        candidate !== undefined &&
        candidate !== null &&
        candidate !== tenantId
      ) {
        this.logger.error("检测到跨租户访问，已阻止执行", undefined, {
          expectedTenantId: tenantId,
          incomingTenantId: candidate,
        });
        throw new GeneralForbiddenException("禁止跨租户访问");
      }
    }

    const mergedFilter = {
      ...(where as Record<string, unknown> | undefined),
      tenantId,
    };

    this.logger.debug?.("已自动注入租户过滤条件", {
      tenantId,
      repository: this.constructor.name,
    });

    return mergedFilter as FilterQuery<ENTITY>;
  }
}

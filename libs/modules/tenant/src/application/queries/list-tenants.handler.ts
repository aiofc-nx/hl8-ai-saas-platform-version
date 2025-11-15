/**
 * @fileoverview 查询租户列表查询处理器
 * @description 处理查询租户列表查询，从读模型查询，支持分页、状态过滤、关键字搜索、软删除过滤
 *
 * ## 业务规则
 *
 * ### 权限校验
 * - 由 CaslQueryHandler 基类自动处理权限校验
 * - 需要 "read" "Tenant" 权限
 *
 * ### 查询规则
 * - 从读模型投影查询租户列表
 * - 支持按状态过滤
 * - 支持关键字搜索（租户名称）
 * - 支持分页
 * - 默认排除已归档租户（除非 includeDeleted=true）
 *
 * ### 执行流程
 * 1. 构建查询条件
 * 2. 从读模型查询租户列表
 * 3. 计算总数和分页信息
 * 4. 转换为响应 DTO
 *
 * ## 使用示例
 *
 * ```typescript
 * const handler = new ListTenantsHandler(...);
 * const result = await handler.execute(query);
 * ```
 */

import { QueryHandler } from "@nestjs/cqrs";
import { Inject } from "@nestjs/common";
import type { EntityManager } from "@mikro-orm/core";
import {
  CaslQueryHandler,
  CaslAbilityCoordinator,
  AuditCoordinator,
} from "@hl8/application-base";
import { Logger } from "@hl8/logger";
import { getEntityManagerToken } from "@hl8/mikro-orm-nestjs";
import { ListTenantsQuery } from "./list-tenants.query.js";
import { TenantProjection } from "../../infrastructure/projections/tenant.projection.js";
import type { FilterQuery } from "@mikro-orm/core";

type LoggerService = InstanceType<typeof Logger>;

/**
 * 查询租户列表查询处理器
 *
 * @description 处理查询租户列表查询
 */
@QueryHandler(ListTenantsQuery)
export class ListTenantsHandler extends CaslQueryHandler<
  ListTenantsQuery,
  import("./list-tenants.query.js").PaginatedResponse<
    import("./list-tenants.query.js").TenantListItem
  >
> {
  /**
   * 构造函数
   *
   * @param abilityCoordinator - CASL 权限协调器
   * @param auditCoordinator - 审计协调器
   * @param em - MikroORM EntityManager
   * @param logger - 日志服务
   */
  constructor(
    abilityCoordinator: CaslAbilityCoordinator,
    auditCoordinator: AuditCoordinator,
    @Inject(getEntityManagerToken("postgres"))
    private readonly em: EntityManager,
    private readonly logger: LoggerService,
  ) {
    super(abilityCoordinator, auditCoordinator);
  }

  /**
   * 处理查询租户列表查询
   *
   * @param query - 查询租户列表查询
   * @returns 分页的租户列表响应
   */
  protected async handle(
    query: ListTenantsQuery,
  ): Promise<
    import("./list-tenants.query.js").PaginatedResponse<
      import("./list-tenants.query.js").TenantListItem
    >
  > {
    // 1. 构建查询条件
    const where: FilterQuery<TenantProjection> = {};

    // 软删除过滤
    if (!query.includeDeleted) {
      where.isDeleted = false;
    }

    // 状态过滤
    if (query.status) {
      where.status = query.status;
    }

    // 关键字搜索（租户名称）
    if (query.keyword) {
      where.tenantName = { $ilike: `%${query.keyword}%` };
    }

    // 2. 从读模型查询租户列表（带分页）
    const [items, total] = await this.em.findAndCount(TenantProjection, where, {
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
      orderBy: { createdAt: "DESC" },
    });

    // 3. 转换为响应 DTO
    const tenantListItems: import("./list-tenants.query.js").TenantListItem[] =
      items.map((projection) => ({
        tenantId: projection.tenantId,
        tenantName: projection.tenantName,
        status: projection.status,
        contactName: projection.contactName ?? null,
        email: projection.email,
        phone: projection.phone ?? null,
        createdAt: projection.createdAt,
        updatedAt: projection.updatedAt,
      }));

    // 4. 计算分页信息
    const totalPages = Math.ceil(total / query.pageSize);

    const response: import("./list-tenants.query.js").PaginatedResponse<
      import("./list-tenants.query.js").TenantListItem
    > = {
      items: tenantListItems,
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages,
    };

    this.logger.log("租户列表查询成功", {
      total,
      page: query.page,
      pageSize: query.pageSize,
    });

    return response;
  }
}

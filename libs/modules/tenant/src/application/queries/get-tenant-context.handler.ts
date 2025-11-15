/**
 * @fileoverview 获取租户上下文查询处理器
 * @description 处理获取租户上下文查询，从读模型查询上下文信息
 *
 * ## 业务规则
 *
 * ### 权限校验
 * - 由 CaslQueryHandler 基类自动处理权限校验
 * - 需要 "read" "Tenant" 权限
 *
 * ### 查询规则
 * - 从读模型投影查询租户上下文
 * - 如果租户不存在或已归档，返回错误
 *
 * ### 执行流程
 * 1. 从读模型查询租户投影
 * 2. 转换为响应 DTO
 * 3. 返回租户上下文信息
 *
 * ## 使用示例
 *
 * ```typescript
 * const handler = new GetTenantContextHandler(...);
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
import { DomainException } from "@hl8/domain-base";
import { GetTenantContextQuery } from "./get-tenant-context.query.js";
import { TenantProjection } from "../../infrastructure/projections/tenant.projection.js";

type LoggerService = InstanceType<typeof Logger>;

/**
 * 获取租户上下文查询处理器
 *
 * @description 处理获取租户上下文查询
 */
@QueryHandler(GetTenantContextQuery)
export class GetTenantContextHandler extends CaslQueryHandler<
  GetTenantContextQuery,
  import("./get-tenant-context.query.js").TenantContextResponse
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
   * 处理获取租户上下文查询
   *
   * @param query - 获取租户上下文查询
   * @returns 租户上下文响应
   */
  protected async handle(
    query: GetTenantContextQuery,
  ): Promise<import("./get-tenant-context.query.js").TenantContextResponse> {
    // 1. 从读模型查询租户投影
    const projection = await this.em.findOne(TenantProjection, {
      tenantId: query.tenantId,
      isDeleted: false, // 排除已归档的租户
    });

    if (!projection) {
      throw new DomainException(`租户不存在或已归档: ${query.tenantId}`);
    }

    // 2. 转换为响应 DTO
    const response: import("./get-tenant-context.query.js").TenantContextResponse =
      {
        tenantId: projection.tenantId,
        tenantName: projection.tenantName,
        defaultOrganizationId: projection.defaultOrganizationId,
        defaultTimezone: projection.defaultTimezone,
        currency: projection.currency ?? null,
      };

    this.logger.log("租户上下文查询成功", {
      tenantId: query.tenantId,
    });

    return response;
  }
}

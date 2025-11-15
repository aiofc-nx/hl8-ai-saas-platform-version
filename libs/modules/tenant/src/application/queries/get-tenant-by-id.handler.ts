/**
 * @fileoverview 根据ID查询租户查询处理器
 * @description 处理根据ID查询租户查询，从读模型查询单个租户详情
 *
 * ## 业务规则
 *
 * ### 权限校验
 * - 由 CaslQueryHandler 基类自动处理权限校验
 * - 需要 "read" "Tenant" 权限
 *
 * ### 查询规则
 * - 从读模型投影查询租户详情
 * - 如果租户不存在或已归档，返回 null（除非有特殊权限）
 *
 * ### 执行流程
 * 1. 从读模型查询租户投影
 * 2. 转换为响应 DTO
 * 3. 返回租户详情
 *
 * ## 使用示例
 *
 * ```typescript
 * const handler = new GetTenantByIdHandler(...);
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
import { GetTenantByIdQuery } from "./get-tenant-by-id.query.js";
import { TenantProjection } from "../../infrastructure/projections/tenant.projection.js";
import { TenantReadModel } from "../../infrastructure/dto/tenant-read-model.js";

type LoggerService = InstanceType<typeof Logger>;

/**
 * 根据ID查询租户查询处理器
 *
 * @description 处理根据ID查询租户查询
 */
@QueryHandler(GetTenantByIdQuery)
export class GetTenantByIdHandler extends CaslQueryHandler<
  GetTenantByIdQuery,
  TenantReadModel | null
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
   * 处理根据ID查询租户查询
   *
   * @param query - 根据ID查询租户查询
   * @returns 租户详情或 null
   */
  protected async handle(
    query: GetTenantByIdQuery,
  ): Promise<TenantReadModel | null> {
    // 1. 从读模型查询租户投影
    const projection = await this.em.findOne(TenantProjection, {
      tenantId: query.tenantId,
      // 默认排除已归档的租户
      isDeleted: false,
    });

    if (!projection) {
      this.logger.log("租户不存在或已归档", {
        tenantId: query.tenantId,
      });
      return null;
    }

    // 2. 转换为响应 DTO
    const readModel = TenantReadModel.fromProjection({
      tenantId: projection.tenantId,
      tenantName: projection.tenantName,
      status: projection.status,
      contactName: projection.contactName,
      email: projection.email,
      phone: projection.phone ?? null,
      defaultOrganizationId: projection.defaultOrganizationId,
      defaultTimezone: projection.defaultTimezone,
      currency: projection.currency ?? null,
      legalName: projection.legalName ?? null,
      registrationCode: projection.registrationCode ?? null,
      industry: projection.industry ?? null,
      createdAt: projection.createdAt,
      updatedAt: projection.updatedAt,
      isDeleted: projection.isDeleted,
    });

    this.logger.log("租户详情查询成功", {
      tenantId: query.tenantId,
    });

    return readModel;
  }
}

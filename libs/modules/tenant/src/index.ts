/**
 * @fileoverview 租户管理模块导出入口
 * @description 导出租户管理模块的所有公共 API
 *
 * ## 导出内容
 *
 * - **模块**：TenantModule - 主模块，用于在应用中注册
 * - **领域层**：聚合根、实体、值对象、事件、仓储接口
 * - **应用层**：命令、查询、Saga
 * - **接口层**：控制器、DTO
 *
 * ## 使用示例
 *
 * ```typescript
 * import { TenantModule } from '@hl8/tenant';
 *
 * @Module({
 *   imports: [TenantModule],
 * })
 * export class AppModule {}
 * ```
 */

// 模块导出
export { TenantModule, type TenantModuleOptions } from "./tenant.module.js";

// 领域层导出
export { TenantAggregate } from "./domains/tenant/aggregates/tenant.aggregate.js";
export type { CreateTenantData } from "./domains/tenant/aggregates/tenant.aggregate.js";

export * from "./domains/tenant/value-objects/index.js";
export { TenantProfile } from "./domains/tenant/entities/tenant-profile.entity.js";
export * from "./domains/tenant/events/index.js";
export type { TenantRepository } from "./domains/tenant/repositories/tenant.repository.js";

// 应用层导出
export { CreateTenantCommand } from "./application/commands/create-tenant.command.js";
export type { CreateTenantCommandData } from "./application/commands/create-tenant.command.js";
export { CreateTenantHandler } from "./application/commands/create-tenant.handler.js";
export { ActivateTenantCommand } from "./application/commands/activate-tenant.command.js";
export { DeactivateTenantCommand } from "./application/commands/deactivate-tenant.command.js";
export { ArchiveTenantCommand } from "./application/commands/archive-tenant.command.js";
export { UpdateTenantProfileCommand } from "./application/commands/update-tenant-profile.command.js";
export type { UpdateTenantProfileCommandData } from "./application/commands/update-tenant-profile.command.js";
export { UpdateTenantProfileHandler } from "./application/commands/update-tenant-profile.handler.js";
export { GetTenantContextQuery } from "./application/queries/get-tenant-context.query.js";
export type { TenantContextResponse } from "./application/queries/get-tenant-context.query.js";
export { GetTenantContextHandler } from "./application/queries/get-tenant-context.handler.js";
export { GetTenantByIdQuery } from "./application/queries/get-tenant-by-id.query.js";
export { GetTenantByIdHandler } from "./application/queries/get-tenant-by-id.handler.js";
export { ListTenantsQuery } from "./application/queries/list-tenants.query.js";
export type {
  PaginatedResponse,
  TenantListItem,
} from "./application/queries/list-tenants.query.js";
export { ListTenantsHandler } from "./application/queries/list-tenants.handler.js";

// 基础设施层导出
export { TenantRepositoryImpl } from "./infrastructure/repositories/tenant.repository.impl.js";
export { TenantProjection } from "./infrastructure/projections/tenant.projection.js";
export { TenantProjectionHandler } from "./infrastructure/projections/tenant-projection.handler.js";
export { TenantReadModel } from "./infrastructure/dto/tenant-read-model.js";

// 接口层导出
export { TenantCommandController } from "./interfaces/controllers/tenant-command.controller.js";
export { TenantQueryController } from "./interfaces/controllers/tenant-query.controller.js";
export { CreateTenantDto } from "./interfaces/dtos/create-tenant.dto.js";
export {
  TenantContactInfoDto,
  TenantContextDto,
  TenantProfileDto,
} from "./interfaces/dtos/tenant-request.dto.js";
export { TenantContextResponseDto } from "./interfaces/dtos/tenant-context-response.dto.js";
export { ListTenantsQueryDto } from "./interfaces/dtos/list-tenants-query.dto.js";
export { TenantListResponseDto } from "./interfaces/dtos/tenant-list-response.dto.js";
export { TenantListItemDto } from "./interfaces/dtos/tenant-list-item.dto.js";
export { TenantDetailResponseDto } from "./interfaces/dtos/tenant-detail-response.dto.js";
export { UpdateTenantProfileDto } from "./interfaces/dtos/update-tenant-profile.dto.js";
export { TenantLifecycleSaga } from "./application/sagas/tenant-lifecycle.saga.js";

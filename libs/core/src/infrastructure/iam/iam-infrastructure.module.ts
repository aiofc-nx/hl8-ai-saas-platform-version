import { Module } from "@nestjs/common";
import { TenantRepository } from "./tenant.repository.js";

/**
 * @zh
 * @description IAM 基础设施模块，占位注册仓储等基础能力。
 */
@Module({
  providers: [TenantRepository],
  exports: [TenantRepository],
})
export class IamInfrastructureModule {}


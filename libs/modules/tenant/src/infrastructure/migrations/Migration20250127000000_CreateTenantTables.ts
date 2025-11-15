/**
 * @fileoverview 租户管理模块数据库迁移
 * @description 创建租户读模型投影表
 *
 * ## 迁移说明
 *
 * 本迁移文件创建以下表：
 * - `tenant_projections`: 租户读模型投影表（用于快速查询）
 *
 * ## 注意事项
 *
 * - 事件存储使用通用的 `events` 表（由基础设施层管理），本迁移不创建事件表
 * - 所有表必须包含 `tenantId` 列用于多租户隔离
 *
 * ## 表结构
 *
 * ### tenant_projections
 * - tenantId (UUID, 主键)
 * - tenantName (VARCHAR(100), 唯一索引)
 * - status (VARCHAR(20), 索引)
 * - contactName (VARCHAR(100), 可选)
 * - email (VARCHAR(255))
 * - phone (VARCHAR(50), 可选)
 * - defaultOrganizationId (UUID)
 * - defaultTimezone (VARCHAR(50))
 * - currency (VARCHAR(3), 可选)
 * - legalName (VARCHAR(200), 可选)
 * - registrationCode (VARCHAR(100), 可选)
 * - industry (VARCHAR(100), 可选)
 * - createdAt (TIMESTAMPTZ)
 * - updatedAt (TIMESTAMPTZ)
 * - isDeleted (BOOLEAN, 索引)
 */

import { Migration } from "@mikro-orm/migrations";

/**
 * 创建租户相关表的迁移
 *
 * @description 创建租户读模型投影表
 */
export class Migration20250127000000_CreateTenantTables extends Migration {
  /**
   * 执行迁移（向上）
   *
   * @description 创建 tenant_projections 表及其索引
   */
  async up(): Promise<void> {
    // 创建 tenant_projections 表
    this.addSql(`
      CREATE TABLE "tenant_projections" (
        "tenantId" UUID NOT NULL,
        "tenantName" VARCHAR(100) NOT NULL,
        "status" VARCHAR(20) NOT NULL,
        "contactName" VARCHAR(100),
        "email" VARCHAR(255) NOT NULL,
        "phone" VARCHAR(50),
        "defaultOrganizationId" UUID NOT NULL,
        "defaultTimezone" VARCHAR(50) NOT NULL,
        "currency" VARCHAR(3),
        "legalName" VARCHAR(200),
        "registrationCode" VARCHAR(100),
        "industry" VARCHAR(100),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "isDeleted" BOOLEAN NOT NULL DEFAULT false,
        CONSTRAINT "pk_tenant_projections" PRIMARY KEY ("tenantId")
      );
    `);

    // 创建 tenant_projections 索引
    this.addSql(`
      CREATE UNIQUE INDEX "uq_tenant_projection_name" ON "tenant_projections" ("tenantName");
    `);
    this.addSql(`
      CREATE INDEX "idx_tenant_projection_status" ON "tenant_projections" ("status");
    `);
    this.addSql(`
      CREATE INDEX "idx_tenant_projection_created_at" ON "tenant_projections" ("createdAt");
    `);
    this.addSql(`
      CREATE INDEX "idx_tenant_projection_is_deleted" ON "tenant_projections" ("isDeleted");
    `);
  }

  /**
   * 回滚迁移（向下）
   *
   * @description 删除 tenant_projections 表及其索引
   */
  async down(): Promise<void> {
    // 删除 tenant_projections 表（索引会自动删除）
    this.addSql(`DROP TABLE IF EXISTS "tenant_projections";`);
  }
}

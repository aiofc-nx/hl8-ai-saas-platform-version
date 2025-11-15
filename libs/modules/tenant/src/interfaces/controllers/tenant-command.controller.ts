/**
 * @fileoverview 租户命令控制器
 * @description 提供租户管理相关的命令接口
 *
 * ## 业务规则
 *
 * ### 权限要求
 * - 只有超级管理员或平台管理员可以创建租户
 * - 需要 "manage" "Tenant" 权限
 *
 * ### 接口规范
 * - 使用 RESTful API 设计
 * - 使用 CommandBus 执行命令
 * - 返回统一的响应格式
 *
 * ## 使用示例
 *
 * ```typescript
 * POST /tenants
 * {
 *   "tenantName": "ABC公司",
 *   "contactInfo": { ... },
 *   "context": { ... }
 * }
 * ```
 */

import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { CommandBus } from "@nestjs/cqrs";
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CreateTenantCommand } from "../../application/commands/create-tenant.command.js";
import { ActivateTenantCommand } from "../../application/commands/activate-tenant.command.js";
import { DeactivateTenantCommand } from "../../application/commands/deactivate-tenant.command.js";
import { ArchiveTenantCommand } from "../../application/commands/archive-tenant.command.js";
import { UpdateTenantProfileCommand } from "../../application/commands/update-tenant-profile.command.js";
import { CreateTenantDto } from "../dtos/create-tenant.dto.js";
import { UpdateTenantProfileDto } from "../dtos/update-tenant-profile.dto.js";
import { SecurityContextParam } from "@hl8/application-base";
import type { SecurityContext } from "@hl8/application-base";

/**
 * 租户命令控制器
 *
 * @description 提供租户管理相关的命令接口
 */
@ApiTags("tenants")
@Controller("tenants")
export class TenantCommandController {
  /**
   * 构造函数
   *
   * @param commandBus - 命令总线
   */
  constructor(private readonly commandBus: CommandBus) {}

  /**
   * 创建租户
   *
   * @param dto - 创建租户请求 DTO
   * @param securityContext - 安全上下文（从请求中获取）
   * @returns 创建结果，包含租户ID
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "创建租户",
    description: "系统管理员创建新租户",
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: "租户创建成功",
    schema: {
      type: "object",
      properties: {
        tenantId: {
          type: "string",
          description: "租户ID",
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: "请求参数错误",
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "权限不足",
  })
  async createTenant(
    @Body() dto: CreateTenantDto,
    @SecurityContextParam() securityContext: SecurityContext,
  ): Promise<{ tenantId: string }> {
    const command = new CreateTenantCommand(securityContext, {
      tenantName: dto.tenantName,
      contactInfo: dto.contactInfo,
      context: dto.context,
      profile: dto.profile,
    });

    const result = await this.commandBus.execute(command);

    return result;
  }

  /**
   * 激活租户
   *
   * @param id - 租户ID
   * @param securityContext - 安全上下文（从请求中获取）
   */
  @Post(":id/activate")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "激活租户",
    description:
      "系统管理员激活租户，将状态从 Initialized 或 Suspended 转换为 Active",
  })
  @ApiParam({
    name: "id",
    description: "租户ID",
    type: String,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "租户激活成功",
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: "请求参数错误",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "租户不存在",
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "权限不足或状态不允许",
  })
  async activateTenant(
    @Param("id") id: string,
    @SecurityContextParam() securityContext: SecurityContext,
  ): Promise<void> {
    const command = new ActivateTenantCommand(securityContext, {
      tenantId: id,
    });

    await this.commandBus.execute(command);
  }

  /**
   * 停用租户
   *
   * @param id - 租户ID
   * @param securityContext - 安全上下文（从请求中获取）
   */
  @Post(":id/deactivate")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "停用租户",
    description: "系统管理员停用租户，将状态从 Active 转换为 Suspended",
  })
  @ApiParam({
    name: "id",
    description: "租户ID",
    type: String,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "租户停用成功",
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: "请求参数错误",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "租户不存在",
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "权限不足或状态不允许",
  })
  async deactivateTenant(
    @Param("id") id: string,
    @SecurityContextParam() securityContext: SecurityContext,
  ): Promise<void> {
    const command = new DeactivateTenantCommand(securityContext, {
      tenantId: id,
    });

    await this.commandBus.execute(command);
  }

  /**
   * 归档租户
   *
   * @param id - 租户ID
   * @param securityContext - 安全上下文（从请求中获取）
   */
  @Post(":id/archive")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "归档租户",
    description: "系统管理员归档租户（软删除），将状态转换为 Archived",
  })
  @ApiParam({
    name: "id",
    description: "租户ID",
    type: String,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "租户归档成功",
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: "请求参数错误",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "租户不存在",
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "权限不足",
  })
  async archiveTenant(
    @Param("id") id: string,
    @SecurityContextParam() securityContext: SecurityContext,
  ): Promise<void> {
    const command = new ArchiveTenantCommand(securityContext, {
      tenantId: id,
    });

    await this.commandBus.execute(command);
  }

  /**
   * 更新租户档案
   *
   * @param id - 租户ID
   * @param dto - 更新租户档案请求 DTO
   * @param securityContext - 安全上下文（从请求中获取）
   */
  @Patch(":id/profile")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "更新租户档案",
    description: "系统管理员更新租户档案信息（法定名称、注册代码、行业分类）",
  })
  @ApiParam({
    name: "id",
    description: "租户ID",
    type: String,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "租户档案更新成功",
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: "请求参数错误",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "租户不存在",
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "权限不足或状态不允许",
  })
  async updateTenantProfile(
    @Param("id") id: string,
    @Body() dto: UpdateTenantProfileDto,
    @SecurityContextParam() securityContext: SecurityContext,
  ): Promise<void> {
    const command = new UpdateTenantProfileCommand(securityContext, {
      tenantId: id,
      profile: {
        legalName: dto.legalName,
        registrationCode: dto.registrationCode,
        industry: dto.industry,
      },
    });

    await this.commandBus.execute(command);
  }
}

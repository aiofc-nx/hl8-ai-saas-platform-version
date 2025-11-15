/**
 * @fileoverview 租户查询控制器
 * @description 提供租户管理相关的查询接口
 *
 * ## 业务规则
 *
 * ### 权限要求
 * - 需要 "read" "Tenant" 权限
 * - 可以跨租户查询（供 IAM 系统使用）
 *
 * ### 接口规范
 * - 使用 RESTful API 设计
 * - 使用 QueryBus 执行查询
 * - 返回统一的响应格式
 *
 * ## 使用示例
 *
 * ```typescript
 * GET /tenants/:id/context
 * ```
 */

import { Controller, Get, HttpStatus, Param, Query } from "@nestjs/common";
import { QueryBus } from "@nestjs/cqrs";
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { GetTenantContextQuery } from "../../application/queries/get-tenant-context.query.js";
import { GetTenantByIdQuery } from "../../application/queries/get-tenant-by-id.query.js";
import {
  ListTenantsQuery,
  type TenantListItem,
} from "../../application/queries/list-tenants.query.js";
import { TenantContextResponseDto } from "../dtos/tenant-context-response.dto.js";
import { ListTenantsQueryDto } from "../dtos/list-tenants-query.dto.js";
import { TenantListResponseDto } from "../dtos/tenant-list-response.dto.js";
import { TenantListItemDto } from "../dtos/tenant-list-item.dto.js";
import { TenantDetailResponseDto } from "../dtos/tenant-detail-response.dto.js";
import { SecurityContextParam } from "@hl8/application-base";
import type { SecurityContext } from "@hl8/application-base";

/**
 * 租户查询控制器
 *
 * @description 提供租户管理相关的查询接口
 */
@ApiTags("tenants")
@Controller("tenants")
export class TenantQueryController {
  /**
   * 构造函数
   *
   * @param queryBus - 查询总线
   */
  constructor(private readonly queryBus: QueryBus) {}

  /**
   * 获取租户上下文
   *
   * @param id - 租户ID
   * @param securityContext - 安全上下文（从请求中获取）
   * @returns 租户上下文响应
   */
  @Get(":id/context")
  @ApiOperation({
    summary: "获取租户上下文",
    description:
      "查询租户的默认组织ID、默认时区、货币等上下文信息，供 IAM 系统使用",
  })
  @ApiParam({
    name: "id",
    description: "租户ID",
    type: String,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "查询成功",
    type: TenantContextResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "租户不存在或已归档",
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "权限不足",
  })
  async getTenantContext(
    @Param("id") id: string,
    @SecurityContextParam() securityContext: SecurityContext,
  ): Promise<TenantContextResponseDto> {
    const query = new GetTenantContextQuery(securityContext, {
      tenantId: id,
    });

    const result = await this.queryBus.execute(query);

    return new TenantContextResponseDto(result);
  }

  /**
   * 查询租户列表
   *
   * @param queryDto - 查询参数
   * @param securityContext - 安全上下文（从请求中获取）
   * @returns 分页的租户列表响应
   */
  @Get()
  @ApiOperation({
    summary: "查询租户列表",
    description: "系统管理员查询租户列表，支持分页、按状态过滤、关键字搜索",
  })
  @ApiQuery({
    name: "status",
    required: false,
    description: "状态过滤（Initialized, Active, Suspended, Archived）",
    type: String,
  })
  @ApiQuery({
    name: "keyword",
    required: false,
    description: "关键字搜索（租户名称）",
    type: String,
  })
  @ApiQuery({
    name: "page",
    required: false,
    description: "页码（默认 1）",
    type: Number,
  })
  @ApiQuery({
    name: "pageSize",
    required: false,
    description: "每页数量（默认 20，最大 100）",
    type: Number,
  })
  @ApiQuery({
    name: "includeDeleted",
    required: false,
    description: "是否包含已归档租户（默认 false）",
    type: Boolean,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "查询成功",
    type: TenantListResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "权限不足",
  })
  async listTenants(
    @Query() queryDto: ListTenantsQueryDto,
    @SecurityContextParam() securityContext: SecurityContext,
  ): Promise<TenantListResponseDto> {
    const query = new ListTenantsQuery(securityContext, {
      status: queryDto.status,
      keyword: queryDto.keyword,
      page: queryDto.page,
      pageSize: queryDto.pageSize,
      includeDeleted: queryDto.includeDeleted,
    });

    const result = await this.queryBus.execute(query);

    // 转换为响应 DTO
    const items = result.items.map(
      (item: TenantListItem) =>
        new TenantListItemDto({
          tenantId: item.tenantId,
          tenantName: item.tenantName,
          status: item.status,
          contactName: item.contactName ?? "",
          email: item.email,
          phone: item.phone,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        }),
    );

    return new TenantListResponseDto({
      items,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    });
  }

  /**
   * 查询单个租户详情
   *
   * @param id - 租户ID
   * @param securityContext - 安全上下文（从请求中获取）
   * @returns 租户详情响应
   */
  @Get(":id")
  @ApiOperation({
    summary: "查询单个租户详情",
    description: "系统管理员查询单个租户的详细信息",
  })
  @ApiParam({
    name: "id",
    description: "租户ID",
    type: String,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "查询成功",
    type: TenantDetailResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "租户不存在或已归档",
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "权限不足",
  })
  async getTenantById(
    @Param("id") id: string,
    @SecurityContextParam() securityContext: SecurityContext,
  ): Promise<TenantDetailResponseDto | null> {
    const query = new GetTenantByIdQuery(securityContext, {
      tenantId: id,
    });

    const result = await this.queryBus.execute(query);

    if (!result) {
      return null;
    }

    return new TenantDetailResponseDto({
      tenantId: result.tenantId,
      tenantName: result.tenantName,
      status: result.status,
      contactName: result.contactName,
      email: result.email,
      phone: result.phone,
      defaultOrganizationId: result.defaultOrganizationId,
      defaultTimezone: result.defaultTimezone,
      currency: result.currency,
      legalName: result.legalName,
      registrationCode: result.registrationCode,
      industry: result.industry,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
      isDeleted: result.isDeleted,
    });
  }
}

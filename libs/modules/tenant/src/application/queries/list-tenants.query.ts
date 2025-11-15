/**
 * @fileoverview 查询租户列表查询
 * @description 用于查询租户列表的查询对象，支持分页、状态过滤、关键字搜索
 *
 * ## 业务规则
 *
 * ### 权限要求
 * - 需要 "read" "Tenant" 权限
 * - 只有超级管理员或平台管理员可以查询租户列表
 *
 * ### 查询参数
 * - status：按状态过滤（可选）
 * - keyword：关键字搜索（可选，搜索租户名称）
 * - page：页码（默认 1）
 * - pageSize：每页数量（默认 20，最大 100）
 * - includeDeleted：是否包含已归档租户（默认 false）
 *
 * ## 使用示例
 *
 * ```typescript
 * const query = new ListTenantsQuery(
 *   securityContext,
 *   {
 *     status: "Active",
 *     keyword: "ABC",
 *     page: 1,
 *     pageSize: 20,
 *     includeDeleted: false
 *   }
 * );
 * ```
 */

import type { AbilityDescriptor } from "@hl8/application-base";
import { CaslQueryBase } from "@hl8/application-base";
import type { SecurityContext } from "@hl8/application-base";
import { TenantStatus } from "../../domains/tenant/value-objects/tenant-status.vo.js";

/**
 * 分页响应数据
 */
export interface PaginatedResponse<T> {
  readonly items: T[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
}

/**
 * 租户列表项数据
 */
export interface TenantListItem {
  readonly tenantId: string;
  readonly tenantName: string;
  readonly status: string;
  readonly contactName: string;
  readonly email: string;
  readonly phone?: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * 查询租户列表查询的数据
 */
export interface ListTenantsQueryData {
  readonly status?: string;
  readonly keyword?: string;
  readonly page?: number;
  readonly pageSize?: number;
  readonly includeDeleted?: boolean;
}

/**
 * 查询租户列表查询
 *
 * @description 用于查询租户列表
 */
export class ListTenantsQuery extends CaslQueryBase<
  PaginatedResponse<TenantListItem>
> {
  /**
   * 状态过滤（可选）
   */
  public readonly status?: string;

  /**
   * 关键字搜索（可选）
   */
  public readonly keyword?: string;

  /**
   * 页码（默认 1）
   */
  public readonly page: number;

  /**
   * 每页数量（默认 20，最大 100）
   */
  public readonly pageSize: number;

  /**
   * 是否包含已归档租户（默认 false）
   */
  public readonly includeDeleted: boolean;

  /**
   * 构造函数
   *
   * @param context - 安全上下文
   * @param data - 查询数据
   */
  public constructor(
    context: SecurityContext,
    data: ListTenantsQueryData = {},
  ) {
    super(context);
    this.status = data.status;
    this.keyword = data.keyword;
    this.page = Math.max(1, data.page ?? 1);
    this.pageSize = Math.min(100, Math.max(1, data.pageSize ?? 20));
    this.includeDeleted = data.includeDeleted ?? false;
  }

  /**
   * 返回执行当前查询所需的权限描述
   *
   * @returns 权限描述
   */
  public abilityDescriptor(): AbilityDescriptor {
    return {
      action: "read",
      subject: "Tenant",
    };
  }

  /**
   * 返回审计所需的查询参数
   *
   * @returns 审计载荷
   */
  public auditPayload(): Record<string, unknown> {
    return {
      status: this.status,
      keyword: this.keyword,
      page: this.page,
      pageSize: this.pageSize,
      includeDeleted: this.includeDeleted,
    };
  }
}

/**
 * @fileoverview 租户列表响应 DTO
 * @description 用于返回租户列表的响应对象，包含分页信息
 *
 * ## 业务规则
 *
 * ### 响应字段
 * - items：租户列表项数组
 * - total：总记录数
 * - page：当前页码
 * - pageSize：每页数量
 * - totalPages：总页数
 *
 * ## 使用示例
 *
 * ```typescript
 * const dto = new TenantListResponseDto({
 *   items: [...],
 *   total: 100,
 *   page: 1,
 *   pageSize: 20,
 *   totalPages: 5
 * });
 * ```
 */

import { TenantListItemDto } from "./tenant-list-item.dto.js";

/**
 * 租户列表响应 DTO
 *
 * @description 用于返回租户列表，包含分页信息
 */
export class TenantListResponseDto {
  /**
   * 租户列表项数组
   */
  public readonly items: TenantListItemDto[];

  /**
   * 总记录数
   */
  public readonly total: number;

  /**
   * 当前页码
   */
  public readonly page: number;

  /**
   * 每页数量
   */
  public readonly pageSize: number;

  /**
   * 总页数
   */
  public readonly totalPages: number;

  /**
   * 构造函数
   *
   * @param data - 响应数据
   */
  public constructor(data: {
    items: TenantListItemDto[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }) {
    this.items = data.items;
    this.total = data.total;
    this.page = data.page;
    this.pageSize = data.pageSize;
    this.totalPages = data.totalPages;
  }
}

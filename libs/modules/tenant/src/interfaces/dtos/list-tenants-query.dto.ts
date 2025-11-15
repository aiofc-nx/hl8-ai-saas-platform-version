/**
 * @fileoverview 查询租户列表请求 DTO
 * @description 用于查询租户列表的请求参数，包含 class-validator 校验
 *
 * ## 业务规则
 *
 * ### 校验规则
 * - 使用 class-validator 进行参数校验
 * - page 必须 >= 1
 * - pageSize 必须在 1-100 之间
 * - status 必须是有效的租户状态
 *
 * ## 使用示例
 *
 * ```typescript
 * const dto = new ListTenantsQueryDto();
 * dto.page = 1;
 * dto.pageSize = 20;
 * dto.status = "Active";
 * ```
 */

import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";
import { Type } from "class-transformer";

/**
 * 查询租户列表请求 DTO
 *
 * @description 用于查询租户列表的请求参数
 */
export class ListTenantsQueryDto {
  /**
   * 状态过滤（可选）
   */
  @IsOptional()
  @IsString()
  @IsIn(["Initialized", "Active", "Suspended", "Archived"], {
    message:
      "状态必须是有效的租户状态（Initialized, Active, Suspended, Archived）",
  })
  public status?: string;

  /**
   * 关键字搜索（可选）
   */
  @IsOptional()
  @IsString()
  public keyword?: string;

  /**
   * 页码（默认 1）
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "页码必须是整数" })
  @Min(1, { message: "页码必须 >= 1" })
  public page?: number;

  /**
   * 每页数量（默认 20，最大 100）
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "每页数量必须是整数" })
  @Min(1, { message: "每页数量必须 >= 1" })
  @Max(100, { message: "每页数量必须 <= 100" })
  public pageSize?: number;

  /**
   * 是否包含已归档租户（默认 false）
   */
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean({ message: "includeDeleted 必须是布尔值" })
  public includeDeleted?: boolean;
}

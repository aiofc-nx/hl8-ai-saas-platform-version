/**
 * @fileoverview 更新租户档案请求 DTO
 * @description 用于更新租户档案的请求参数，包含 class-validator 校验
 *
 * ## 业务规则
 *
 * ### 校验规则
 * - 使用 class-validator 进行参数校验
 * - 所有字段都是可选的，只更新提供的字段
 * - 字段长度限制
 *
 * ## 使用示例
 *
 * ```typescript
 * const dto = new UpdateTenantProfileDto();
 * dto.legalName = "ABC有限公司";
 * dto.industry = "IT";
 * ```
 */

import { IsOptional, IsString, MaxLength } from "class-validator";

/**
 * 更新租户档案请求 DTO
 *
 * @description 用于更新租户档案的请求参数
 */
export class UpdateTenantProfileDto {
  /**
   * 法定名称（可选）
   */
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: "法定名称长度不能超过 200 个字符" })
  public legalName?: string;

  /**
   * 注册代码（可选）
   */
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: "注册代码长度不能超过 100 个字符" })
  public registrationCode?: string;

  /**
   * 行业分类（可选）
   */
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: "行业分类长度不能超过 100 个字符" })
  public industry?: string;
}

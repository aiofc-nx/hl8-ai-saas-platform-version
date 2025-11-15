/**
 * @fileoverview 创建租户请求 DTO
 * @description 用于创建租户的请求参数，包含 class-validator 校验
 *
 * ## 业务规则
 *
 * ### 校验规则
 * - 使用 class-validator 进行参数校验
 * - 所有必填字段必须提供
 * - 格式校验（邮箱、电话、时区、货币等）
 *
 * ## 使用示例
 *
 * ```typescript
 * const dto = new CreateTenantDto();
 * dto.tenantName = "ABC公司";
 * // ... 设置其他字段
 * ```
 */

import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import {
  TenantContactInfoDto,
  TenantContextDto,
  TenantProfileDto,
} from "./tenant-request.dto.js";

/**
 * 创建租户请求 DTO
 *
 * @description 用于创建租户的请求参数
 */
export class CreateTenantDto {
  /**
   * 租户名称
   */
  @IsString()
  @IsNotEmpty({ message: "租户名称不能为空" })
  @MinLength(1, { message: "租户名称长度不能少于 1 个字符" })
  @MaxLength(100, { message: "租户名称长度不能超过 100 个字符" })
  @Matches(/^[\u4e00-\u9fa5a-zA-Z0-9_-]+$/u, {
    message: "租户名称只能包含中文、英文、数字、连字符（-）和下划线（_）",
  })
  public tenantName!: string;

  /**
   * 联系人信息
   */
  @ValidateNested()
  @Type(() => TenantContactInfoDto)
  @IsNotEmpty({ message: "联系人信息不能为空" })
  public contactInfo!: TenantContactInfoDto;

  /**
   * 组织上下文
   */
  @ValidateNested()
  @Type(() => TenantContextDto)
  @IsNotEmpty({ message: "组织上下文不能为空" })
  public context!: TenantContextDto;

  /**
   * 租户档案（可选）
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => TenantProfileDto)
  public profile?: TenantProfileDto;
}

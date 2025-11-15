/**
 * @fileoverview 租户请求 DTO
 * @description 用于请求参数的数据传输对象，包含 class-validator 校验
 *
 * ## 业务规则
 *
 * ### 校验规则
 * - 使用 class-validator 进行参数校验
 * - 所有必填字段必须提供
 * - 格式校验（邮箱、电话等）
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
} from "class-validator";

/**
 * 租户联系人信息 DTO
 */
export class TenantContactInfoDto {
  /**
   * 负责人姓名
   */
  @IsString()
  @IsNotEmpty({ message: "负责人姓名不能为空" })
  @MaxLength(100, { message: "负责人姓名长度不能超过 100 个字符" })
  public contactName!: string;

  /**
   * 邮箱（必填）
   */
  @IsEmail({}, { message: "邮箱格式不正确" })
  @IsNotEmpty({ message: "邮箱不能为空" })
  public email!: string;

  /**
   * 电话（可选，国际格式）
   */
  @IsOptional()
  @IsString()
  @Matches(/^\+\d{1,4}-\d{1,14}$/, {
    message: "电话格式不正确，必须符合国际格式（+国家代码-电话号码）",
  })
  public phone?: string;
}

/**
 * 租户组织上下文 DTO
 */
export class TenantContextDto {
  /**
   * 默认组织根节点（必填）
   */
  @IsString()
  @IsNotEmpty({ message: "默认组织根节点不能为空" })
  public defaultOrganizationId!: string;

  /**
   * 默认时区（必填）
   */
  @IsString()
  @IsNotEmpty({ message: "默认时区不能为空" })
  @Matches(/^[A-Za-z_]+\/[A-Za-z_]+$/, {
    message: "时区格式不正确，必须符合 IANA 时区格式（如 Asia/Shanghai）",
  })
  public defaultTimezone!: string;

  /**
   * 货币（可选）
   */
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/, {
    message: "货币代码格式不正确，必须为3位大写字母（如 CNY、USD）",
  })
  public currency?: string;
}

/**
 * 租户档案 DTO
 */
export class TenantProfileDto {
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

/**
 * 租户请求 DTO 基类
 *
 * @description 包含租户创建和更新请求的通用字段
 */
export class TenantRequestDto {
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
  // 注意：这里需要使用 @ValidateNested 和 @Type 装饰器
  // 但由于这是基础 DTO，具体的校验在子类中实现
  public contactInfo!: TenantContactInfoDto;

  /**
   * 组织上下文
   */
  public context!: TenantContextDto;

  /**
   * 租户档案（可选）
   */
  @IsOptional()
  public profile?: TenantProfileDto;
}

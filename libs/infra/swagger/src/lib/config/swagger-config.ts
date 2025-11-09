import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  ValidateNested,
} from "class-validator";

/**
 * @description Swagger 文档基础配置，支持通过类验证器进行配置合法性校验
 * @example
 * ```typescript
 * const config = plainToInstance(SwaggerConfig, loadConfig());
 * ```
 * @remarks 该配置模型通常结合应用配置中心或环境变量解析器使用
 */
export class SwaggerConfig {
  /**
   * @description 文档标题，用于展示在 Swagger UI 顶部
   */
  @IsString({ message: "Swagger 标题必须为字符串" })
  title!: string;

  /**
   * @description 是否启用 Swagger 文档
   */
  @Transform(({ value }) => SwaggerConfig.transformBoolean(value))
  @IsBoolean({ message: "Swagger 启用标记必须为布尔值" })
  enabled = false;

  /**
   * @description Swagger UI 的访问路径
   */
  @IsString({ message: "Swagger 路径必须为字符串" })
  swaggerPath!: string;

  /**
   * @description 文档描述信息，通常用于说明系统能力
   */
  @IsString({ message: "Swagger 描述必须为字符串" })
  description!: string;

  /**
   * @description 文档版本号
   */
  @IsString({ message: "Swagger 版本必须为字符串" })
  version!: string;

  /**
   * @description 联系人信息 - 姓名
   */
  @IsString({ message: "联系人姓名必须为字符串" })
  contactName!: string;

  /**
   * @description 联系人信息 - 邮箱
   */
  @IsEmail({}, { message: "联系人邮箱格式不正确" })
  contactEmail!: string;

  /**
   * @description 联系人信息 - 主页链接
   */
  @IsUrl({}, { message: "联系人链接必须为合法 URL" })
  contactUrl!: string;

  /**
   * @description 可选的服务器信息列表
   */
  @IsOptional()
  @ValidateNested({ each: true, message: "服务器配置格式不正确" })
  @Type(() => SwaggerServer)
  servers?: SwaggerServer[];

  /**
   * @description 将多种输入类型转换为布尔值
   * @param value 外部传入的任意值
   * @returns 转换后的布尔值
   * @throws 无显式抛出异常
   */
  private static transformBoolean(value: unknown): boolean {
    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      return normalized === "true" || normalized === "1";
    }

    if (typeof value === "number") {
      return value === 1;
    }

    return false;
  }
}

/**
 * @description Swagger 服务器节点描述
 * @example
 * ```typescript
 * const servers = [{ url: "https://api.example.com", description: "生产环境" }];
 * ```
 */
export class SwaggerServer {
  /**
   * @description 服务器访问地址
   */
  @IsString({ message: "服务器地址必须为字符串" })
  url!: string;

  /**
   * @description 服务器描述信息
   */
  @IsString({ message: "服务器描述必须为字符串" })
  description!: string;
}

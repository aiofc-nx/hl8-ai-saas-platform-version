import { IsString, Length } from "class-validator";

/**
 * @zh
 * @description 租户开户请求 DTO，占位用于接口层示例。
 * @remarks 采用 class-validator 约束，后续将与 API 层联动。
 */
export class TenantProvisionRequestDto {
  /**
   * @zh
   * @description 租户名称，需控制长度防止滥用。
   */
  @IsString({ message: "租户名称必须为字符串" })
  @Length(2, 64, { message: "租户名称长度需介于 2 到 64 个字符之间" })
  public name!: string;
}


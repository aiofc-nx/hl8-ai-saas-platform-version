import { ApiProperty } from "@nestjs/swagger";

/**
 * @description Swagger 用的请求参数错误描述
 */
export class BadRequestIssueDto {
  @ApiProperty({ description: "发生错误的字段路径" })
  field!: string;

  @ApiProperty({ description: "字段对应的错误提示" })
  message!: string;

  @ApiProperty({ description: "错误编码", required: false })
  code?: string;

  @ApiProperty({ description: "被拒绝的字段值", required: false })
  rejectedValue?: unknown;
}

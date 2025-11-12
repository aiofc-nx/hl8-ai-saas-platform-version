import { ApiProperty } from "@nestjs/swagger";

/**
 * @description RFC7807 规范的标准错误响应结构
 * @example
 * ```json
 * {
 *   "type": "https://api.example.com/docs/errors/user-not-found",
 *   "title": "资源不存在",
 *   "status": 404,
 *   "detail": "指定的用户不存在",
 *   "instance": "6f9b0d30-8e87-4a1f-8f0f-f0fce0d4cf0d",
 *   "errorCode": "USER_NOT_FOUND",
 *   "data": {
 *     "userId": "123"
 *   }
 * }
 * ```
 */
export class ErrorResponse<ADDITIONAL_DATA extends object = object> {
  @ApiProperty({
    description: "指向错误说明文档的链接，通常为稳定的文档地址",
    required: true,
  })
  type!: string;

  @ApiProperty({
    description: "错误标题，用于快速识别问题的简短描述",
  })
  title!: string;

  @ApiProperty({
    description: "HTTP 状态码，例如 400、404、500",
  })
  status!: number;

  @ApiProperty({
    description: "错误详情，提供给终端用户的完整提示信息",
  })
  detail!: string;

  @ApiProperty({
    description: "补充信息，便于客户端进行差异化处理的结构化数据",
    required: false,
  })
  data?: ADDITIONAL_DATA | ADDITIONAL_DATA[];

  @ApiProperty({
    description: "当前请求的唯一标识，便于排查问题",
  })
  instance!: string;

  @ApiProperty({
    description: "业务错误码，客户端可基于此进行分类处理",
    required: false,
  })
  errorCode?: string;
}

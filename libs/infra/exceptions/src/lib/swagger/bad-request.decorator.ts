import { applyDecorators } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiExtraModels,
  getSchemaPath,
} from "@nestjs/swagger";
import { ErrorResponse } from "../dto/error-response.dto.js";
import { errorCodeSwaggerProperty } from "./properties/error-code-swagger.property.js";
import { BadRequestIssueDto } from "./dto/bad-request-issue.dto.js";

/**
 * @description 统一声明 400 响应的 Swagger 装饰器
 * @param errorCodes - 可选的业务错误码列表
 * @returns 装饰器组合
 */
export const ApiBadRequest = (...errorCodes: string[]) =>
  applyDecorators(
    ApiExtraModels(ErrorResponse, BadRequestIssueDto),
    ApiBadRequestResponse({
      description: "请求参数不合法",
      schema: {
        allOf: [
          { $ref: getSchemaPath(ErrorResponse) },
          {
            properties: {
              data: {
                type: "array",
                items: { $ref: getSchemaPath(BadRequestIssueDto) },
              },
              ...errorCodeSwaggerProperty(...errorCodes),
            },
          },
        ],
      },
    }),
  );

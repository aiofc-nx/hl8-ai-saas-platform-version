import { applyDecorators } from "@nestjs/common";
import { ApiExtraModels, ApiResponse, getSchemaPath } from "@nestjs/swagger";
import { ErrorResponse } from "../dto/error-response.dto.js";
import { errorCodeSwaggerProperty } from "./properties/error-code-swagger.property.js";

/**
 * @description 构造统一的 Swagger 错误响应装饰器
 * @param status - HTTP 状态码
 * @param description - 描述信息
 * @param errorCodes - 可选的错误码列表
 * @returns 装饰器组合
 */
export const createApiErrorDecorator = (
  status: number,
  description: string,
  ...errorCodes: string[]
) =>
  applyDecorators(
    ApiExtraModels(ErrorResponse),
    ApiResponse({
      status,
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(ErrorResponse) },
          { properties: { ...errorCodeSwaggerProperty(...errorCodes) } },
        ],
      },
    }),
  );

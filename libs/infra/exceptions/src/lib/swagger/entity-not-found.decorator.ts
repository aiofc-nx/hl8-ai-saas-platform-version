import { HttpStatus } from "@nestjs/common";
import { createApiErrorDecorator } from "./create-api-error.decorator.js";

/**
 * @description 404 响应装饰器
 * @param errorCodes - 可选业务错误码
 * @returns 装饰器组合
 */
export const ApiEntityNotFound = (...errorCodes: string[]) =>
  createApiErrorDecorator(
    HttpStatus.NOT_FOUND,
    "请求的资源不存在或已被删除",
    ...errorCodes,
  );

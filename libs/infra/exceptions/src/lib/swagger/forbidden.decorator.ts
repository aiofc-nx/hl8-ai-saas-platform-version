import { HttpStatus } from "@nestjs/common";
import { createApiErrorDecorator } from "./create-api-error.decorator.js";

/**
 * @description 403 响应装饰器
 * @param errorCodes - 可选业务错误码
 * @returns 装饰器组合
 */
export const ApiForbiddenError = (...errorCodes: string[]) =>
  createApiErrorDecorator(
    HttpStatus.FORBIDDEN,
    "当前账户没有执行该操作的权限",
    ...errorCodes,
  );

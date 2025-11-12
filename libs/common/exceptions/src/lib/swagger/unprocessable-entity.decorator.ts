import { HttpStatus } from "@nestjs/common";
import { createApiErrorDecorator } from "./create-api-error.decorator.js";

/**
 * @description 422 响应装饰器
 * @param errorCodes - 可选业务错误码
 * @returns 装饰器组合
 */
export const ApiUnprocessableEntity = (...errorCodes: string[]) =>
  createApiErrorDecorator(
    HttpStatus.UNPROCESSABLE_ENTITY,
    "请求已接收，但当前状态无法完成处理",
    ...errorCodes,
  );

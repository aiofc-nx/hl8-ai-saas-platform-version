import { HttpStatus } from "@nestjs/common";
import { createApiErrorDecorator } from "./create-api-error.decorator.js";

/**
 * @description 409 响应装饰器（资源已存在）
 * @param errorCodes - 可选业务错误码
 * @returns 装饰器组合
 */
export const ApiConflictEntityCreation = (...errorCodes: string[]) =>
  createApiErrorDecorator(
    HttpStatus.CONFLICT,
    "目标资源已存在，无法重复创建",
    ...errorCodes,
  );

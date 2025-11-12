import { HttpStatus } from "@nestjs/common";
import { createApiErrorDecorator } from "./create-api-error.decorator.js";

/**
 * @description 乐观锁冲突（409）响应装饰器
 * @param errorCodes - 可选业务错误码
 * @returns 装饰器组合
 */
export const ApiOptimisticLock = (...errorCodes: string[]) =>
  createApiErrorDecorator(
    HttpStatus.CONFLICT,
    "数据已被其他操作更新，请刷新后重试",
    ...errorCodes,
  );

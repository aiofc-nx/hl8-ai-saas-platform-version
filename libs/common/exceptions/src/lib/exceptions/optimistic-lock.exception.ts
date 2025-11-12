import { HttpStatus } from "@nestjs/common";
import { AbstractHttpException } from "./abstract-http.exception.js";

/**
 * @description 乐观锁冲突异常
 */
export class OptimisticLockException extends AbstractHttpException<{
  currentVersion?: number;
  expectedVersion?: number;
}> {
  /**
   * @description 构造函数
   * @param currentVersion - 数据库当前版本
   * @param expectedVersion - 调用方期望版本
   * @param detail - 自定义提示信息
   * @param errorCode - 业务错误码
   * @param rootCause - 原始异常
   */
  constructor(
    currentVersion?: number,
    expectedVersion?: number,
    detail: string = "数据已被其他操作更新，请刷新后重试",
    errorCode?: string,
    rootCause?: unknown,
  ) {
    super(
      "数据版本冲突",
      detail,
      HttpStatus.CONFLICT,
      {
        currentVersion,
        expectedVersion,
      },
      errorCode,
      rootCause,
    );
  }
}

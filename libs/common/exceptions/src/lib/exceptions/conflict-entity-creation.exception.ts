import { HttpStatus } from "@nestjs/common";
import { AbstractHttpException } from "./abstract-http.exception.js";

/**
 * @description 数据冲突异常，常用于创建已存在的实体
 */
export class ConflictEntityCreationException extends AbstractHttpException {
  /**
   * @description 构造函数
   * @param detail - 冲突详情，默认提示资源已存在
   * @param errorCode - 业务错误码
   * @param rootCause - 原始异常
   */
  constructor(
    detail: string = "目标资源已存在，无法重复创建",
    errorCode?: string,
    rootCause?: unknown,
  ) {
    super(
      "数据冲突",
      detail,
      HttpStatus.CONFLICT,
      undefined,
      errorCode,
      rootCause,
    );
  }
}

import { HttpStatus } from "@nestjs/common";
import { AbstractHttpException } from "./abstract-http.exception.js";

/**
 * @description 通用的 500 错误，对内部异常进行统一包装
 */
export class GeneralInternalServerException extends AbstractHttpException {
  /**
   * @description 构造函数
   * @param detail - 可选的详细描述，默认提供通用提示
   * @param errorCode - 业务错误码
   * @param rootCause - 原始异常
   */
  constructor(
    detail: string = "服务暂时不可用，请稍后重试",
    errorCode?: string,
    rootCause?: unknown,
  ) {
    super(
      "服务器内部错误",
      detail,
      HttpStatus.INTERNAL_SERVER_ERROR,
      undefined,
      errorCode,
      rootCause,
    );
  }
}

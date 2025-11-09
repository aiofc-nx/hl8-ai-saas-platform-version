import { HttpStatus } from "@nestjs/common";
import { AbstractHttpException } from "./abstract-http.exception.js";

/**
 * @description 422 错误，表示请求语义正确但无法处理
 */
export class GeneralUnprocessableEntityException extends AbstractHttpException {
  /**
   * @description 构造函数
   * @param detail - 详细描述，默认提示业务校验失败
   * @param errorCode - 业务错误码
   * @param rootCause - 原始异常
   */
  constructor(
    detail: string = "请求已接收，但当前状态无法完成处理",
    errorCode?: string,
    rootCause?: unknown,
  ) {
    super(
      "无法处理的实体",
      detail,
      HttpStatus.UNPROCESSABLE_ENTITY,
      undefined,
      errorCode,
      rootCause,
    );
  }
}

import { HttpStatus } from "@nestjs/common";
import { AbstractHttpException } from "./abstract-http.exception.js";

/**
 * @description 通用的 401 错误，提示身份认证失败
 */
export class GeneralUnauthorizedException extends AbstractHttpException {
  /**
   * @description 构造函数
   * @param detail - 详细描述，默认提示登录状态失效
   * @param errorCode - 业务错误码
   * @param rootCause - 原始异常
   */
  constructor(
    detail: string = "认证失败，请重新登录",
    errorCode?: string,
    rootCause?: unknown,
  ) {
    super(
      "未授权",
      detail,
      HttpStatus.UNAUTHORIZED,
      undefined,
      errorCode,
      rootCause,
    );
  }
}

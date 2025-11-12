import { HttpStatus } from "@nestjs/common";
import { AbstractHttpException } from "./abstract-http.exception.js";

/**
 * @description 通用的 403 错误，表示操作被安全策略拒绝
 */
export class GeneralForbiddenException extends AbstractHttpException {
  /**
   * @description 构造函数
   * @param detail - 详细描述，默认提示没有操作权限
   * @param errorCode - 业务错误码
   * @param rootCause - 原始异常
   */
  constructor(
    detail: string = "当前账户没有执行该操作的权限",
    errorCode?: string,
    rootCause?: unknown,
  ) {
    super(
      "禁止访问",
      detail,
      HttpStatus.FORBIDDEN,
      undefined,
      errorCode,
      rootCause,
    );
  }
}

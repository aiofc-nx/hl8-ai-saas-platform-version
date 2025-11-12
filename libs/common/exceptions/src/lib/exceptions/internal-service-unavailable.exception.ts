import { HttpStatus } from "@nestjs/common";
import { AbstractHttpException } from "./abstract-http.exception.js";

/**
 * @description 内部服务不可用异常，适用于调用内部依赖失败的场景
 */
export class InternalServiceUnavailableException extends AbstractHttpException<{
  service?: string;
}> {
  /**
   * @description 构造函数
   * @param service - 不可用的内部服务名称
   * @param detail - 自定义提示信息
   * @param errorCode - 业务错误码
   * @param rootCause - 原始异常
   */
  constructor(
    service?: string,
    detail: string = "依赖的内部服务不可用，请稍后重试",
    errorCode?: string,
    rootCause?: unknown,
  ) {
    super(
      "内部服务不可用",
      detail,
      HttpStatus.SERVICE_UNAVAILABLE,
      {
        service,
      },
      errorCode,
      rootCause,
    );
  }
}

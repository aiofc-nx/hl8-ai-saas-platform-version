import { HttpStatus } from "@nestjs/common";
import { AbstractHttpException } from "./abstract-http.exception.js";

/**
 * @description 通用的 404 错误，表示资源不存在
 */
export class GeneralNotFoundException extends AbstractHttpException {
  /**
   * @description 构造函数
   * @param detail - 详细描述，默认提示资源不存在
   * @param errorCode - 业务错误码
   * @param rootCause - 原始异常
   */
  constructor(
    detail: string = "请求的资源不存在或已被删除",
    errorCode?: string,
    rootCause?: unknown,
  ) {
    super(
      "资源不存在",
      detail,
      HttpStatus.NOT_FOUND,
      undefined,
      errorCode,
      rootCause,
    );
  }
}

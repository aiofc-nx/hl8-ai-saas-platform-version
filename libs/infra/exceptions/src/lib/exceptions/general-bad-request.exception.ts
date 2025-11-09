import { HttpStatus } from "@nestjs/common";
import { AbstractHttpException } from "./abstract-http.exception.js";
import type { ValidationIssue } from "./vo/validation-issue.js";

/**
 * @description 通用的 400 错误，通常用于参数校验失败
 */
export class GeneralBadRequestException extends AbstractHttpException<ValidationIssue> {
  /**
   * @description 构造函数
   * @param issues - 校验错误明细
   * @param detail - 详细描述，默认提示请求参数不合法
   * @param errorCode - 业务错误码
   * @param rootCause - 原始异常
   */
  constructor(
    issues: ValidationIssue | ValidationIssue[],
    detail: string = "请求参数不符合要求，请检查后重试",
    errorCode?: string,
    rootCause?: unknown,
  ) {
    const normalizedIssues = Array.isArray(issues) ? issues : [issues];
    super(
      "请求参数错误",
      detail,
      HttpStatus.BAD_REQUEST,
      normalizedIssues,
      errorCode,
      rootCause,
    );
  }
}

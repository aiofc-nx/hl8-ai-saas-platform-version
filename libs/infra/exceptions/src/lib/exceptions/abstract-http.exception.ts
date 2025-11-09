import { HttpStatus } from "@nestjs/common";
import { ErrorResponse } from "../dto/error-response.dto.js";

/**
 * @description HTTP 异常抽象基类，统一描述 RFC7807 响应格式
 *
 * @template ADDITIONAL_DATA - 补充数据的结构类型
 */
export abstract class AbstractHttpException<
  ADDITIONAL_DATA extends object = object,
> extends Error {
  /**
   * @description 构造异常对象
   * @param title - 业务侧可读的错误标题
   * @param detail - 面向终端用户的详细描述
   * @param status - HTTP 状态码
   * @param data - 补充的结构化数据
   * @param errorCode - 业务错误码
   * @param rootCause - 原始异常，便于链路追踪
   */
  protected constructor(
    public readonly title: string,
    public readonly detail: string,
    public readonly status: HttpStatus,
    public readonly data?: ADDITIONAL_DATA | ADDITIONAL_DATA[],
    public readonly errorCode?: string,
    public readonly rootCause?: unknown,
  ) {
    super(detail);
    this.name = new.target.name;
  }

  /**
   * @description 转换为标准错误响应
   * @param requestId - 当前请求 ID，用于 `instance` 字段
   * @param type - 错误文档链接，默认使用 `about:blank`
   * @returns RFC7807 兼容的响应体
   */
  toErrorResponse(
    requestId: string,
    type: string = "about:blank",
  ): ErrorResponse<ADDITIONAL_DATA> {
    return {
      type,
      title: this.title,
      detail: this.detail,
      status: this.status,
      instance: requestId,
      errorCode: this.errorCode,
      data: this.data,
    } satisfies ErrorResponse<ADDITIONAL_DATA>;
  }

  /**
   * @description 预设响应头部，可由子类覆盖提供额外头信息
   * @returns 需要设置到响应对象的头部键值对
   */
  getPresetHeadersValues(): Record<string, string> {
    return {};
  }
}

import { HttpStatus } from "@nestjs/common";
import { AbstractHttpException } from "./abstract-http.exception.js";

/**
 * @description 资源未找到异常，可携带资源类型与标识
 */
export class ObjectNotFoundException extends AbstractHttpException<{
  resourceType?: string;
  identifier?: string | number;
}> {
  /**
   * @description 构造函数
   * @param resourceType - 资源类型描述
   * @param identifier - 资源唯一标识
   * @param detail - 自定义提示信息
   * @param errorCode - 业务错误码
   * @param rootCause - 原始异常
   */
  constructor(
    resourceType?: string,
    identifier?: string | number,
    detail: string = "目标资源不存在",
    errorCode?: string,
    rootCause?: unknown,
  ) {
    super(
      "资源不存在",
      detail,
      HttpStatus.NOT_FOUND,
      {
        resourceType,
        identifier,
      },
      errorCode,
      rootCause,
    );
  }
}

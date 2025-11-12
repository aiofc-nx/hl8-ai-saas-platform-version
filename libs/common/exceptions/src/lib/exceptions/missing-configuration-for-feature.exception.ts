import { HttpStatus } from "@nestjs/common";
import { AbstractHttpException } from "./abstract-http.exception.js";

/**
 * @description 功能缺少配置的异常，提示运维补齐配置
 */
export class MissingConfigurationForFeatureException extends AbstractHttpException<{
  feature?: string;
  configKey?: string;
}> {
  /**
   * @description 构造函数
   * @param feature - 功能名称
   * @param configKey - 缺失的配置键名
   * @param detail - 自定义提示信息
   * @param errorCode - 业务错误码
   * @param rootCause - 原始异常
   */
  constructor(
    feature?: string,
    configKey?: string,
    detail: string = "功能配置缺失，请联系运维人员补充配置",
    errorCode?: string,
    rootCause?: unknown,
  ) {
    super(
      "配置缺失",
      detail,
      HttpStatus.INTERNAL_SERVER_ERROR,
      {
        feature,
        configKey,
      },
      errorCode,
      rootCause,
    );
  }
}

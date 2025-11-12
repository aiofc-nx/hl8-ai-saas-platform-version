import { GeneralInternalServerException } from "@hl8/exceptions";

/**
 * @public
 * @description 审计写入异常，统一包装底层审计服务抛出的错误。
 */
export class AuditRecordException extends GeneralInternalServerException {
  public constructor(message: string, cause?: unknown) {
    super(message, undefined, cause);
  }
}

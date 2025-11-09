import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  ForbiddenException,
  HttpStatus,
  Optional,
} from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import { Logger as Hl8Logger } from "@hl8/logger";
import { ErrorResponse } from "../dto/error-response.dto.js";
import { resolveRequestId } from "../utils/request-id.util.js";

/**
 * @description 捕获 Nest 默认的 403 异常并转换为统一格式
 */
@Catch(ForbiddenException)
export class ForbiddenExceptionFilter implements ExceptionFilter {
  /**
   * @description 构造函数
   * @param httpAdapterHost - Nest HTTP 适配器封装
   * @param logger - 统一日志服务
   */
  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    @Optional() private readonly logger?: Hl8Logger,
  ) {}

  /**
   * @description 捕获异常并输出响应
   * @param exception - ForbiddenException 实例
   * @param host - Nest 运行时上下文
   * @returns void
   */
  catch(exception: ForbiddenException, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const httpContext = host.switchToHttp();
    const instance = resolveRequestId(httpContext);

    const payload = exception.getResponse() as Record<string, unknown>;
    const detail =
      (typeof payload === "object" && (payload?.["message"] as string)) ??
      exception.message ??
      "当前账户没有执行该操作的权限";

    const response: ErrorResponse = {
      type: "about:blank",
      title: "禁止访问",
      detail,
      status: HttpStatus.FORBIDDEN,
      instance,
    } satisfies ErrorResponse;

    this.logger?.warn("捕获到 ForbiddenException", {
      instance,
      detail,
    });

    httpAdapter.reply(httpContext.getResponse(), response, response.status);
  }
}

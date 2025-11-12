import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Optional,
} from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import { Logger as Hl8Logger } from "@hl8/logger";
import { AbstractHttpException } from "../exceptions/abstract-http.exception.js";
import { resolveRequestId } from "../utils/request-id.util.js";

/**
 * @description 捕获自定义 HTTP 异常并输出统一响应
 */
@Catch(AbstractHttpException)
export class HttpExceptionFilter implements ExceptionFilter {
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
   * @param exception - 自定义 HTTP 异常实例
   * @param host - Nest 运行时上下文
   * @returns void
   */
  catch(exception: AbstractHttpException, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const httpContext = host.switchToHttp();

    const requestId = resolveRequestId(httpContext);
    const response = exception.toErrorResponse(requestId);

    this.applyPresetHeaders(exception, httpContext);

    if (exception.status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger?.error("捕获到内部异常", undefined, {
        exceptionName: exception.name,
        status: exception.status,
        requestId,
        rootCause: exception.rootCause,
      });

      if (!this.logger) {
        console.error("[HttpExceptionFilter]", exception);
      }
    } else {
      this.logger?.warn("捕获到业务异常", {
        exceptionName: exception.name,
        status: exception.status,
        requestId,
        errorCode: exception.errorCode,
      });
    }

    httpAdapter.reply(httpContext.getResponse(), response, response.status);
  }

  /**
   * @description 设置预设响应头
   * @param exception - 异常实例
   * @param httpContext - HTTP 上下文
   * @returns void
   */
  private applyPresetHeaders(
    exception: AbstractHttpException,
    httpContext: ReturnType<ArgumentsHost["switchToHttp"]>,
  ): void {
    const headers = exception.getPresetHeadersValues();
    if (!headers) {
      return;
    }

    const response = httpContext.getResponse();
    if (typeof response?.header !== "function") {
      return;
    }

    Object.entries(headers).forEach(([key, value]) => {
      response.header(key, value);
    });
  }
}

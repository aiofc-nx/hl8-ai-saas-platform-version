import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Optional,
  ServiceUnavailableException,
} from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import { Logger as Hl8Logger } from "@hl8/logger";
import { ErrorResponse } from "../dto/error-response.dto.js";
import { resolveRequestId } from "../utils/request-id.util.js";

/**
 * @description 捕获未处理的异常，避免泄露堆栈信息
 */
@Catch()
export class AnyExceptionFilter implements ExceptionFilter {
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
   * @description 捕获并处理异常
   * @param exception - 捕获到的未知异常
   * @param host - Nest 运行时上下文
   * @returns void
   */
  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const httpContext = host.switchToHttp();

    if (exception instanceof ServiceUnavailableException) {
      httpAdapter.reply(
        httpContext.getResponse(),
        exception.getResponse(),
        HttpStatus.SERVICE_UNAVAILABLE,
      );
      return;
    }

    const instance = resolveRequestId(httpContext);
    const response: ErrorResponse = {
      type: "about:blank",
      title: "服务器内部错误",
      detail: "系统繁忙，请稍后重试",
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      instance,
    } satisfies ErrorResponse;

    this.logger?.error("捕获到未处理异常", undefined, {
      instance,
      exception,
    });

    if (!this.logger) {
      console.error("[AnyExceptionFilter] 捕获到未处理异常", exception);
    }

    httpAdapter.reply(httpContext.getResponse(), response, response.status);
  }
}

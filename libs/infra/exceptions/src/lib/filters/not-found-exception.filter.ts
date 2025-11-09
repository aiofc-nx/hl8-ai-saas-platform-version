import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import { Logger as Hl8Logger } from "@hl8/logger";
import { ErrorResponse } from "../dto/error-response.dto.js";
import { resolveRequestId } from "../utils/request-id.util.js";

/**
 * @description 捕获 Nest 默认的 404 异常并转换为统一格式
 */
@Catch(NotFoundException)
export class NotFoundExceptionFilter implements ExceptionFilter {
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
   * @param exception - NotFoundException 实例
   * @param host - Nest 运行时上下文
   * @returns void
   */
  catch(exception: NotFoundException, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const httpContext = host.switchToHttp();
    const instance = resolveRequestId(httpContext);

    const payload = exception.getResponse() as Record<string, unknown>;
    const detail =
      (typeof payload === "object" && (payload?.["message"] as string)) ??
      exception.message ??
      "请求的资源不存在或已被删除";

    const response: ErrorResponse = {
      type: "about:blank",
      title: "资源不存在",
      detail,
      status: HttpStatus.NOT_FOUND,
      instance,
    } satisfies ErrorResponse;

    this.logger?.warn("捕获到 NotFoundException", {
      instance,
      detail,
    });

    httpAdapter.reply(httpContext.getResponse(), response, response.status);
  }
}

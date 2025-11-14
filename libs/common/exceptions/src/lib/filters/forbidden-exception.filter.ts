import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  ForbiddenException,
  HttpStatus,
  Inject,
  Optional,
} from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import { Logger } from "@hl8/logger";
import { ErrorResponse } from "../dto/error-response.dto.js";
import { resolveRequestId } from "../utils/request-id.util.js";

type LoggerServiceInstance = InstanceType<typeof Logger>;
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
    @Optional()
    @Inject(Logger)
    private readonly logger?: LoggerServiceInstance,
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

    const payload = exception.getResponse();
    const detail = this.resolveMessage(payload, exception.message, {
      fallback: "当前账户没有执行该操作的权限",
    });

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

  /**
   * @description 统一解析异常消息，确保返回字符串
   * @param payload - 异常响应原始载荷
   * @param defaultMessage - 异常对象上的默认消息
   * @param options - 解析选项（包含兜底文案）
   * @returns 标准化后的消息字符串
   */
  private resolveMessage(
    payload: unknown,
    defaultMessage?: string,
    options?: { fallback?: string },
  ): string {
    const fallback = options?.fallback ?? "发生未知的权限错误";

    if (typeof payload === "string" && payload.trim().length > 0) {
      return payload;
    }

    if (
      typeof payload === "object" &&
      payload !== null &&
      "message" in payload
    ) {
      const message = (payload as Record<string, unknown>).message;
      if (Array.isArray(message)) {
        return (
          message
            .filter((item): item is string => typeof item === "string")
            .join("，") || fallback
        );
      }
      if (typeof message === "string" && message.trim().length > 0) {
        return message;
      }
    }

    if (
      typeof defaultMessage === "string" &&
      defaultMessage.trim().length > 0
    ) {
      return defaultMessage;
    }

    return fallback;
  }
}

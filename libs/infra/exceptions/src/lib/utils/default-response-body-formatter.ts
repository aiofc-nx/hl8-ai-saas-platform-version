import { ArgumentsHost, BadRequestException, HttpStatus } from "@nestjs/common";
import { ErrorResponse } from "../dto/error-response.dto.js";
import { GeneralBadRequestException } from "../exceptions/general-bad-request.exception.js";
import { resolveRequestId } from "./request-id.util.js";

/**
 * @description 将校验异常转换为统一的错误响应格式
 * @param host - Nest 的参数宿主对象
 * @param exc - 捕获到的异常
 * @param formattedErrors - 已格式化的校验错误明细
 * @returns 结构化的错误响应体
 */
export function responseBodyFormatter(
  host: ArgumentsHost,
  exc: unknown,
  formattedErrors: object,
): ErrorResponse {
  const httpContext = host.switchToHttp();
  const instance = resolveRequestId(httpContext);

  if (exc instanceof GeneralBadRequestException) {
    const response = exc.toErrorResponse(instance);
    return {
      ...response,
      data: formattedErrors,
    } satisfies ErrorResponse;
  }

  if (exc instanceof BadRequestException) {
    const payload = exc.getResponse() as Record<string, unknown>;
    const message = Array.isArray(payload?.message)
      ? (payload.message as unknown[]).join("; ")
      : (payload?.message as string | undefined);

    return {
      type: "about:blank",
      title: "请求参数错误",
      detail: message ?? "请求参数不符合要求，请检查后重试",
      status: exc.getStatus(),
      instance,
      data: formattedErrors,
      errorCode: (payload?.["errorCode"] as string | undefined) ?? undefined,
    } satisfies ErrorResponse;
  }

  return {
    type: "about:blank",
    title: "请求无法处理",
    detail: "无法解析请求体，请稍后重试",
    status: HttpStatus.BAD_REQUEST,
    instance,
    data: formattedErrors,
  } satisfies ErrorResponse;
}

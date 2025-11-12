import type { ArgumentsHost } from "@nestjs/common";
import { randomUUID } from "node:crypto";

/**
 * @description 从请求上下文中提取请求 ID，若不存在则生成随机值
 * @param httpContext - Nest HTTP 上下文
 * @returns 可用于 `ErrorResponse.instance` 的请求标识
 */
export function resolveRequestId(
  httpContext: ReturnType<ArgumentsHost["switchToHttp"]>,
): string {
  const request = httpContext.getRequest();
  const candidate =
    request?.requestId ?? request?.id ?? request?.headers?.["x-request-id"];

  if (typeof candidate === "string") {
    return candidate;
  }

  if (typeof candidate === "number") {
    return candidate.toString();
  }

  if (candidate && typeof candidate.toString === "function") {
    const maybeString = candidate.toString();
    if (typeof maybeString === "string" && maybeString.length > 0) {
      return maybeString;
    }
  }

  return randomUUID();
}

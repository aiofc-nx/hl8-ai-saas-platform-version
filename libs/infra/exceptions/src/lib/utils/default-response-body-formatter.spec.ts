import { BadRequestException, HttpStatus } from "@nestjs/common";
import type { ArgumentsHost, HttpArgumentsHost } from "@nestjs/common";
import { GeneralBadRequestException } from "../exceptions/general-bad-request.exception.js";
import { responseBodyFormatter } from "./default-response-body-formatter.js";

const createArgumentsHostMock = (
  requestId: string,
  responseHeaders: Record<string, string> = {},
): ArgumentsHost => {
  const httpContext: HttpArgumentsHost = {
    getRequest: () => ({ requestId }),
    getResponse: () => ({
      header: (key: string, value: string) => (responseHeaders[key] = value),
    }),
    getNext: () => undefined,
  };

  return {
    switchToHttp: () => httpContext,
    switchToRpc: () => undefined as never,
    switchToWs: () => undefined as never,
    getArgs: () => [],
    getArgByIndex: () => undefined,
    getType: () => "http",
  } satisfies ArgumentsHost;
};

describe("responseBodyFormatter", () => {
  it("GeneralBadRequestException 应保持自定义错误码与数据", () => {
    const exception = new GeneralBadRequestException(
      {
        field: "email",
        message: "邮箱格式不正确",
      },
      "邮箱格式不正确",
      "INVALID_EMAIL",
    );

    const host = createArgumentsHostMock("req-456");

    const formatted = responseBodyFormatter(host, exception, {
      email: "邮箱格式不正确",
    });

    expect(formatted).toMatchObject({
      title: "请求参数错误",
      status: HttpStatus.BAD_REQUEST,
      instance: "req-456",
      errorCode: "INVALID_EMAIL",
      data: { email: "邮箱格式不正确" },
    });
  });

  it("Fallback 应处理原生 BadRequestException", () => {
    const exception = new BadRequestException({
      message: "payload invalid",
      errorCode: "PAYLOAD_INVALID",
    });

    const host = createArgumentsHostMock("req-789");

    const formatted = responseBodyFormatter(host, exception, {
      payload: "invalid",
    });

    expect(formatted).toMatchObject({
      title: "请求参数错误",
      status: HttpStatus.BAD_REQUEST,
      detail: "payload invalid",
      errorCode: "PAYLOAD_INVALID",
      instance: "req-789",
      data: { payload: "invalid" },
    });
  });
});

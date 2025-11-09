import type { ArgumentsHost } from "@nestjs/common";
import { HttpStatus, ServiceUnavailableException } from "@nestjs/common";
import type { HttpAdapterHost } from "@nestjs/core";
import { AnyExceptionFilter } from "./any-exception.filter.js";

const createArgumentsHost = (
  request: Record<string, unknown>,
  response: Record<string, unknown>,
): ArgumentsHost => {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
      getNext: () => undefined,
    }),
    switchToRpc: () => undefined as never,
    switchToWs: () => undefined as never,
    getArgs: () => [],
    getArgByIndex: () => undefined,
    getType: () => "http",
  } satisfies ArgumentsHost;
};

describe("AnyExceptionFilter", () => {
  const createHttpAdapterHost = (reply: jest.Mock): HttpAdapterHost => {
    return {
      httpAdapter: {
        reply,
      },
    } as unknown as HttpAdapterHost;
  };

  it("ServiceUnavailableException 应直接透传响应", () => {
    const reply = jest.fn();
    const httpAdapterHost = createHttpAdapterHost(reply);
    const filter = new AnyExceptionFilter(httpAdapterHost);

    const exception = new ServiceUnavailableException("service down");
    const response = {};
    const host = createArgumentsHost({ requestId: "req-503" }, response);

    filter.catch(exception, host);

    expect(reply).toHaveBeenCalledWith(
      response,
      exception.getResponse(),
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  });

  it("未知异常应记录错误并返回通用 500", () => {
    const reply = jest.fn();
    const httpAdapterHost = createHttpAdapterHost(reply);
    const logger = {
      error: jest.fn(),
    } as unknown as ConstructorParameters<typeof AnyExceptionFilter>[1];

    const filter = new AnyExceptionFilter(httpAdapterHost, logger);

    const error = new Error("boom");
    const response = {};
    const host = createArgumentsHost({ requestId: "req-500" }, response);

    filter.catch(error, host);

    expect(logger.error).toHaveBeenCalledWith(
      "捕获到未处理异常",
      undefined,
      expect.objectContaining({ instance: "req-500", exception: error }),
    );

    expect(reply).toHaveBeenCalledWith(
      response,
      expect.objectContaining({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        detail: "系统繁忙，请稍后重试",
        instance: "req-500",
      }),
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  });
});

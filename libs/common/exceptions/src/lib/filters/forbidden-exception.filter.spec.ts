import type { ArgumentsHost } from "@nestjs/common";
import { ForbiddenException, HttpStatus } from "@nestjs/common";
import type { HttpAdapterHost } from "@nestjs/core";
import { ForbiddenExceptionFilter } from "./forbidden-exception.filter.js";

const createArgumentsHost = (
  request: Record<string, unknown>,
  response: Record<string, unknown>,
): ArgumentsHost =>
  ({
    switchToHttp: () =>
      ({
        getRequest: () => request,
        getResponse: () => response,
        getNext: () => undefined,
      }) as unknown as ReturnType<ArgumentsHost["switchToHttp"]>,
  }) as unknown as ArgumentsHost;

describe("ForbiddenExceptionFilter", () => {
  it("应将异常转换为统一格式并记录告警", () => {
    const reply = jest.fn();
    const httpAdapterHost = {
      httpAdapter: { reply },
    } as unknown as HttpAdapterHost;

    const logger = {
      warn: jest.fn(),
    };

    const filter = new ForbiddenExceptionFilter(
      httpAdapterHost,
      logger as unknown as ConstructorParameters<
        typeof ForbiddenExceptionFilter
      >[1],
    );
    const exception = new ForbiddenException("禁止访问测试");

    const response = {};
    const host = createArgumentsHost({ requestId: "req-403" }, response);

    filter.catch(exception, host);

    expect(logger.warn).toHaveBeenCalledWith(
      "捕获到 ForbiddenException",
      expect.objectContaining({
        instance: "req-403",
        detail: "禁止访问测试",
      }),
    );

    expect(reply).toHaveBeenCalledWith(
      response,
      expect.objectContaining({
        status: HttpStatus.FORBIDDEN,
        detail: "禁止访问测试",
        title: "禁止访问",
        instance: "req-403",
      }),
      HttpStatus.FORBIDDEN,
    );
  });
});

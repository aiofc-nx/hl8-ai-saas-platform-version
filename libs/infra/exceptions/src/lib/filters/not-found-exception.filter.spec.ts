import type { ArgumentsHost } from "@nestjs/common";
import { HttpStatus, NotFoundException } from "@nestjs/common";
import type { HttpAdapterHost } from "@nestjs/core";
import { NotFoundExceptionFilter } from "./not-found-exception.filter.js";

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

describe("NotFoundExceptionFilter", () => {
  it("应统一输出 404 错误信息", () => {
    const reply = jest.fn();
    const httpAdapterHost = {
      httpAdapter: { reply },
    } as unknown as HttpAdapterHost;

    const logger = {
      warn: jest.fn(),
    } as unknown as ConstructorParameters<typeof NotFoundExceptionFilter>[1];

    const filter = new NotFoundExceptionFilter(httpAdapterHost, logger);
    const exception = new NotFoundException("资源不存在测试");

    const response = {};
    const host = createArgumentsHost({ id: "legacy-id" }, response);

    filter.catch(exception, host);

    expect(logger.warn).toHaveBeenCalledWith(
      "捕获到 NotFoundException",
      expect.objectContaining({ detail: "资源不存在测试" }),
    );

    expect(reply).toHaveBeenCalledWith(
      response,
      expect.objectContaining({
        status: HttpStatus.NOT_FOUND,
        title: "资源不存在",
        detail: "资源不存在测试",
        instance: "legacy-id",
      }),
      HttpStatus.NOT_FOUND,
    );
  });
});

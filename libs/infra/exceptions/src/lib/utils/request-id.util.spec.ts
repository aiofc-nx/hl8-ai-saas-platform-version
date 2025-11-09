import type { ArgumentsHost } from "@nestjs/common";
import { resolveRequestId } from "./request-id.util.js";

const createHttpContext = (
  request: Record<string, unknown>,
): ReturnType<ArgumentsHost["switchToHttp"]> =>
  ({
    getRequest: () => request,
    getResponse: () => ({}),
    getNext: () => undefined,
  }) as unknown as ReturnType<ArgumentsHost["switchToHttp"]>;

describe("resolveRequestId", () => {
  it("优先读取 requestId 字段", () => {
    const context = createHttpContext({ requestId: "req-1" });
    expect(resolveRequestId(context)).toBe("req-1");
  });

  it("退化到 id 字段", () => {
    const context = createHttpContext({ id: 123 });
    expect(resolveRequestId(context)).toBe("123");
  });

  it("继续尝试读取请求头", () => {
    const context = createHttpContext({
      headers: { "x-request-id": "header-id" },
    });
    expect(resolveRequestId(context)).toBe("header-id");
  });

  it("最终回退到随机 UUID", () => {
    const context = createHttpContext({});
    const resolved = resolveRequestId(context);

    expect(typeof resolved).toBe("string");
    expect(resolved).toHaveLength(36);
    expect(resolved).toMatch(/^[0-9a-f-]{36}$/i);
  });
});

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { CallHandler, ExecutionContext } from "@nestjs/common";
import { lastValueFrom, of } from "rxjs";
import { AuditCoordinator } from "../../src/audit/audit-coordinator.js";
import { AuditQueryInterceptor } from "../../src/audit/audit-query.interceptor.js";
import type { SecurityContext } from "../../src/interfaces/security-context.js";

const createExecutionContext = (
  request: Record<string, unknown>,
  handlerName = "handle",
): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
    }),
    getHandler: () => ({ name: handlerName }),
  } as unknown as ExecutionContext);

const next = (result: unknown): CallHandler => ({
  handle: () => of(result),
});

describe("AuditQueryInterceptor", () => {
  const coordinator = {
    record: jest.fn().mockResolvedValue(undefined),
  } as unknown as AuditCoordinator;

  let interceptor: AuditQueryInterceptor;

  beforeEach(() => {
    jest.clearAllMocks();
    interceptor = new AuditQueryInterceptor(coordinator);
  });

  it("returns original response when security context missing", async () => {
    const context = createExecutionContext({});
    const response = await lastValueFrom(
      interceptor.intercept(context, next("ok")),
    );

    expect(response).toBe("ok");
    expect(coordinator.record).not.toHaveBeenCalled();
  });

  it("records query audit when security context exists", async () => {
    const securityContext: SecurityContext = {
      tenantId: "tenant-1",
      userId: "user-1",
    };
    const context = createExecutionContext(
      { securityContext, query: { keyword: "abc" } },
      "FindUserQuery",
    );

    const result = await lastValueFrom(
      interceptor.intercept(context, next({ data: [] })),
    );

    expect(result).toEqual({ data: [] });
    expect(coordinator.record).toHaveBeenCalledWith(securityContext, {
      tenantId: "tenant-1",
      userId: "user-1",
      action: "FindUserQuery",
      payload: { keyword: "abc" },
      result: { data: [] },
      metadata: { channel: "query" },
    });
  });
});



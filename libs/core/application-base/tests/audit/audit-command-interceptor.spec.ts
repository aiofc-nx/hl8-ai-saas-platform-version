import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { CallHandler, ExecutionContext } from "@nestjs/common";
import { lastValueFrom, of } from "rxjs";
import { AuditCoordinator } from "../../src/audit/audit-coordinator.js";
import { AuditCommandInterceptor } from "../../src/audit/audit-command.interceptor.js";
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

describe("AuditCommandInterceptor", () => {
  const coordinator = {
    record: jest.fn().mockResolvedValue(undefined),
  } as unknown as AuditCoordinator;

  let interceptor: AuditCommandInterceptor;
  beforeEach(() => {
    jest.clearAllMocks();
    interceptor = new AuditCommandInterceptor(coordinator);
  });

  it("passes through when security context missing", async () => {
    const context = createExecutionContext({});
    const response = await lastValueFrom(
      interceptor.intercept(context, next("ok")),
    );

    expect(response).toBe("ok");
    expect(coordinator.record).not.toHaveBeenCalled();
  });

  it("records audit information when security context present", async () => {
    const securityContext: SecurityContext = {
      tenantId: "tenant-1",
      userId: "user-1",
    };
    const context = createExecutionContext(
      { securityContext, body: { foo: "bar" } },
      "CreateUserCommand",
    );

    const result = await lastValueFrom(
      interceptor.intercept(context, next({ ok: true })),
    );

    expect(result).toEqual({ ok: true });
    expect(coordinator.record).toHaveBeenCalledWith(securityContext, {
      tenantId: "tenant-1",
      userId: "user-1",
      action: "CreateUserCommand",
      payload: { foo: "bar" },
      result: { ok: true },
      metadata: { channel: "command" },
    });
  });
});



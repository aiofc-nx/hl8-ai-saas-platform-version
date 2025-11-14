import { describe, expect, it, jest } from "@jest/globals";
import { MissingConfigurationForFeatureException } from "@hl8/exceptions";
import { of, throwError } from "rxjs";
import { AuditCoordinator } from "../../src/audit/audit-coordinator.js";
import { AuditRecordException } from "../../src/audit/audit-record.exception.js";
import type {
  AuditRecord,
  AuditService,
} from "../../src/interfaces/audit-service.interface.js";
import type { SecurityContext } from "../../src/interfaces/security-context.js";

const context: SecurityContext = {
  tenantId: "tenant-1",
  userId: "user-1",
  metadata: { traceId: "trace-1" },
};

const baseRecord: AuditRecord = {
  tenantId: "external-tenant",
  userId: "external-user",
  action: "TestAction",
  payload: { foo: "bar" },
  result: { success: true },
  metadata: { channel: "command" },
} as const;

describe("AuditCoordinator", () => {
  it("throws when audit service not provided", async () => {
    const coordinator = new AuditCoordinator(undefined);
    await expect(
      coordinator.record(context, {
        ...baseRecord,
      }),
    ).rejects.toBeInstanceOf(MissingConfigurationForFeatureException);
  });

  it("merges metadata and delegates to audit service", async () => {
    const append = jest
      .fn<AuditService["append"]>()
      .mockResolvedValue(undefined);
    const coordinator = new AuditCoordinator({
      append,
    } satisfies AuditService);

    await coordinator.record(context, baseRecord);

    expect(append).toHaveBeenCalledWith(context, {
      tenantId: context.tenantId,
      userId: context.userId,
      action: baseRecord.action,
      payload: baseRecord.payload,
      result: baseRecord.result,
      metadata: {
        traceId: "trace-1",
        channel: "command",
      },
    });
  });

  it("awaits observable results emitted by audit service", async () => {
    const append = jest
      .fn<AuditService["append"]>()
      .mockReturnValue(of(undefined));
    const coordinator = new AuditCoordinator({
      append,
    } satisfies AuditService);

    await coordinator.record(context, baseRecord);

    expect(append).toHaveBeenCalledTimes(1);
  });

  it("wraps underlying errors into AuditRecordException", async () => {
    const underlyingError = new Error("append failed");
    const append = jest
      .fn<AuditService["append"]>()
      .mockReturnValue(throwError(() => underlyingError));
    const coordinator = new AuditCoordinator({
      append,
    } satisfies AuditService);

    await expect(coordinator.record(context, baseRecord)).rejects.toThrow(
      AuditRecordException,
    );
  });
});
